import {Router} from 'express';
import {createLink, createLinks, deleteLink, redeemLink, statusList} from '../../controllers/secretLink/linksController.js';
import {authEither, requireAuth} from "../../ressourcesModels/secretLinkRessources/authEither.js";

const router = Router();

router.use(authEither);

router.post('/', createLink);

// Bulk create
router.post('/bulk', requireAuth({allow: ['session', 'pat'], scopes: ['links:write']}), createLinks);

// Redeem public
router.get('/redeem/:token', redeemLink);

// Delete (owner)
router.delete('/:token', requireAuth({allow: ['session', 'pat'], scopes: ['links:delete']}), deleteLink);

// Status export
router.get('/status', requireAuth({allow: ['session', 'pat'], scopes: ['links:read']}), statusList);

export default router;
