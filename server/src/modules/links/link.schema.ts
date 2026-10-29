import { z } from 'zod';

/** Maximum length of a plaintext secret, in characters. */
export const SECRET_MAX = 4096;

const base64Length = (bytes: number) => 4 * Math.ceil(bytes / 3);

/**
 * Maximum length of a secret encrypted by the front end (`enc:<salt>:<iv>:<ciphertext>`,
 * base64) whose plaintext fits SECRET_MAX: UTF-8 takes at most 3 bytes per UTF-16 unit,
 * AES-GCM adds a 16-byte tag, salt and IV are 16 and 12 bytes.
 */
export const ENCRYPTED_SECRET_MAX =
  'enc:'.length + base64Length(16) + 1 + base64Length(12) + 1 + base64Length(SECRET_MAX * 3 + 16);

const ENCRYPTED_SECRET = /^enc:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;

export const LinkCreateItemSchema = z.object({
  secret: z.string().min(1).max(64),
});

export const LinkCreateBulkItemSchema = z.object({
  item_id: z.string().min(1).max(320),
  secret: z.string().min(1).max(ENCRYPTED_SECRET_MAX),
  passphrase_hash: z
    .string()
    .length(64)
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  ttl_days: z.number().min(0).max(365).optional().default(0),
}).superRefine((item, ctx) => {
  // The SECRET_MAX limit applies to the plaintext: only a passphrase-protected
  // encrypted payload may exceed it.
  const encrypted = item.passphrase_hash !== undefined && ENCRYPTED_SECRET.test(item.secret);
  if (!encrypted && item.secret.length > SECRET_MAX) {
    ctx.addIssue({ code: 'custom', path: ['secret'], message: `Too big: expected string to have <=${SECRET_MAX} characters` });
  }
});

export const LinkCreateBulkRequestSchema = z.array(LinkCreateBulkItemSchema).min(1).max(1000);

export const LinkStatusQuerySchema = z.object({
  since: z.iso.datetime({ offset: true }).optional(),
  until: z.iso.datetime({ offset: true }).optional(),
});

export type LinkCreateItem = z.infer<typeof LinkCreateItemSchema>;
export type LinkCreateBulkItem = z.infer<typeof LinkCreateBulkItemSchema>;
export type LinkCreateBulkRequest = z.infer<typeof LinkCreateBulkRequestSchema>;
export type LinkStatusQuery = z.infer<typeof LinkStatusQuerySchema>;
