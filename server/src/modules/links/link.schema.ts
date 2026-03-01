import { z } from 'zod';

export const LinkCreateItemSchema = z.object({
  secret: z.string().min(1).max(64),
});

export const LinkCreateBulkItemSchema = z.object({
  item_id: z.string().min(1).max(320),
  secret: z.string().min(1).max(4096),
  passphrase_hash: z
    .string()
    .length(64)
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  ttl_days: z.number().min(0).max(365).optional().default(0),
});

export const LinkCreateBulkRequestSchema = z.array(LinkCreateBulkItemSchema).min(1).max(1000);

export type LinkCreateItem = z.infer<typeof LinkCreateItemSchema>;
export type LinkCreateBulkItem = z.infer<typeof LinkCreateBulkItemSchema>;
export type LinkCreateBulkRequest = z.infer<typeof LinkCreateBulkRequestSchema>;
