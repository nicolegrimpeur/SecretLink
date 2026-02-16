import config from '../../config/env.js';
import { linkStore, tx } from './link.store.js';
import { encrypt, decrypt, generateLinkToken, hashPassphrase } from '../../shared/crypto.js';
import { NotFoundError, ValidationError } from '../../shared/types.js';
import { getLogger } from '../../shared/logger.js';

const logger = getLogger('LinkService');

interface CreateLinkResult {
  status: 'created' | 'invalid_item_id' | 'duplicate_item_id';
  link_token: string | null;
  link_url: string | null;
  expires_at: string | null;
  error: string | null;
}

export class LinkService {
  /**
   * Create a single public link (anonymous, uid=0)
   */
  async createLink(secret: string): Promise<CreateLinkResult> {
    if (!secret) {
      return {
        status: 'invalid_item_id',
        link_token: null,
        link_url: null,
        expires_at: null,
        error: 'Bad payload',
      };
    }

    const uid = 0; // Public link
    const itemId = '';
    const now = new Date();
    const ttlDays = 7;

    return tx(async (cx) => {
      const expiresAt = new Date(now.getTime() + ttlDays * 86400 * 1000);
      const linkToken = generateLinkToken();

      const encrypted = encrypt(secret, itemId, linkToken, uid);

      const linkInData = {
        uid,
        iid: itemId,
        lt: linkToken,
        ct: Buffer.from(encrypted.cipherText, 'base64url'),
        iv: Buffer.from(encrypted.nonce, 'base64url'),
        kv: config.KEY_VERSION,
        exp: expiresAt,
        ph: null,
      };

      const result = await linkStore.insertLink(cx, linkInData);
      const linkId = result.insertId;

      await linkStore.insertAudit(cx, uid, itemId, linkId, 'LINK_CREATED');

      logger.info(
        {
          event: 'LINK_CREATED',
          owner_user_id: uid,
          item_id: itemId,
          link_id: linkId,
        },
        'Link created',
      );

      return {
        status: 'created' as const,
        link_token: linkToken,
        link_url: `${config.BASE_URL}/secretLink/links/${encodeURIComponent(linkToken)}/redeem`,
        expires_at: expiresAt.toISOString(),
        error: null,
      };
    });
  }

  /**
   * Create multiple owned links with full validation
   */
  async createLinks(
    uid: number,
    items: Array<{
      item_id: string;
      secret: string;
      passphrase_hash?: string;
      ttl_days?: number;
    }>,
  ): Promise<CreateLinkResult[]> {
    if (!items || !items.length) {
      throw new ValidationError('Array required');
    }

    const now = new Date();

    return tx(async (cx) => {
      const results: CreateLinkResult[] = [];

      for (const row of items) {
        const itemId = String(row.item_id || '').trim();
        const secret = String(row.secret || '');
        const passphraseHash = String(row.passphrase_hash || '');
        const ttlDays = Number(row.ttl_days ?? 0);

        // Validate
        if (
          !itemId ||
          !secret ||
          !Number.isFinite(ttlDays) ||
          ttlDays < 0 ||
          ttlDays > 365
        ) {
          results.push({
            status: 'invalid_item_id',
            link_token: null,
            link_url: null,
            expires_at: null,
            error: 'Bad payload',
          });
          continue;
        }

        // Check for existing non-expired link
        const existingLinks = await linkStore.statusByOwner(uid);
        const existingLink = existingLinks.find((link) => link.item_id === itemId);

        if (
          existingLink &&
          (!existingLink.expires_at ||
            new Date(existingLink.expires_at) > now)
        ) {
          results.push({
            status: 'duplicate_item_id',
            link_token: null,
            link_url: null,
            expires_at: existingLink.expires_at ? new Date(existingLink.expires_at).toISOString() : null,
            error: null,
          });
          continue;
        } else if (existingLink?.expires_at && new Date(existingLink.expires_at) <= now) {
          await linkStore.deleteItemLock(cx, uid, itemId);
        }

        // Insert item for tracking
        try {
          await linkStore.insertItem(cx, uid, itemId);
        } catch (err) {
          results.push({
            status: 'duplicate_item_id',
            link_token: null,
            link_url: null,
            expires_at: null,
            error: null,
          });
          continue;
        }

        // Create link
        const expiresAt = ttlDays === 0 ? null : new Date(now.getTime() + ttlDays * 86400 * 1000);
        const linkToken = generateLinkToken();

        const encrypted = encrypt(secret, itemId, linkToken, uid);

        const linkInData = {
          uid,
          iid: itemId,
          lt: linkToken,
          ct: Buffer.from(encrypted.cipherText, 'base64url'),
          iv: Buffer.from(encrypted.nonce, 'base64url'),
          kv: config.KEY_VERSION,
          exp: expiresAt,
          ph: passphraseHash ? hashPassphrase(passphraseHash) : null,
        };

        const result = await linkStore.insertLink(cx, linkInData);
        const linkId = result.insertId;

        await linkStore.insertAudit(cx, uid, itemId, linkId, 'LINK_CREATED');

        results.push({
          status: 'created',
          link_token: linkToken,
          link_url: `${config.BASE_URL}/secretLink/links/${encodeURIComponent(linkToken)}/redeem`,
          expires_at: expiresAt ? expiresAt.toISOString() : null,
          error: null,
        });

        logger.info(
          {
            event: 'LINK_CREATED',
            owner_user_id: uid,
            item_id: itemId,
            link_id: linkId,
          },
          'Link created',
        );
      }

      return results;
    });
  }

