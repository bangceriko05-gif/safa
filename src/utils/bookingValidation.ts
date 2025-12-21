import { z } from 'zod';

// Validation schema for booking form inputs
export const bookingInputSchema = z.object({
  customer_name: z.string()
    .trim()
    .min(1, "Nama pelanggan wajib diisi")
    .max(100, "Nama pelanggan maksimal 100 karakter"),
  phone: z.string()
    .trim()
    .min(1, "Nomor telepon wajib diisi")
    .regex(/^[0-9+\-\s()]{8,20}$/, "Format nomor telepon tidak valid (8-20 karakter, hanya angka dan +/-/())")
    .max(20, "Nomor telepon maksimal 20 karakter"),
  reference_no: z.string()
    .trim()
    .max(50, "Nomor referensi maksimal 50 karakter"),
  reference_no_2: z.string()
    .trim()
    .max(50, "Nomor referensi kedua maksimal 50 karakter")
    .optional(),
  note: z.string()
    .max(500, "Catatan maksimal 500 karakter")
    .optional(),
});

export type BookingInputValidation = z.infer<typeof bookingInputSchema>;

export const validateBookingInputs = (data: {
  customer_name: string;
  phone: string;
  reference_no: string;
  reference_no_2?: string;
  note?: string;
}): { success: boolean; errors: string[] } => {
  const result = bookingInputSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, errors: [] };
  }
  
  const errors = result.error.errors.map(err => err.message);
  return { success: false, errors };
};
