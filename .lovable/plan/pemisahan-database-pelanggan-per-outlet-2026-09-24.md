# Pemisahan database pelanggan per outlet

## Tujuan
Setiap outlet hanya menampilkan, mencari, mengubah, dan menghitung pelanggan milik outlet tersebut. Nomor telepon yang sama boleh memiliki data pelanggan terpisah di outlet berbeda.

## Perubahan
- Ubah aturan nomor telepon pelanggan dari unik secara global menjadi unik per outlet.
- Perketat seluruh aksi edit, hapus, detail CRM, penggabungan duplikat, booking, POS, poin, laporan, dan impor dengan identitas outlet aktif.
- Bersihkan data tampilan dan cache saat pengguna berpindah outlet agar data outlet sebelumnya tidak sempat muncul.
- Pertahankan riwayat transaksi, poin, dan statistik CRM hanya dari outlet pelanggan tersebut.

## Pemeriksaan
- Pastikan nomor telepon yang sama dapat didaftarkan pada dua outlet sebagai dua pelanggan berbeda.
- Uji perpindahan outlet, pencarian pelanggan saat booking/POS, detail CRM, edit, dan hapus.
- Pastikan pemeriksaan kode dan aplikasi selesai tanpa error.

## Detail teknis
- Data tetap berada dalam Lovable Cloud yang sama, tetapi dipisahkan ketat menggunakan `store_id` sebagai batas data outlet.
- Indeks unik pelanggan menjadi gabungan `(store_id, phone)`; aturan akses pengguna per outlet tetap aktif.