  /**
   * Redeem (decrypt) a link and mark as used
   */
  async redeemLink(
    token: string,
    passphraseHash?: string,
  ): Promise<{ item_id: string; secret: string; redeemed_at: string }> {
    return tx(async (cx) => {
      const link = await linkStore.linkByTokenForUpdate(cx, token);

      if (!link) {
        throw new NotFoundError('Link not found');
      }

      // Check if link is expired, deleted, or already used
      if (
        link.deleted_at ||
        link.used_at ||
        (link.expires_at && new Date(link.expires_at) <= new Date())
      ) {
        const err = new Error('Link expired, deleted, or already used');
        (err as any).statusCode = 410;
        (err as any).code = 'LINK_GONE';
        throw err;
      }

      // Verify passphrase if required
      if (link.passphrase_hash) {
        if (!passphraseHash) {
          const err = new Error('Passphrase required or invalid');
          (err as any).statusCode = 403;
          (err as any).code = 'PASSPHRASE_REQUIRED';
          throw err;
        }

        const hashedInput = hashPassphrase(passphraseHash);
        if (hashedInput !== link.passphrase_hash) {
          const err = new Error('Passphrase required or invalid');
          (err as any).statusCode = 403;
          (err as any).code = 'INVALID_PASSPHRASE';
          throw err;
        }
      }

      // Decrypt
      const decrypted = decrypt(
        link.cipher_text.toString('base64url'),
        link.nonce.toString('base64url'),
        `item_id:${link.item_id}|key_version:${link.key_version}|link_token:${token}|owner_user_id:${link.owner_user_id}`,
      );

      // Mark as used and purge ciphertext
      await linkStore.setUsedAndPurge(cx, link.id);
      await linkStore.deleteItemLock(cx, link.owner_user_id, link.item_id);
      await linkStore.insertAudit(
        cx,
        link.owner_user_id,
        link.item_id,
        link.id,
        'LINK_REDEEMED',
      );

      logger.info(
        {
          event: 'LINK_REDEEMED',
          owner_user_id: link.owner_user_id,
          item_id: link.item_id,
        },
        'Link redeemed',
      );

      return {
        item_id: link.item_id,
        secret: decrypted.plainText,
        redeemed_at: new Date().toISOString(),
      };
    });
  }

  /**
   * Delete a link (soft delete)
   */
  async deleteLink(uid: number, token: string): Promise<void> {
    return tx(async (cx) => {
      const link = await linkStore.linkOwnerItemForUpdate(cx, token);

      if (!link || Number(link.owner_user_id) !== uid) {
        throw new NotFoundError('Link not found');
      }

      await linkStore.setDeletedAndPurge(cx, link.id);
      await linkStore.deleteItemLock(cx, uid, link.item_id);
      await linkStore.insertAudit(cx, uid, link.item_id, link.id, 'LINK_DELETED');

      logger.info(
        {
          event: 'LINK_DELETED',
          owner_user_id: uid,
          item_id: link.item_id,
        },
        'Link deleted',
      );
    });
  }

  /**
   * List links for a user
   */
  async listLinks(
    uid: number,
    since?: Date,
    until?: Date,
  ): Promise<any[]> {
    const results = await linkStore.statusByOwner(uid, since, until);
    return results.map((r) => ({
      link_token: r.link_token,
      item_id: r.item_id,
      created_at: r.created_at,
      expires_at: r.expires_at,
      used_at: r.used_at,
      deleted_at: r.deleted_at,
    }));
  }
}

export const linkService = new LinkService();
