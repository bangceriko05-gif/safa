import { z } from 'zod';

export const customerInputSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Nama wajib diisi')
    .max(100, 'Nama maksimal 100 karakter'),
  phone: z.string()
    .trim()
    .min(8, 'Nomor HP minimal 8 digit')
    .max(20, 'Nomor HP maksimal 20 digit')
    .regex(/^[0-9+\-\s()]{8,20}$/, 'Format nomor HP tidak valid'),
  email: z.string()
    .trim()
    .email('Format email tidak valid')
    .max(255, 'Email maksimal 255 karakter')
    .optional()
    .or(z.literal('')),
  notes: z.string()
    .max(500, 'Catatan maksimal 500 karakter')
    .optional()
    .or(z.literal('')),
  identity_type: z.string()
    .optional()
    .or(z.literal('')),
  identity_number: z.string()
    .max(50, 'Nomor identitas maksimal 50 karakter')
    .optional()
    .or(z.literal('')),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

export const validateCustomerInput = (data: CustomerInput): { success: boolean; errors: Record<string, string> } => {
  const result = customerInputSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, errors: {} };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const field = err.path[0] as string;
    if (!errors[field]) {
      errors[field] = err.message;
    }
  });
  
  return { success: false, errors };
};
