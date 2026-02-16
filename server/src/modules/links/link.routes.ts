import { Router } from 'express';
import { authEither, requireAuth } from '../../middleware/auth.js';
import * as linkController from './link.controller.js';

export const linkRouter = Router();

// Public endpoint - anyone can create an anonymous link
linkRouter.post('/', linkController.createLink);

// Authenticated endpoints
linkRouter.post('/bulk', authEither, requireAuth(['session', 'pat'], ['links:write']), linkController.createLinks);
linkRouter.get('/redeem/:token', linkController.redeemLink);

linkRouter.delete('/:token', authEither, requireAuth(['session', 'pat'], ['links:delete']), linkController.deleteLink);
linkRouter.get('/status', authEither, requireAuth(['session', 'pat'], ['links:read']), linkController.statusList);

export default linkRouter;
