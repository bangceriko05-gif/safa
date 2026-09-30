# Konfirmasi Wajib Pembatalan Booking

## Hasil
- Setiap aksi yang mengubah booking menjadi **Batal** membuka peringatan konfirmasi.
- Pengguna wajib mengisi alasan pembatalan sebelum tombol **Batalkan** aktif.
- Tombol **Tutup** membatalkan aksi tanpa mengubah booking.
- Alasan disimpan pada catatan booking dan dicatat pada riwayat aktivitas.

## Pelaksanaan
- Buat satu dialog pembatalan yang dipakai bersama agar tampilannya konsisten.
- Hubungkan dialog ke kalender kamar, kalender jam FunFury, dan detail booking.
- Jalankan perubahan status hanya setelah alasan valid dikonfirmasi.

## Verifikasi
- Uji pembatalan dari setiap tampilan booking.
- Pastikan alasan kosong tidak dapat dikirim, alasan tersimpan, dan status berubah menjadi Batal.
