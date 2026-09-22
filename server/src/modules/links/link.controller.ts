import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authUserId } from '../../middleware/auth.js';
import { linkService } from './link.service.js';
import {
  LinkCreateItemSchema,
  LinkCreateBulkRequestSchema,
  LinkStatusQuerySchema,
} from './link.schema.js';
import { ValidationError } from '../../shared/types.js';
import { formatZodErrors } from '../../shared/validation.js';

export const createLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = LinkCreateItemSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const { secret } = parsed.data;
  const result = await linkService.createLink(secret, req.ip, req.get('user-agent'));

  res.status(201).json({ result });
});

export const createLinks = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = LinkCreateBulkRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const userId = authUserId(req);
  const items = parsed.data;

  const results = await linkService.createLinks(userId, items, req.ip, req.get('user-agent'));
  res.status(201).json({ results });
});

export const redeemLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const token = req.params.token as string;
  // Un `pass` répété (`?pass=a&pass=b`) arrive en tableau : seul un paramètre
  // unique est une passphrase, le reste est traité comme absent.
  const pass = req.query.pass;
  const passphraseHash = typeof pass === 'string' && pass ? pass : undefined;

  const result = await linkService.redeemLink(token, passphraseHash, req.ip, req.get('user-agent'));
  res.status(200).json(result);
});

export const deleteLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const itemId = req.params.item_id as string;
  const userId = authUserId(req);

  await linkService.deleteLink(userId, itemId, req.ip, req.get('user-agent'));
  res.status(204).end();
});

export const statusList = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = LinkStatusQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const userId = authUserId(req);
  const { since, until } = parsed.data;

  const results = await linkService.listLinks(
    userId,
    since ? new Date(since) : undefined,
    until ? new Date(until) : undefined,
  );
  res.json(results);
});
