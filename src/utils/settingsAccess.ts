export const SETTINGS_PERMISSIONS = {
  display: "settings_display",
  colors: "settings_colors",
  notifications: "settings_notifications",
  whatsapp: "settings_whatsapp",
  print: "settings_print",
  "printer-driver": "settings_printer",
  rooms: "settings_rooms",
  ota: "settings_ota",
  "payment-methods": "settings_payment_methods",
  tax: "settings_tax",
  pos: "pos_settings",
  outlet: "settings_outlet",
} as const;

export function canAccessSettingsTab(tab: string, hasPermission: (name: string) => boolean): boolean {
  const permission = SETTINGS_PERMISSIONS[tab as keyof typeof SETTINGS_PERMISSIONS];
  return Boolean(permission && hasPermission(permission));
}

export function canOpenSettings(hasPermission: (name: string) => boolean): boolean {
  return hasPermission("manage_settings") || Object.values(SETTINGS_PERMISSIONS).some(hasPermission);
}