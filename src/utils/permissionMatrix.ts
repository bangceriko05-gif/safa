// Action columns for the matrix
export const ACTION_COLUMNS = ["Lihat", "Detail", "Tambah", "Ubah", "Hapus"] as const;

// Matrix structure: maps category > items > action columns to permission names
interface MatrixItem {
  label: string;
  actions: Partial<Record<typeof ACTION_COLUMNS[number], string>>;
}

interface MatrixSubCategory {
  label: string;
  items: MatrixItem[];
}

export interface MatrixCategory {
  label: string;
  subCategories?: MatrixSubCategory[];
  items?: MatrixItem[];
  // standalone permissions that don't fit the matrix (shown as simple checkboxes)
  standalone?: { label: string; permissionName: string }[];
}

const legacyMatrix: MatrixCategory[] = [
  {
    label: "Booking",
    items: [
      { label: "Booking", actions: { Lihat: "view_bookings", Tambah: "create_bookings", Ubah: "edit_bookings", Hapus: "delete_bookings" } },
      { label: "Check-in", actions: { Lihat: "checkin_bookings" } },
      { label: "Check-out", actions: { Lihat: "checkout_bookings" } },
      { label: "Batal Booking", actions: { Lihat: "cancel_bookings" } },
      { label: "Batal Checkout", actions: { Lihat: "cancel_checkout_bookings" } },
      { label: "Kalender", actions: { Lihat: "calendar_view", Ubah: "calendar_manage" } },
      { label: "Harga Dinamis", actions: { Ubah: "booking_price_override" } },
      { label: "Bukti Bayar Booking", actions: { Ubah: "booking_payment_proof_manage" } },
    ],
  },
  {
    label: "Kamar",
    items: [
      { label: "Kamar", actions: { Lihat: "view_rooms", Ubah: "manage_rooms" } },
      { label: "Kategori Kamar", actions: { Ubah: "room_category_manage" } },
      { label: "Varian Kamar", actions: { Ubah: "room_variant_manage" } },
      { label: "Status Kebersihan", actions: { Ubah: "room_status_manage" } },
      { label: "Sumber OTA", actions: { Ubah: "ota_source_manage" } },
    ],
  },
  {
    label: "Pelanggan & CRM",
    items: [
      { label: "Pelanggan", actions: { Lihat: "view_customers", Ubah: "manage_customers" } },
      { label: "CRM", actions: { Lihat: "crm_view", Detail: "crm_detail", Tambah: "crm_create", Ubah: "crm_edit", Hapus: "crm_delete" } },
      { label: "Prediksi Ganda", actions: { Ubah: "crm_merge_duplicates" } },
      { label: "Loyalty", actions: { Ubah: "crm_loyalty_manage" } },
      { label: "Tipe Pelanggan", actions: { Ubah: "crm_customer_type_manage" } },
      { label: "Blast WhatsApp", actions: { Ubah: "crm_whatsapp_blast" } },
      { label: "Identitas Pelanggan", actions: { Lihat: "customer_identity_view", Tambah: "customer_identity_upload" } },
      { label: "Ekspor Pelanggan", actions: { Lihat: "crm_export" } },
    ],
  },
  {
    label: "POS",
    items: [
      { label: "POS", actions: { Lihat: "pos_view", Detail: "pos_order_detail", Tambah: "pos_create_order", Ubah: "pos_edit_order", Hapus: "pos_delete_order" } },
      { label: "Batal Pesanan", actions: { Lihat: "pos_cancel_order" } },
      { label: "Diskon", actions: { Ubah: "pos_discount" } },
      { label: "Pembayaran", actions: { Ubah: "pos_payment_manage" } },
      { label: "Cetak/Kirim Nota", actions: { Lihat: "pos_print_receipt" } },
      { label: "Kategori POS", actions: { Ubah: "pos_manage_categories" } },
      { label: "Pengaturan POS", actions: { Ubah: "pos_settings" } },
    ],
  },
  {
    label: "Produk",
    items: [
      { label: "Produk", actions: { Lihat: "view_products", Detail: "view_product_detail", Tambah: "create_products", Ubah: "manage_products", Hapus: "delete_products" } },
      { label: "Kategori Produk", actions: { Ubah: "product_category_manage" } },
      { label: "Satuan & Konversi", actions: { Ubah: "product_unit_manage" } },
      { label: "Varian Produk", actions: { Ubah: "product_variant_manage" } },
      { label: "Tingkatan Harga", actions: { Ubah: "product_price_tier_manage" } },
      { label: "Resep Produk", actions: { Ubah: "product_recipe_manage" } },
      { label: "Impor Produk", actions: { Tambah: "product_import" } },
      { label: "Ekspor Produk", actions: { Lihat: "product_export" } },
    ],
  },
  {
    label: "Inventori",
    items: [
      { label: "Inventori", actions: { Lihat: "inventory_view" } },
      { label: "Stok Masuk", actions: { Lihat: "stock_in_view", Detail: "stock_in_post", Tambah: "stock_in_create", Ubah: "stock_in_edit", Hapus: "stock_in_delete" } },
      { label: "Batal Stok Masuk", actions: { Lihat: "stock_in_cancel" } },
      { label: "Stok Keluar", actions: { Lihat: "stock_out_view", Detail: "stock_out_post", Tambah: "stock_out_create", Ubah: "stock_out_edit", Hapus: "stock_out_delete" } },
      { label: "Batal Stok Keluar", actions: { Lihat: "stock_out_cancel" } },
      { label: "Stok Opname", actions: { Lihat: "stock_opname_view", Detail: "stock_opname_post", Tambah: "stock_opname_create", Ubah: "stock_opname_edit", Hapus: "stock_opname_delete" } },
      { label: "Batal Stok Opname", actions: { Lihat: "stock_opname_cancel" } },
    ],
  },
  {
    label: "Pembelian & Supplier",
    items: [
      { label: "Pembelian", actions: { Lihat: "purchase_view", Detail: "purchase_detail", Tambah: "purchase_create", Ubah: "purchase_edit", Hapus: "purchase_delete" } },
      { label: "Terima Barang", actions: { Lihat: "purchase_receive" } },
      { label: "Batal Pembelian", actions: { Lihat: "purchase_cancel" } },
      { label: "Supplier", actions: { Lihat: "supplier_view", Tambah: "supplier_create", Ubah: "supplier_edit", Hapus: "supplier_delete" } },
    ],
  },
  {
    label: "Transaksi & Deposit",
    items: [
      { label: "Transaksi", actions: { Lihat: "transaction_view", Detail: "transaction_detail" } },
      { label: "Deposit", actions: { Lihat: "deposit_view", Tambah: "deposit_create", Ubah: "deposit_edit", Hapus: "deposit_delete" } },
      { label: "Refund Deposit", actions: { Ubah: "deposit_refund" } },
      { label: "Cetak Deposit", actions: { Lihat: "deposit_print" } },
    ],
  },
  {
    label: "Laporan",
    items: [
      { label: "Keseluruhan", actions: { Lihat: "report_overview_view", Detail: "report_overview_detail" } },
      { label: "Penjualan", actions: { Lihat: "report_sales_view", Detail: "report_sales_detail" } },
      { label: "Tipe Pelanggan", actions: { Lihat: "report_customer_type_view" } },
      { label: "Okupansi", actions: { Lihat: "report_occupancy_view" } },
      { label: "Pemasukan", actions: { Lihat: "report_income_view", Detail: "report_income_detail", Tambah: "report_income_add", Ubah: "report_income_edit", Hapus: "report_income_delete" } },
      { label: "Pengeluaran", actions: { Lihat: "report_expense_view", Detail: "report_expense_detail", Tambah: "report_expense_add", Ubah: "report_expense_edit", Hapus: "report_expense_delete" } },
      { label: "Pembelian", actions: { Lihat: "report_purchase_view", Detail: "report_purchase_detail" } },
      { label: "Kinerja", actions: { Lihat: "report_performance_view", Detail: "report_performance_detail" } },
      { label: "Pajak", actions: { Lihat: "report_tax_view" } },
      { label: "Akuntansi", actions: { Lihat: "report_accounting_view" } },
      { label: "Ekspor Excel", actions: { Lihat: "report_export_excel" } },
      { label: "Cetak Laporan", actions: { Lihat: "report_print" } },
    ],
    standalone: [
      { label: "Lihat Laporan Keuangan", permissionName: "view_reports" },
      { label: "Kelola Pemasukan", permissionName: "manage_income" },
      { label: "Kelola Pengeluaran", permissionName: "manage_expense" },
    ],
  },
  {
    label: "Akuntansi",
    items: [
      { label: "Akuntansi", actions: { Lihat: "accounting_view" } },
      { label: "Konversi Transaksi", actions: { Ubah: "accounting_transactions_manage" } },
      { label: "Bagan Akun (COA)", actions: { Lihat: "coa_view", Ubah: "coa_manage" } },
      { label: "Jurnal Umum", actions: { Lihat: "journal_view", Tambah: "journal_create", Hapus: "journal_delete" } },
      { label: "Arus Kas", actions: { Lihat: "cashflow_view" } },
      { label: "Bank", actions: { Lihat: "bank_view", Ubah: "bank_manage" } },
      { label: "Aset", actions: { Lihat: "asset_view", Ubah: "asset_manage" } },
      { label: "Hutang Usaha", actions: { Lihat: "ap_view", Ubah: "ap_manage" } },
      { label: "Piutang Usaha", actions: { Lihat: "ar_view", Ubah: "ar_manage" } },
      { label: "Neraca", actions: { Lihat: "balance_sheet_view" } },
      { label: "Laba Rugi", actions: { Lihat: "profit_loss_view" } },
      { label: "Transfer Investor", actions: { Ubah: "investor_transfer_manage" } },
      { label: "Log Akuntansi", actions: { Lihat: "accounting_activity_log_view" } },
    ],
  },
  {
    label: "Toko & Pengaturan",
    items: [
      { label: "Toko", actions: { Lihat: "view_stores", Detail: "view_store_detail", Tambah: "create_stores", Ubah: "manage_stores", Hapus: "delete_stores" } },
      { label: "Pengaturan", actions: { Lihat: "manage_settings" } },
      { label: "Tampilan", actions: { Ubah: "settings_display" } },
      { label: "Warna Status", actions: { Ubah: "settings_colors" } },
      { label: "Notifikasi", actions: { Ubah: "settings_notifications" } },
      { label: "Cetak", actions: { Ubah: "settings_print" } },
      { label: "Metode Pembayaran", actions: { Ubah: "settings_payment_methods" } },
      { label: "Pajak & Service", actions: { Ubah: "settings_tax" } },
      { label: "Outlet", actions: { Ubah: "settings_outlet" } },
      { label: "OTA", actions: { Ubah: "settings_ota" } },
      { label: "Impor Data", actions: { Tambah: "data_import" } },
      { label: "Ekspor Data", actions: { Lihat: "data_export" } },
    ],
  },
  {
    label: "Pengguna & Keamanan",
    items: [
      { label: "Pengguna", actions: { Lihat: "manage_users", Tambah: "user_create", Ubah: "user_edit", Hapus: "user_delete" } },
      { label: "Reset Password", actions: { Ubah: "user_reset_password" } },
      { label: "Akses Cabang", actions: { Ubah: "user_store_access_manage" } },
      { label: "Permission", actions: { Lihat: "manage_permissions" } },
      { label: "Log Aktivitas", actions: { Lihat: "view_activity_logs" } },
      { label: "Auth Orphans", actions: { Lihat: "view_auth_orphans" } },
      { label: "User Orphans", actions: { Lihat: "view_user_orphans" } },
    ],
  },
  {
    label: "Super Admin",
    items: [
      { label: "Kelola Outlet", actions: { Ubah: "superadmin_store_manage" } },
      { label: "Fitur Outlet", actions: { Ubah: "superadmin_feature_toggle" } },
      { label: "Langganan", actions: { Ubah: "superadmin_subscription_manage" } },
      { label: "Duplikasi Outlet", actions: { Ubah: "superadmin_store_duplication" } },
      { label: "Landing Page", actions: { Ubah: "superadmin_landing_page" } },
      { label: "Permintaan Demo", actions: { Ubah: "superadmin_demo_requests" } },
    ],
  },
];



