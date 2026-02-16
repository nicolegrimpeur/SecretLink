import { z } from 'zod';

export const CreateTokenReqSchema = z.object({
  label: z.string().optional().nullable(),
  scopes: z
    .array(z.string())
    .optional()
    .default(['links:read', 'links:write', 'links:delete']),
});

export type CreateTokenRequest = z.infer<typeof CreateTokenReqSchema>;
