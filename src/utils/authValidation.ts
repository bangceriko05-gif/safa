import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Nama minimal 2 karakter')
    .max(100, 'Nama maksimal 100 karakter'),
  email: z.string()
    .trim()
    .email('Format email tidak valid')
    .max(255, 'Email maksimal 255 karakter'),
  password: z.string()
    .min(8, 'Password minimal 8 karakter'),
});

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .email('Format email tidak valid'),
  password: z.string()
    .min(1, 'Password wajib diisi'),
});

export type SignupFormData = z.infer<typeof signupSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
