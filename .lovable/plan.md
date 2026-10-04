# Samakan Tampilan Dashboard dengan Referensi

## Hasil yang Dibangun
- Tata ulang dashboard desktop mengikuti komposisi contoh: sidebar putih tetap, header pencarian dan aksi, sapaan, kartu ringkasan, tab transaksi, filter tanggal, dan tabel.
- Gunakan Plus Jakarta Sans, skala teks, tinggi kontrol, jarak, warna biru, permukaan putih, serta bayangan lembut yang serupa dengan referensi.
- Tampilkan logo outlet dan nama outlet pada pojok kiri atas sidebar; gunakan gambar outlet yang sudah tersimpan dan fallback ikon properti bila belum ada logo.
- Pertahankan seluruh menu, hak akses, data, dan fungsi yang sudah ada; perubahan berfokus pada tampilan dan susunan.
- Jaga versi layar kecil tetap dapat digunakan tanpa memaksakan layout desktop.

## Teknis
- Rapikan kerangka utama dan navigasi di `Dashboard.tsx`, pemilih outlet di `StoreSelector.tsx`, serta tampilan transaksi di `TransactionManagement.tsx` dan daftar booking terkait.
- Tambahkan token visual dashboard pada stylesheet global agar warna, border, bayangan, dan tipografi konsisten.
- Gunakan data outlet aktif untuk logo/nama tanpa menambah data baru.

## Verifikasi
- Bandingkan hasil pada viewport desktop dengan gambar referensi.
- Pastikan pergantian menu/outlet, POS, filter transaksi, pencarian, dan tombol tambah booking tetap bekerja.
- Periksa tampilan layar kecil serta pastikan aplikasi selesai dibangun tanpa error.
