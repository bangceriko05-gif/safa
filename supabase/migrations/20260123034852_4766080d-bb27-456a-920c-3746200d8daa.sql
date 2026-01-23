-- Add permissions for Auth Orphans and User Orphan features
INSERT INTO public.permissions (name, description) VALUES 
  ('view_auth_orphans', 'Dapat melihat dan mengelola Auth Orphans (akun tanpa profil)'),
  ('view_user_orphans', 'Dapat melihat dan mengelola User Orphans (pengguna tanpa akses cabang)')
ON CONFLICT (name) DO NOTHING;