import {z} from 'zod';

export const LinkCreateItem = z.object({
    secret: z.string().min(1).max(64),
});


export const LinkCreateBulkItem = z.object({
    item_id: z.string().min(1).max(320),
    secret: z.string().min(1).max(4096),
    passphrase_hash: z.string().length(64).regex(/^[a-f0-9]{64}$/).optional(),
    ttl_days: z.number().min(0).max(365).optional().default(0),
});

export const LinkCreateBulkRequest = z.array(LinkCreateBulkItem).min(1).max(1000);
