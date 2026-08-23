import config from '../../config/env.js';
import { linkStore, tx } from './link.store.js';
import { encrypt, decrypt, generateLinkToken, hashPassphrase, verifyPassphrase, hashIp } from '../../shared/crypto.js';
import { AppError, GoneError, NotFoundError, ValidationError } from '../../shared/types.js';
import { getLogger } from '../../shared/logger.js';

const logger = getLogger('LinkService');

interface CreateLinkResult {
  item_id: string;
  status: 'created' | 'invalid_item_id' | 'duplicate_item_id';
  link_token: string | null;
  link_url: string | null;
  expires_at: string | null;
  error: string | null;
}

/** Shareable URL for a link: the front-end page, not the API endpoint. */
function buildLinkUrl(linkToken: string): string {
  return `${config.FRONT_BASE_URL}/redeem/${encodeURIComponent(linkToken)}`;
}

export class LinkService {
  /**
   * Create a single public link (anonymous, uid=0)
   */
  async createLink(secret: string, ip?: string, userAgent?: string): Promise<CreateLinkResult> {
    if (!secret) {
      return {
        item_id: '',
        status: 'invalid_item_id',
        link_token: null,
        link_url: null,
        expires_at: null,
        error: 'Bad payload',
      };
    }

    const uid = 1; // Public link
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

      logger.info(
        {
          event: 'LINK_CREATED',
          owner_user_id: uid,
          link_id: linkId,
          ip_hash: hashIp(ip),
          user_agent: userAgent ?? null,
        },
        'Link created',
      );

      return {
        item_id: itemId,
        status: 'created' as const,
        link_token: linkToken,
        link_url: buildLinkUrl(linkToken),
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
    ip?: string,
    userAgent?: string,
  ): Promise<CreateLinkResult[]> {
    if (!items || !items.length) {
      throw new ValidationError('Array required');
    }

    const now = new Date();

    // Snapshot the owner's existing links once, before opening the transaction.
    const existingLinks = await linkStore.statusByOwner(uid);

    // A link only blocks re-creation while it is still redeemable. Once redeemed or
    // deleted it releases its `items` lock, so the database would accept a new link
    // for that item_id - the snapshot must not be stricter than the database.
    const isBlocking = (link: (typeof existingLinks)[number]) =>
      !link.used_at &&
      !link.deleted_at &&
      (!link.expires_at || new Date(link.expires_at) > now);

    const blockingByItemId = new Map<string, (typeof existingLinks)[number]>();
    const knownItemIds = new Set<string>();
    for (const link of existingLinks) {
      knownItemIds.add(link.item_id);
      if (isBlocking(link) && !blockingByItemId.has(link.item_id)) {
        blockingByItemId.set(link.item_id, link);
      }
    }

    // Results are indexed by input position so the response keeps the request order.
    const results: CreateLinkResult[] = new Array(items.length);
    const pending: Array<{
      index: number;
      itemId: string;
      secret: string;
      passphraseHash: string;
      ttlDays: number;
    }> = [];

    // Phase 1 - validation and duplicate resolution
    items.forEach((row, index) => {
      const itemId = String(row.item_id || '').trim();
      const secret = String(row.secret || '');
      const passphraseHash = String(row.passphrase_hash || '');
      const ttlDays = Number(row.ttl_days ?? 0);

      if (
        !itemId ||
        !secret ||
        !Number.isFinite(ttlDays) ||
        ttlDays < 0 ||
        ttlDays > 365
      ) {
        results[index] = {
          item_id: itemId,
          status: 'invalid_item_id',
          link_token: null,
          link_url: null,
          expires_at: null,
          error: 'Bad payload',
        };
        return;
      }

      const blocking = blockingByItemId.get(itemId);
      if (blocking) {
        results[index] = {
          item_id: itemId,
          status: 'duplicate_item_id',
          link_token: null,
          link_url: null,
          expires_at: blocking.expires_at ? new Date(blocking.expires_at).toISOString() : null,
          error: null,
        };
        return;
      }

      pending.push({ index, itemId, secret, passphraseHash, ttlDays });
    });

    // Phase 2 - argon2 is deliberately slow (~60 ms per hash). Hashing here rather than
    // inside the transaction keeps InnoDB locks and the pooled connection out of what is
    // pure CPU work: a 50-item batch would otherwise hold them for several seconds.
    const hashedPassphrases: Array<string | null> = [];
    for (const item of pending) {
      hashedPassphrases.push(item.passphraseHash ? await hashPassphrase(item.passphraseHash) : null);
    }

    // Audit entries are buffered and only emitted once the transaction has committed:
    // an aborted batch must not leave LINK_CREATED entries behind for links that were
    // rolled back and no longer exist.
    const createdEvents: Array<Record<string, unknown>> = [];

    // Phase 3 - transaction, purely SQL.
    await tx(async (cx) => {
      for (const [position, item] of pending.entries()) {
        const { index, itemId, secret, ttlDays } = item;

        // A consumed, deleted or expired link may have left its lock behind
        // (expired ones are only released lazily).
        if (knownItemIds.has(itemId)) {
          await linkStore.deleteItemLock(cx, uid, itemId);
        }

        // Insert item for tracking - the unique key is what catches duplicates inside
        // the payload itself.
        try {
          await linkStore.insertItem(cx, uid, itemId);
        } catch (err) {
          // Anything else (deadlock, lock wait timeout, lost connection) must abort the
          // whole batch: swallowing it would report success on a rolled back transaction.
          if ((err as { code?: string }).code !== 'ER_DUP_ENTRY') {
            throw err;
          }

          results[index] = {
            item_id: itemId,
            status: 'duplicate_item_id',
            link_token: null,
            link_url: null,
            expires_at: null,
            error: null,
          };
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
          ph: hashedPassphrases[position],
        };

        const result = await linkStore.insertLink(cx, linkInData);
        const linkId = result.insertId;

        results[index] = {
          item_id: itemId,
          status: 'created',
          link_token: linkToken,
          link_url: buildLinkUrl(linkToken),
          expires_at: expiresAt ? expiresAt.toISOString() : null,
          error: null,
        };

        createdEvents.push({
          event: 'LINK_CREATED',
          owner_user_id: uid,
          link_id: linkId,
          ip_hash: hashIp(ip),
          user_agent: userAgent ?? null,
        });
      }
    });

    for (const event of createdEvents) {
      logger.info(event, 'Link created');
    }

    return results;
  }

  /**
   * Redeem (decrypt) a link and mark as used
   */
  async redeemLink(
    token: string,
    passphraseHash?: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ item_id: string; secret: string; redeemed_at: string }> {
    return tx(async (cx) => {
      const link = await linkStore.linkByTokenForUpdate(cx, token);

      if (!link) {
        throw new NotFoundError('Link not found');
      }

      // Check if link is expired, deleted, or already used
      if (link.deleted_at || link.used_at) {
        throw new GoneError('Link expired, deleted, or already used');
      }

      if (link.expires_at && new Date(link.expires_at) <= new Date()) {
        // Purge cipher_text and release item lock before surfacing the error
        await linkStore.purgeExpiredLink(cx, link.id);
        await linkStore.deleteItemLock(cx, link.owner_user_id, link.item_id);
        throw new GoneError('Link expired, deleted, or already used');
      }

      // Verify passphrase if required
      // Both 403s keep a dedicated code - the client discriminates on them
      if (link.passphrase_hash) {
        if (!passphraseHash) {
          throw new AppError(403, 'PASSPHRASE_REQUIRED', 'Passphrase required or invalid');
        }

        const passphraseValid = await verifyPassphrase(passphraseHash, link.passphrase_hash);
        if (!passphraseValid) {
          throw new AppError(403, 'INVALID_PASSPHRASE', 'Passphrase required or invalid');
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

      logger.info(
        {
          event: 'LINK_REDEEMED',
          owner_user_id: link.owner_user_id,
          link_id: link.id,
          ip_hash: hashIp(ip),
          user_agent: userAgent ?? null,
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
  async deleteLink(uid: number, itemId: string, ip?: string, userAgent?: string): Promise<void> {
    return tx(async (cx) => {
      const link = await linkStore.linkByItemForUpdate(cx, uid, itemId);

      if (!link || Number(link.owner_user_id) !== uid) {
        throw new NotFoundError('Link not found');
      }

      await linkStore.setDeletedAndPurge(cx, link.id);
      await linkStore.deleteItemLock(cx, uid, link.item_id);

      logger.info(
        {
          event: 'LINK_DELETED',
          owner_user_id: uid,
          link_id: link.id,
          ip_hash: hashIp(ip),
          user_agent: userAgent ?? null,
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
    await linkStore.purgeExpiredLinksForUser(uid);
    const results = await linkStore.statusByOwner(uid, since, until);
    return results.map((r) => ({
      item_id: r.item_id,
      created_at: r.created_at,
      expires_at: r.expires_at,
      used_at: r.used_at,
      deleted_at: r.deleted_at,
    }));
  }
}

export const linkService = new LinkService();
