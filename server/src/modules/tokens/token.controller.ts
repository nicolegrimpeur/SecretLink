import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { tokenService } from './token.service.js';
import { CreateTokenReqSchema } from './token.schema.js';
import { ValidationError } from '../../shared/types.js';

function formatZodErrors(error: any): string {
  if (error.issues) {
    return error.issues
      .map((issue: any) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
  }
  return 'Invalid request';
}

export const listPAT = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).session?.userId;
  const tokens = await tokenService.listTokens(userId);
  res.json(tokens);
});

export const createPAT = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateTokenReqSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const userId = (req as any).session?.userId;
  const { label, scopes } = parsed.data;

  const result = await tokenService.createToken(userId, label || null, scopes);
  res.status(201).json(result);
});

export const revokePAT = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).session?.userId;
  const tokenId = Number(req.params.id);

  await tokenService.revokeToken(userId, tokenId);
  res.status(204).end();
});
