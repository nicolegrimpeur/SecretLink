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

  // Session is not issued here — the client navigates to login after signup
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginReqSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const { email, password } = parsed.data;
  const result = await userService.login(email, password, req, res);

  res.status(200).json(result);
});

export const generateMfa = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = MfaGenerateReqSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(formatZodErrors(parsed.error));
  }

  const { email } = parsed.data;
  const setup = userService.generateMfaSetup(email);
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
  res.status(200).json(user);
});

export const regenerateRecoveryCodes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).session?.userId;
  const codes = await userService.regenerateRecoveryCodes(userId);
  res.status(200).json({ recovery_codes: codes });
});

export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  clearSession(res);
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

  res.status(204).end();
});

export const purgeMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).session?.userId;
  await userService.purgeUserData(userId);
  res.status(204).end();
});

export const deleteMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).session?.userId;
  await userService.deleteUser(userId);
  clearSession(res);
  res.status(204).end();
});
