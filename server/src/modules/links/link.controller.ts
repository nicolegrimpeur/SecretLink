import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { linkService } from './link.service.js';
import {
  LinkCreateItemSchema,
  LinkCreateBulkRequestSchema,
  LinkStatusQuerySchema,
} from './link.schema.js';
import { ValidationError } from '../../shared/types.js';

function formatZodErrors(error: any): string {
  if (error.issues) {
    return error.issues
      .map((issue: any) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
  }
  return 'Invalid request';
}

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

  const userId = (req as any).auth?.userId;
  const items = parsed.data;

  const results = await linkService.createLinks(userId, items, req.ip, req.get('user-agent'));
  res.status(201).json({ results });
});

export const redeemLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const token = req.params.token as string;
  const passphraseHash = req.query.pass ? String(req.query.pass) : undefined;

  const result = await linkService.redeemLink(token, passphraseHash, req.ip, req.get('user-agent'));
  res.status(200).json(result);
});

export const deleteLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const itemId = req.params.item_id as string;
  const userId = (req as any).auth?.userId;

  await linkService.deleteLink(userId, itemId, req.ip, req.get('user-agent'));
  res.status(204).end();
});

export const statusList = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = LinkStatusQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const userId = (req as any).auth?.userId;
  const { since, until } = parsed.data;

  const results = await linkService.listLinks(
    userId,
    since ? new Date(since) : undefined,
    until ? new Date(until) : undefined,
  );
  res.json(results);
});
