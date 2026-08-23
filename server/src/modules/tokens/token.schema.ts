import { z } from 'zod';

/** Liste fermée : un scope hors de cette liste est un 400, pas un PAT inutilisable. */
export const PAT_SCOPES = ['links:read', 'links:write', 'links:delete'] as const;

export const CreateTokenReqSchema = z.object({
  label: z.string().optional().nullable(),
  // `.default()` de zod ne se déclenche que sur `undefined` : un tableau vide passerait
  // tel quel et produirait un PAT sans aucun scope, donc en 403 sur chaque appel. La
  // transformation couvre les deux cas, et déduplique.
  scopes: z
    .array(z.enum(PAT_SCOPES))
    .optional()
    .transform((scopes) => {
      const unique = [...new Set(scopes ?? [])];
      return unique.length ? unique : [...PAT_SCOPES];
    }),
});

export const TokenIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateTokenRequest = z.infer<typeof CreateTokenReqSchema>;
export type TokenIdParam = z.infer<typeof TokenIdParamSchema>;
