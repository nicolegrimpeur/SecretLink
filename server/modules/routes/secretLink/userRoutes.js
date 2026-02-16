import {Router} from 'express';
import {sessionAuth} from '../../shared/session.js';
import {
    changePassword,
    deleteMe,
    login,
    logout,
    me,
    purgeMe,
    signup
} from '../../controllers/secretLink/usersController.js';
import {createPAT, listPAT, revokePAT} from '../../controllers/secretLink/patController.js';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', sessionAuth, logout);

router.get('/me', sessionAuth, me);
router.post('/password', sessionAuth, changePassword);
router.delete('/me/purge', sessionAuth, purgeMe);
router.delete('/me', sessionAuth, deleteMe);

router.get('/tokens', sessionAuth, listPAT);
router.post('/tokens', sessionAuth, createPAT);
router.delete('/tokens/:id', sessionAuth, revokePAT);

export default router;
