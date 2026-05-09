import argon2 from 'argon2';
import crypto from 'node:crypto';
import { generateSecret, generateURI, verify as totpVerify } from 'otplib';
import { Request, Response } from 'express';
import { userStore } from './user.store.js';
import { withTx } from '../../config/database.js';
import { ValidationError, UnauthorizedError, NotFoundError, ConflictError } from '../../shared/types.js';
import { encryptTotpSecret, decryptTotpSecret } from '../../shared/crypto.js';
import { issueSession, issuePreAuthToken, verifyPreAuthToken } from '../../middleware/session.js';
import config from '../../config/env.js';

interface PublicUser {
  id: number;
  email: string;
  created_at: string;
  email_verified_at: string | null;
}

interface SignupResult {
  user: PublicUser;
  recovery_codes: string[];
}

interface LoginResult {
  mfa_required: true;
  pre_auth_token: string;
}

interface LoginDirectResult {
  mfa_required: false;
  user: PublicUser;
}

function publicUser(row: any): PublicUser {
  return {
    id: Number(row.id),
    email: row.email,
    created_at: row.created_at,
    email_verified_at: row.email_verified_at ?? null,
  };
}

export class UserService {
  // ─── MFA setup (stateless — no DB write, just generates secret + URI) ────────

  async generateMfaSetup(email: string): Promise<{ provisioning_uri: string; secret: string }> {
    const existing = await userStore.findByEmail(email);
    if (existing) {
      throw new ConflictError('Email already in use');
    }
    const secret = generateSecret();
    const issuer = config.NODE_ENV === 'production' ? 'SecretLink' : 'SecretLink Dev';
    const provisioning_uri = generateURI({ issuer, label: email, secret });
    return { provisioning_uri, secret };
  }

  // ─── Signup ──────────────────────────────────────────────────────────────────

  async signup(
    email: string,
    password: string,
    totpSecret: string,
    totpCode: string,
  ): Promise<SignupResult> {
    if (!email || !password) {
      throw new ValidationError('Email and password required');
    }

    const existing = await userStore.findByEmail(email);
    if (existing) {
      throw new ConflictError('Email already in use');
    }

    // Verify the TOTP code before creating anything
    const verifyResult = await totpVerify({ token: totpCode, secret: totpSecret });
    if (!verifyResult.valid) {
      throw new ValidationError('Code MFA invalide');
    }

    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const result = await userStore.createUser(email, Buffer.from(hash));

    const user = await userStore.getById(result.insertId);
    if (!user) {
      throw new Error('User creation failed');
    }

    // Encrypt and store TOTP secret
    const { cipher, nonce } = encryptTotpSecret(totpSecret, user.id);
    await userStore.setTotpSecret(user.id, cipher, nonce);

    // Generate recovery codes
    const { plainCodes, hashes } = this._generateRecoveryCodes();
    await userStore.storeRecoveryCodes(user.id, hashes);

    return { user: publicUser(user), recovery_codes: plainCodes };
  }

