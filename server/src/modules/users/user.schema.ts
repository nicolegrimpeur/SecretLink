import { z } from 'zod';

const totpCodeSchema = z.string().length(6).regex(/^\d{6}$/, 'Code OTP invalide');

export const SignupReqSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  totp_secret: z.string().min(16),
  totp_code: totpCodeSchema,
});

export const LoginReqSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const MfaGenerateReqSchema = z.object({
  email: z.string().email().max(320),
});

export const MfaVerifyReqSchema = z.object({
  pre_auth_token: z.string().min(1),
  totp_code: totpCodeSchema.optional(),
  recovery_code: z.string().min(1).optional(),
  remember_device: z.boolean().optional(),
}).refine(
  (data) => data.totp_code !== undefined || data.recovery_code !== undefined,
  { message: 'totp_code ou recovery_code requis' },
);

export const ChangePasswordReqSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(128),
});

export type SignupRequest = z.infer<typeof SignupReqSchema>;
export type LoginRequest = z.infer<typeof LoginReqSchema>;
export type MfaGenerateRequest = z.infer<typeof MfaGenerateReqSchema>;
export type MfaVerifyRequest = z.infer<typeof MfaVerifyReqSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordReqSchema>;
