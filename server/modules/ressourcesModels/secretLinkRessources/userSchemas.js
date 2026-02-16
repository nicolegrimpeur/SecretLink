import {z} from 'zod';

export const SignupReq = z.object({
    email: z.email().max(320),
    password: z.string().min(8).max(128),
});

export const LoginReq = z.object({
    email: z.email(),
    password: z.string().min(1),
});

export const ChangePasswordReq = z.object({
    current_password: z.string().min(1),
    new_password: z.string().min(8).max(128),
});
