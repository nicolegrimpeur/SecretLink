import { z } from 'zod';

export const SignupReqSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
});

export const LoginReqSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ChangePasswordReqSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(128),
});

export type SignupRequest = z.infer<typeof SignupReqSchema>;
export type LoginRequest = z.infer<typeof LoginReqSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordReqSchema>;
