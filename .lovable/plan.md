# Satu BID untuk Booking Beberapa Kamar

## Hasil
- BID disiapkan dan ditampilkan langsung pada formulir Tambah Booking.
- Semua kamar yang ditambahkan dalam satu proses booking memakai satu BID yang sama.
- Setiap kamar tetap tersimpan sebagai kamar tersendiri agar kalender, harga, dan status kamar tetap bekerja.

## Pelaksanaan
- Tambahkan pencatatan kelompok booking di database sebagai pemilik BID unik.
- Hubungkan semua kamar dalam satu booking ke kelompok yang sama dan izinkan baris kamar berbagi BID.
- Saat formulir Tambah Booking dibuka, siapkan satu BID sesuai outlet, tanggal, dan tipe booking lalu tampilkan di bagian atas.
- Saat disimpan, gunakan BID tersebut untuk seluruh kamar; booking satu kamar tetap mengikuti alur yang sama.
- Tampilkan BID pada pemberitahuan sukses dan pertahankan produk/deposit hanya pada kamar utama seperti aturan saat ini.

## Verifikasi
- Uji booking satu kamar dan beberapa kamar.
- Pastikan seluruh kamar pada satu transaksi memiliki BID identik, sementara transaksi berikutnya mendapat BID baru.
- Pastikan kalender, nota, pembayaran, laporan, dan pencarian tetap dapat membuka setiap kamar.
