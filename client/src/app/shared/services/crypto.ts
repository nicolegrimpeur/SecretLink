import { Injectable } from '@angular/core';

// --- Types publics ---
export type EncPayload = `enc:${string}:${string}:${string}`;

export interface EncryptResult {
  /** secret prêt à l'envoi : chiffré si passphrase fournie, sinon en clair */
  secret: string | EncPayload;
  /** SHA-256 hex de la passphrase si fournie, sinon '' */
  passphraseHash: string;
}

export enum CryptoErrorCode {
  InvalidPayload = 'INVALID_PAYLOAD',
  WrongPassphrase = 'WRONG_PASSPHRASE',
  UnsupportedVersion = 'UNSUPPORTED_VERSION',
}

export class CryptoError extends Error {
  constructor(public code: CryptoErrorCode, message?: string) {
    super(message || code);
  }
}

type U8 = Uint8Array<ArrayBuffer>;

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  // Paramétrage PBKDF2
  private readonly iterations = 250_000;
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  // --- helpers "ArrayBuffer-only" ---
  private u8(len: number): U8 {
    return new Uint8Array(new ArrayBuffer(len));
  }

  private encodeU8(text: string): U8 {
    const src = this.encoder.encode(text);
    const out = this.u8(src.length);
    out.set(src);
    return out;
  }

  // ---------- API PUBLIQUE ----------

  /** Détecte si le secret est un payload chiffré enc: */
  isEncrypted(secret: string | null | undefined): secret is EncPayload {
    return typeof secret === 'string' && secret.startsWith('enc:');
  }

  /** SHA-256 (hex) d'une passphrase */
  async hashPassphrase(passphrase: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', this.encoder.encode(passphrase));
    return this.toHex(new Uint8Array(buf));
  }

  /**
   * Chiffre le secret si une passphrase est fournie. Sinon, renvoie le secret tel quel.
   * Retourne aussi passphraseHash ('' si pas de passphrase).
   */
  async encryptIfPassphrase(secret: string, passphrase?: string): Promise<EncryptResult> {
    const pass = (passphrase || '').trim();
    if (!pass) {
      return { secret, passphraseHash: '' };
    }
    const { payload, passphraseHash } = await this.encrypt(secret, pass);
    return { secret: payload, passphraseHash };
  }

  /**
   * Déchiffre si besoin. Si `secret` est en clair, il est retourné tel quel.
   * Lance CryptoError en cas d'erreur.
   */
  async decryptIfNeeded(secret: string, passphrase?: string): Promise<string> {
    if (!this.isEncrypted(secret)) return secret;
    const pass = (passphrase || '').trim();
    if (!pass) {
      throw new CryptoError(CryptoErrorCode.WrongPassphrase, 'Passphrase requise.');
    }
    return this.decrypt(secret as EncPayload, pass);
  }

  // ---------- IMPLÉMENTATION PRIVÉE ----------

  private async encrypt(plaintext: string, passphrase: string): Promise<{ payload: EncPayload; passphraseHash: string; }> {
    const salt = crypto.getRandomValues(this.u8(16));
    const iv = crypto.getRandomValues(this.u8(12));
    const key = await this.deriveKey(passphrase, salt, ['encrypt']);
    const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, this.encoder.encode(plaintext));
    const payload = `enc:${this.toB64(salt)}:${this.toB64(iv)}:${this.toB64(new Uint8Array(ctBuf))}` as EncPayload;
    const passphraseHash = await this.hashPassphrase(passphrase);
    return { payload, passphraseHash };
  }

  private async decrypt(payload: EncPayload, passphrase: string): Promise<string> {
    const parts = payload.split(':');
    if (parts.length !== 4) throw new CryptoError(CryptoErrorCode.InvalidPayload, 'Format enc: invalide.');
    const [, saltB64, ivB64, ctB64] = parts;

    try {
      const salt = this.fromB64(saltB64);
      const iv = this.fromB64(ivB64);
      const ct = this.fromB64(ctB64);

      const key = await this.deriveKey(passphrase, salt, ['decrypt']);
      const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return this.decoder.decode(ptBuf);
    } catch {
      throw new CryptoError(CryptoErrorCode.WrongPassphrase, 'Passphrase incorrecte ou payload altéré.');
    }
  }

  private async deriveKey(passphrase: string, salt: U8, usages: KeyUsage[]): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey('raw', this.encodeU8(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: this.iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      usages
    );
  }

  // --- utilitaires encodage ---
  private toHex(u8: Uint8Array): string {
    return Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private toB64(u8: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
  }

  private fromB64(b64: string): U8 {
    const bin = atob(b64);
    const u8 = this.u8(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
}