  // ─── Login (step 1) ──────────────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
    req: Request,
    res: Response,
  ): Promise<LoginResult | LoginDirectResult> {
    if (!email || !password) {
      throw new ValidationError('Email and password required');
    }

    const user = await userStore.findByEmail(email);
    if (!user || !user.password_hash) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const ok = await argon2.verify(user.password_hash.toString(), password);
    if (!ok) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Lazy-clean expired trusted devices
    await userStore.deleteExpiredTrustedDevices(user.id);

    // Check for a trusted device cookie
    const rawDeviceToken = req.cookies?.[config.TRUSTED_DEVICE_COOKIE_NAME];
    if (rawDeviceToken) {
      const tokenHash = crypto.createHash('sha256').update(rawDeviceToken).digest('hex');
      const trusted = await userStore.findTrustedDevice(tokenHash);
      if (trusted && trusted.user_id === user.id) {
        // Skip MFA — issue session directly
        issueSession(res, { userId: user.id });
        return { mfa_required: false, user: publicUser(user) };
      }
    }

    // MFA required
    const pre_auth_token = issuePreAuthToken(user.id);
    return { mfa_required: true, pre_auth_token };
  }

  // ─── MFA verify (step 2 of login) ────────────────────────────────────────────

  async verifyMfa(
    preAuthToken: string,
    totpCode: string | undefined,
    recoveryCode: string | undefined,
    rememberDevice: boolean,
    res: Response,
  ): Promise<PublicUser> {
    const { userId } = verifyPreAuthToken(preAuthToken);

    const user = await userStore.getById(userId);
    if (!user) throw new NotFoundError('User not found');

    if (!user.totp_secret_cipher || !user.totp_secret_nonce) {
      throw new UnauthorizedError('MFA non configuré');
    }

    if (recoveryCode) {
      // Recovery code path
      const codeHash = crypto.createHash('sha256').update(recoveryCode.toUpperCase().replace(/-/g, '')).digest('hex');
      const consumed = await userStore.findAndConsumeRecoveryCode(userId, codeHash);
      if (!consumed) {
        throw new UnauthorizedError('Code de récupération invalide ou déjà utilisé');
      }
    } else if (totpCode) {
      // TOTP path
      const secret = decryptTotpSecret(
        Buffer.from(user.totp_secret_cipher),
        Buffer.from(user.totp_secret_nonce),
        userId,
      );
      const verifyResult = await totpVerify({ token: totpCode, secret });
      if (!verifyResult.valid) {
        throw new UnauthorizedError('Code MFA invalide');
      }
    } else {
      throw new ValidationError('totp_code ou recovery_code requis');
    }

    if (rememberDevice) {
      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(
        Date.now() + config.TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000,
      );
      await userStore.createTrustedDevice(userId, tokenHash, expiresAt);

      res.cookie(config.TRUSTED_DEVICE_COOKIE_NAME, rawToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: config.TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000,
        path: '/',
      });
    }

    issueSession(res, { userId });
    return publicUser(user);
  }

  // ─── Recovery codes regeneration ─────────────────────────────────────────────

  async regenerateRecoveryCodes(userId: number): Promise<string[]> {
    const user = await userStore.getById(userId);
    if (!user) throw new NotFoundError('User not found');

    await userStore.deleteRecoveryCodes(userId);
    const { plainCodes, hashes } = this._generateRecoveryCodes();
    await userStore.storeRecoveryCodes(userId, hashes);
    return plainCodes;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private _generateRecoveryCodes(): { plainCodes: string[]; hashes: string[] } {
    const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/1/I to avoid confusion
    const plainCodes: string[] = [];
    const hashes: string[] = [];

    for (let i = 0; i < 8; i++) {
      const bytes = crypto.randomBytes(10);
      let code = '';
      for (const b of bytes) {
        code += CHARSET[b % CHARSET.length];
      }
      const formatted = `${code.slice(0, 5)}-${code.slice(5)}`;
      plainCodes.push(formatted);
      hashes.push(
        crypto.createHash('sha256').update(formatted.replace('-', '')).digest('hex'),
      );
    }

    return { plainCodes, hashes };
  }

  async getById(id: number): Promise<PublicUser> {
    const user = await userStore.getById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return publicUser(user);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await userStore.getById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.password_hash) {
      throw new ValidationError('No password set');
    }

    const ok = await argon2.verify(user.password_hash.toString(), currentPassword);
    if (!ok) {
      throw new UnauthorizedError('Invalid current password');
    }

    const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await userStore.updatePassword(userId, Buffer.from(hash));
  }

  async purgeUserData(userId: number): Promise<void> {
    // Purge revoked tokens and expired links
    await userStore.purgeUserApiTokens(userId);
    await userStore.purgeUserLinks(userId);
  }

  async deleteUser(userId: number): Promise<void> {
    // Delete user and all associated data in a transaction
    await withTx(async (cx) => {
      await userStore.deleteUserLinks(cx, userId);
      await userStore.deleteUserApiTokens(cx, userId);
      await userStore.deleteUserItems(cx, userId);
      await userStore.deleteUser(cx, userId);
    });
  }
}

export const userService = new UserService();
