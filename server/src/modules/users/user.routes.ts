import { Router } from 'express';
import { sessionAuth } from '../../middleware/session.js';
import { authLimiter, signupLimiter } from '../../middleware/rateLimit.js';
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

userRouter.post('/signup', signupLimiter, signup);
userRouter.post('/login', authLimiter, login);
userRouter.post('/logout', sessionAuth, logout);

userRouter.post('/mfa/generate', signupLimiter, generateMfa);
userRouter.post('/mfa/verify', authLimiter, verifyMfa);
userRouter.post('/mfa/recovery-codes', sessionAuth, regenerateRecoveryCodes);

userRouter.get('/me', sessionAuth, me);
userRouter.post('/password', sessionAuth, changePassword);
userRouter.delete('/me/purge', sessionAuth, purgeMe);
userRouter.delete('/me', sessionAuth, deleteMe);

userRouter.get('/tokens', sessionAuth, tokenController.listPAT);
userRouter.post('/tokens', sessionAuth, tokenController.createPAT);
userRouter.delete('/tokens/:id', sessionAuth, tokenController.revokePAT);

export default userRouter;