// Presentation only: keep stored permission names and authorization unchanged.
const category = (label: string) => legacyMatrix.find(c => c.label === label);
const items = (label: string) => category(label)?.items ?? [];
const take = (label: string, names: string[]) => items(label).filter(i => names.includes(i.label));
const omit = (label: string, names: string[]) => items(label).filter(i => !names.includes(i.label));

export const permissionMatrix: MatrixCategory[] = [
  { label: "POS Kasir", items: omit("POS", ["Pengaturan POS"]) },
  { label: "Kalender", items: items("Booking") },
  { label: "Transaksi", items: items("Transaksi & Deposit") },
  { label: "Produk & Inventori", subCategories: [
    { label: "Produk", items: items("Produk") },
    { label: "Inventori", items: items("Inventori") },
    { label: "Kamar", items: omit("Kamar", ["Sumber OTA"]) },
  ] },
  { label: "Website", subCategories: [
    { label: "Tampilan Website Toko", items: [] },
    { label: "Transaksi dari Website", items: [] },
    { label: "Metode Pembayaran", items: [] },
    { label: "Settingan Kamar (Barcode)", items: [] },
  ] },
  { label: "Pelanggan", subCategories: [
    { label: "Pelanggan", items: take("Pelanggan & CRM", ["Pelanggan", "Identitas Pelanggan"]) },
    { label: "Supplier", items: take("Pembelian & Supplier", ["Supplier"]) },
    { label: "CRM", items: omit("Pelanggan & CRM", ["Pelanggan", "Identitas Pelanggan"]) },
  ] },
  { label: "Log", items: take("Pengguna & Keamanan", ["Log Aktivitas"]) },
  { label: "Pengguna", subCategories: [
    { label: "Manajemen Pengguna", items: take("Pengguna & Keamanan", ["Pengguna", "Reset Password", "Akses Cabang"]) },
    { label: "Manajemen Permission", items: take("Pengguna & Keamanan", ["Permission"]) },
  ] },
  { label: "Laporan", items: items("Laporan"), standalone: category("Laporan")?.standalone,
    subCategories: [{ label: "Akuntansi", items: items("Akuntansi") }] },
  { label: "Pengaturan", items: [
    { label: "Pengaturan", actions: { Lihat: "manage_settings" } },
    { label: "Tampilan", actions: { Ubah: "settings_display" } },
    { label: "Warna", actions: { Ubah: "settings_colors" } },
    { label: "Notifikasi", actions: { Ubah: "settings_notifications" } },
    { label: "Pesan WhatsApp", actions: { Ubah: "settings_whatsapp" } },
    { label: "Nota", actions: { Ubah: "settings_print" } },
    { label: "Printer", actions: { Ubah: "settings_printer" } },
    { label: "Kamar", actions: { Ubah: "settings_rooms" } },
    { label: "OTA", actions: { Ubah: "settings_ota" } },
    { label: "Metode Bayar", actions: { Ubah: "settings_payment_methods" } },
    { label: "PPN", actions: { Ubah: "settings_tax" } },
    { label: "POS", actions: { Ubah: "pos_settings" } },
    { label: "Outlet", actions: { Ubah: "settings_outlet" } },
  ] },
  { label: "DOKU", subCategories: [
    { label: "Transaksi", items: [] },
    { label: "Settlement", items: [] },
    { label: "Pengaturan", items: [] },
  ] },
  { label: "Super Admin", items: [...items("Super Admin"), ...take("Pengguna & Keamanan", ["Auth Orphans", "User Orphans"])] },
  // Legacy keys remain editable without presenting removed modules as live navigation.
  { label: "Izin tambahan", items: [
    ...omit("Pembelian & Supplier", ["Supplier"]),
    ...take("Toko & Pengaturan", ["Toko", "Impor Data", "Ekspor Data"]),
    ...take("Kamar", ["Sumber OTA"]),
  ] },
];

export function getAllMatrixPermissionNames(matrix = permissionMatrix): string[] {
  return [...new Set(matrix.flatMap(cat => [
    ...(cat.items ?? []).flatMap(item => Object.values(item.actions)),
    ...(cat.subCategories ?? []).flatMap(sub => sub.items.flatMap(item => Object.values(item.actions))),
    ...(cat.standalone ?? []).map(item => item.permissionName),
  ]).filter((name): name is string => typeof name === "string"))];
}
