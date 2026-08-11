import { z } from 'zod';

export const CreateTokenReqSchema = z.object({
  label: z.string().optional().nullable(),
  scopes: z
    .array(z.string())
    .optional()
    .default(['links:read', 'links:write', 'links:delete']),
});

export const TokenIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateTokenRequest = z.infer<typeof CreateTokenReqSchema>;
export type TokenIdParam = z.infer<typeof TokenIdParamSchema>;
