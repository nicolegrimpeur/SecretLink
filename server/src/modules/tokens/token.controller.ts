import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { sessionUserId } from '../../middleware/auth.js';
import { tokenService } from './token.service.js';
import { CreateTokenReqSchema, TokenIdParamSchema } from './token.schema.js';
import { ValidationError } from '../../shared/types.js';
import { getLogger } from '../../shared/logger.js';
import { formatZodErrors } from '../../shared/validation.js';

const logger = getLogger('TokenController');

export const listPAT = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = sessionUserId(req);
  const tokens = await tokenService.listTokens(userId);
  res.json(tokens);
});

export const createPAT = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateTokenReqSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const userId = sessionUserId(req);
  const { label, scopes } = parsed.data;

  const result = await tokenService.createToken(userId, label || null, scopes);
  logger.info(
    { event: 'PAT_CREATED', user_id: userId, token_id: result.pat.id, label: result.pat.label, scopes },
    'PAT created',
  );
  res.status(201).json(result);
});

export const revokePAT = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = TokenIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const userId = sessionUserId(req);
  const tokenId = parsed.data.id;

  await tokenService.revokeToken(userId, tokenId);
  logger.info(
    { event: 'PAT_REVOKED', user_id: userId, token_id: tokenId },
    'PAT revoked',
  );
  res.status(204).end();
});
