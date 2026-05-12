import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { userService } from './user.service.js';
import {
  SignupReqSchema,
  LoginReqSchema,
  MfaGenerateReqSchema,
  MfaVerifyReqSchema,
  ChangePasswordReqSchema,
} from './user.schema.js';
import { clearSession } from '../../middleware/session.js';
import { ValidationError } from '../../shared/types.js';
import { getLogger } from '../../shared/logger.js';
import { hashIp } from '../../shared/crypto.js';

const logger = getLogger('UserController');

function formatZodErrors(error: any): string {
  if (error.issues) {
    return error.issues
      .map((issue: any) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
  }
  return 'Invalid request';
}

export const signup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = SignupReqSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const { email, password, totp_secret, totp_code } = parsed.data;
  const result = await userService.signup(email, password, totp_secret, totp_code);

  logger.info(
    { event: 'USER_SIGNUP', email, ip_hash: hashIp(req.ip), user_agent: req.get('user-agent') ?? null },
    'User signed up',
  );

  // Session is not issued here - the client navigates to login after signup
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginReqSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const { email, password } = parsed.data;
  const result = await userService.login(email, password, req, res);

  logger.info(
    { event: 'USER_LOGIN', email, mfa_required: (result as any).mfa_required, ip_hash: hashIp(req.ip), user_agent: req.get('user-agent') ?? null },
    'User login step 1',
  );

  res.status(200).json(result);
});

export const generateMfa = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = MfaGenerateReqSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const { email } = parsed.data;
  const setup = await userService.generateMfaSetup(email);
  res.status(200).json(setup);
});

export const verifyMfa = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = MfaVerifyReqSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const { pre_auth_token, totp_code, recovery_code, remember_device } = parsed.data;
  const user = await userService.verifyMfa(
    pre_auth_token,
    totp_code,
    recovery_code,
    remember_device ?? false,
    res,
  );

  logger.info(
    { event: 'USER_MFA_VERIFIED', user_id: user.id, ip_hash: hashIp(req.ip), user_agent: req.get('user-agent') ?? null },
    'User MFA verified',
  );

  res.status(200).json(user);
});

export const regenerateRecoveryCodes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).session?.userId;
  const codes = await userService.regenerateRecoveryCodes(userId);
  res.status(200).json({ recovery_codes: codes });
});

export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).session?.userId;
  clearSession(res);
  logger.info(
    { event: 'USER_LOGOUT', user_id: userId, ip_hash: hashIp(req.ip), user_agent: req.get('user-agent') ?? null },
    'User logged out',
  );
  res.status(204).end();
});

export const me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).session?.userId;
  const user = await userService.getById(userId);
  res.json(user);
});

export const changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = ChangePasswordReqSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const userId = (req as any).session?.userId;
  const { current_password, new_password } = parsed.data;
  await userService.changePassword(userId, current_password, new_password);

  logger.info(
    { event: 'USER_PASSWORD_CHANGED', user_id: userId, ip_hash: hashIp(req.ip), user_agent: req.get('user-agent') ?? null },
    'User changed password',
  );

  res.status(204).end();
});

export const purgeMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).session?.userId;
  await userService.purgeUserData(userId);
  logger.info(
    { event: 'USER_DATA_PURGED', user_id: userId, ip_hash: hashIp(req.ip) },
    'User data purged',
  );
  res.status(204).end();
});

export const deleteMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).session?.userId;
  await userService.deleteUser(userId);
  clearSession(res);
  logger.info(
    { event: 'USER_DELETED', user_id: userId, ip_hash: hashIp(req.ip) },
    'User account deleted',
  );
  res.status(204).end();
});
