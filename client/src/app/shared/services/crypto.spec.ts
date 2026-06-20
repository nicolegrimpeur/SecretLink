import {TestBed} from '@angular/core/testing';

import {CryptoError, CryptoErrorCode, CryptoService} from './crypto';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CryptoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── isEncrypted() ─────────────────────────────────────────────

  describe('isEncrypted()', () => {
    it('returns true for valid enc: payloads', () => {
      expect(service.isEncrypted('enc:salt:iv:ct')).toBeTrue();
    });

    it('returns false for plain strings', () => {
      expect(service.isEncrypted('hello world')).toBeFalse();
    });

    it('returns false for null', () => {
      expect(service.isEncrypted(null)).toBeFalse();
    });

    it('returns false for undefined', () => {
      expect(service.isEncrypted(undefined)).toBeFalse();
    });

    it('returns false for strings starting with enc but without colon', () => {
      expect(service.isEncrypted('encoded-payload')).toBeFalse();
    });
  });

  // ── hashPassphrase() ──────────────────────────────────────────

  describe('hashPassphrase()', () => {
    it('returns a 64-character hex string (SHA-256)', async () => {
      const hash = await service.hashPassphrase('test');
      expect(hash.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBeTrue();
    });

    it('is deterministic — same input yields same hash', async () => {
      const h1 = await service.hashPassphrase('same passphrase');
      const h2 = await service.hashPassphrase('same passphrase');
      expect(h1).toBe(h2);
    });

    it('produces distinct hashes for distinct inputs', async () => {
      const h1 = await service.hashPassphrase('alpha');
      const h2 = await service.hashPassphrase('beta');
      expect(h1).not.toBe(h2);
    });
  });

  // ── encryptIfPassphrase() ─────────────────────────────────────

  describe('encryptIfPassphrase()', () => {
    it('returns secret unchanged when no passphrase is given', async () => {
      const result = await service.encryptIfPassphrase('my secret');
      expect(result.secret).toBe('my secret');
      expect(result.passphraseHash).toBe('');
    });

    it('returns secret unchanged for empty passphrase', async () => {
      const result = await service.encryptIfPassphrase('my secret', '');
      expect(result.secret).toBe('my secret');
      expect(result.passphraseHash).toBe('');
    });

    it('returns secret unchanged for whitespace-only passphrase', async () => {
      const result = await service.encryptIfPassphrase('my secret', '   ');
      expect(result.secret).toBe('my secret');
      expect(result.passphraseHash).toBe('');
    });

    it('encrypts the secret when a passphrase is given', async () => {
      const result = await service.encryptIfPassphrase('my secret', 'passphrase');
      expect(result.secret).not.toBe('my secret');
      expect((result.secret as string).startsWith('enc:')).toBeTrue();
    });

    it('passphraseHash matches hashPassphrase()', async () => {
      const result = await service.encryptIfPassphrase('my secret', 'passphrase');
      const expected = await service.hashPassphrase('passphrase');
      expect(result.passphraseHash).toBe(expected);
    });

    it('produces different ciphertexts on repeated calls (fresh random IV)', async () => {
      const r1 = await service.encryptIfPassphrase('same', 'same');
      const r2 = await service.encryptIfPassphrase('same', 'same');
      expect(r1.secret).not.toBe(r2.secret);
    });

    it('encrypted payload has 4 colon-separated parts', async () => {
      const {secret} = await service.encryptIfPassphrase('data', 'key');
      expect((secret as string).split(':').length).toBe(4);
    });
  });

  // ── decryptIfNeeded() ─────────────────────────────────────────

  describe('decryptIfNeeded()', () => {
    it('returns a plain-text secret unchanged', async () => {
      const result = await service.decryptIfNeeded('plain text');
      expect(result).toBe('plain text');
    });

    it('round-trips ASCII content', async () => {
      const original = 'Hello, secret world!';
      const {secret} = await service.encryptIfPassphrase(original, 'mypass');
      const decrypted = await service.decryptIfNeeded(secret as string, 'mypass');
      expect(decrypted).toBe(original);
    });

    it('round-trips unicode / emoji content', async () => {
      const original = 'été 2024 — £€¥ 🔐 café';
      const {secret} = await service.encryptIfPassphrase(original, 'pass');
      const decrypted = await service.decryptIfNeeded(secret as string, 'pass');
      expect(decrypted).toBe(original);
    });

    it('round-trips multiline content', async () => {
      const original = 'line1\nline2\nline3';
      const {secret} = await service.encryptIfPassphrase(original, 'pass');
      const decrypted = await service.decryptIfNeeded(secret as string, 'pass');
      expect(decrypted).toBe(original);
    });

    it('throws WrongPassphrase when no passphrase provided for encrypted payload', async () => {
      const {secret} = await service.encryptIfPassphrase('secret', 'pass');
      try {
        await service.decryptIfNeeded(secret as string);
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CryptoError);
        expect((e as CryptoError).code).toBe(CryptoErrorCode.WrongPassphrase);
      }
    });

    it('throws WrongPassphrase when passphrase is incorrect', async () => {
      const {secret} = await service.encryptIfPassphrase('secret', 'correct');
      try {
        await service.decryptIfNeeded(secret as string, 'wrong');
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CryptoError);
        expect((e as CryptoError).code).toBe(CryptoErrorCode.WrongPassphrase);
      }
    });

    it('throws InvalidPayload on malformed enc: payload (< 4 parts)', async () => {
      try {
        await service.decryptIfNeeded('enc:only:two', 'somepass');
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CryptoError);
        expect((e as CryptoError).code).toBe(CryptoErrorCode.InvalidPayload);
      }
    });

    it('different passphrases produce different ciphertexts but same plaintext', async () => {
      const original = 'same secret';
      const r1 = await service.encryptIfPassphrase(original, 'pass1');
      const r2 = await service.encryptIfPassphrase(original, 'pass2');
      expect(r1.secret).not.toBe(r2.secret);

      const d1 = await service.decryptIfNeeded(r1.secret as string, 'pass1');
      const d2 = await service.decryptIfNeeded(r2.secret as string, 'pass2');
      expect(d1).toBe(original);
      expect(d2).toBe(original);
    });
  });
});
