import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { linkService } from './link.service.js';
import {
  LinkCreateItemSchema,
  LinkCreateBulkRequestSchema,
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
  const result = await linkService.createLink(secret);

  res.status(201).json({ result });
});

export const createLinks = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = LinkCreateBulkRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const userId = (req as any).auth?.userId;
  const items = parsed.data;

  const results = await linkService.createLinks(userId, items);
  res.status(201).json({ results });
});

export const redeemLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const token = req.params.token;
  const passphraseHash = req.query.pass ? String(req.query.pass) : undefined;

  try {
    const result = await linkService.redeemLink(token, passphraseHash);
    res.status(200).json(result);
  } catch (err: any) {
    if (err.statusCode === 403) {
      res.status(403).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }
    if (err.statusCode === 404) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Link not found' },
      });
      return;
    }
    if (err.statusCode === 410) {
      res.status(410).json({
        error: { code: 'LINK_GONE', message: err.message },
      });
      return;
    }
    throw err;
  }
});

export const deleteLink = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const token = req.params.token;
  const userId = (req as any).auth?.userId;

  await linkService.deleteLink(userId, token);
  res.status(204).end();
});

export const statusList = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).auth?.userId;
  const since = req.query.since ? new Date(String(req.query.since)) : undefined;
  const until = req.query.until ? new Date(String(req.query.until)) : undefined;

  const results = await linkService.listLinks(userId, since, until);
  res.json(results);
});
