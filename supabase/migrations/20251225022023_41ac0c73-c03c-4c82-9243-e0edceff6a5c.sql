-- Add new permissions for cancel checkout and delete bookings
INSERT INTO permissions (name, description) 
VALUES 
  ('cancel_checkout_bookings', 'Dapat membatalkan booking yang sudah checkout'),
  ('delete_bookings', 'Dapat menghapus booking')
ON CONFLICT (name) DO NOTHING;

-- Assign these permissions to admin role by default
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE name IN ('cancel_checkout_bookings', 'delete_bookings')
ON CONFLICT DO NOTHING;