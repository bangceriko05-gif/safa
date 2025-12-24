-- Insert standard PMS permissions
INSERT INTO permissions (name, description) VALUES
  -- Booking Management
  ('create_bookings', 'Dapat membuat booking baru'),
  ('edit_bookings', 'Dapat mengedit data booking'),
  ('delete_bookings', 'Dapat menghapus booking'),
  ('view_bookings', 'Dapat melihat daftar booking'),
  ('checkin_bookings', 'Dapat melakukan check-in tamu'),
  ('checkout_bookings', 'Dapat melakukan check-out tamu'),
  ('cancel_bookings', 'Dapat membatalkan booking'),
  
  -- Room Management
  ('manage_rooms', 'Dapat mengelola kamar (tambah, edit, hapus)'),
  ('view_rooms', 'Dapat melihat daftar kamar'),
  
  -- Customer Management
  ('manage_customers', 'Dapat mengelola data pelanggan'),
  ('view_customers', 'Dapat melihat data pelanggan'),
  
  -- Financial
  ('manage_income', 'Dapat mengelola pemasukan'),
  ('manage_expense', 'Dapat mengelola pengeluaran'),
  ('view_reports', 'Dapat melihat laporan keuangan'),
  
  -- Product Management
  ('manage_products', 'Dapat mengelola produk/layanan'),
  ('view_products', 'Dapat melihat daftar produk'),
  
  -- Store Management
  ('manage_stores', 'Dapat mengelola data toko/cabang'),
  ('view_stores', 'Dapat melihat data toko/cabang'),
  
  -- User & Permission Management
  ('manage_users', 'Dapat mengelola pengguna'),
  ('manage_permissions', 'Dapat mengelola hak akses'),
  
  -- Settings
  ('manage_settings', 'Dapat mengubah pengaturan sistem'),
  ('view_activity_logs', 'Dapat melihat log aktivitas')
ON CONFLICT (name) DO NOTHING;