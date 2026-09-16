# Rapikan Tampilan Toko dan Tautan QR Kamar

## Perubahan
- Hilangkan bar atas “ANKA Shop / Semua Outlet” pada halaman outlet.
- Tampilkan logo outlet di sisi kiri judul outlet pada bagian atas katalog.
- Pertahankan identitas outlet di atas daftar produk dan tampilkan nama kamar di sampingnya hanya jika halaman dibuka dari QR kamar.
- Ubah tautan QR kamar agar langsung membuka halaman toko outlet sambil membawa identitas kamar.

## Teknis
- Halaman toko membaca parameter kamar dari tautan QR dan tidak menampilkannya untuk kunjungan biasa.
- QR baru menggunakan domain resmi `www.anka.management` dan alamat outlet terkait.
- Tautan lama `/room-scan` tetap dipertahankan agar tidak merusak penggunaan yang sudah ada.

## Verifikasi
- Periksa tampilan toko biasa: tanpa nama kamar.
- Periksa tampilan dari tautan QR: logo outlet dan nama kamar terlihat, bar atas lama hilang.
