import { Router } from 'express';
import { sessionAuth } from '../../middleware/session.js';
import {
  signup,
  login,
  logout,
  me,
  changePassword,
  purgeMe,
  deleteMe,
  generateMfa,
  verifyMfa,
  regenerateRecoveryCodes,
} from './user.controller.js';
import * as tokenController from '../tokens/token.controller.js';

export const userRouter = Router();

userRouter.post('/signup', signup);
userRouter.post('/login', login);
userRouter.post('/logout', sessionAuth, logout);

userRouter.post('/mfa/generate', generateMfa);
userRouter.post('/mfa/verify', verifyMfa);
userRouter.post('/mfa/recovery-codes', sessionAuth, regenerateRecoveryCodes);

userRouter.get('/me', sessionAuth, me);
userRouter.post('/password', sessionAuth, changePassword);
userRouter.delete('/me/purge', sessionAuth, purgeMe);
userRouter.delete('/me', sessionAuth, deleteMe);

userRouter.get('/tokens', sessionAuth, tokenController.listPAT);
userRouter.post('/tokens', sessionAuth, tokenController.createPAT);
userRouter.delete('/tokens/:id', sessionAuth, tokenController.revokePAT);

export default userRouter;
