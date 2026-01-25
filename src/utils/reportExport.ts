import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export const formatCurrencyPlain = (amount: number): string => {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
  }).format(amount);
};

export const exportToExcel = (
  data: Record<string, unknown>[],
  sheetName: string,
  fileName: string
) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportMultipleSheets = (
  sheets: { name: string; data: Record<string, unknown>[] }[],
  fileName: string
) => {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(sheet => {
    if (sheet.data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.substring(0, 31));
    }
  });
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const getExportFileName = (reportType: string, storeName: string, dateRange: string): string => {
  const sanitizedStore = storeName.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
  return `${reportType}_${sanitizedStore}_${dateRange}_${timestamp}`;
};

// Sales Report Export
export interface SalesExportData {
  bookings: {
    bid: string;
    customer_name: string;
    room_name: string;
    date: string;
    duration: number;
    price: number;
    price_2: number;
    payment_method: string;
    payment_method_2: string;
    status: string;
    source: string;
  }[];
  expenses: {
    description: string;
    category: string;
    amount: number;
    date: string;
  }[];
  products: {
    product_name: string;
    quantity: number;
    subtotal: number;
    booking_id: string;
  }[];
  summary: {
    total_booking: number;
    total_revenue: number;
    walk_in_count: number;
    walk_in_revenue: number;
    ota_count: number;
    ota_revenue: number;
    cancelled_count: number;
    cancelled_revenue: number;
    total_expenses: number;
    net_profit: number;
    product_sales_count: number;
    product_sales_revenue: number;
  };
}

export const exportSalesReport = (data: SalesExportData, storeName: string, dateRange: string) => {
  const summarySheet = [{
    'Ringkasan': 'Laporan Penjualan',
    'Periode': dateRange,
    'Cabang': storeName,
    '': '',
  }, {
    'Ringkasan': 'Total Booking',
    'Periode': data.summary.total_booking,
  }, {
    'Ringkasan': 'Total Pendapatan',
    'Periode': `Rp ${formatCurrencyPlain(data.summary.total_revenue)}`,
  }, {
    'Ringkasan': 'Walk-in',
    'Periode': `${data.summary.walk_in_count} booking (Rp ${formatCurrencyPlain(data.summary.walk_in_revenue)})`,
  }, {
    'Ringkasan': 'OTA',
    'Periode': `${data.summary.ota_count} booking (Rp ${formatCurrencyPlain(data.summary.ota_revenue)})`,
  }, {
    'Ringkasan': 'Dibatalkan',
    'Periode': `${data.summary.cancelled_count} booking (Rp ${formatCurrencyPlain(data.summary.cancelled_revenue)})`,
  }, {
    'Ringkasan': 'Total Pengeluaran',
    'Periode': `Rp ${formatCurrencyPlain(data.summary.total_expenses)}`,
  }, {
    'Ringkasan': 'Laba Bersih',
    'Periode': `Rp ${formatCurrencyPlain(data.summary.net_profit)}`,
  }, {
    'Ringkasan': 'Penjualan Produk',
    'Periode': `${data.summary.product_sales_count} item (Rp ${formatCurrencyPlain(data.summary.product_sales_revenue)})`,
  }];

  const bookingsSheet = data.bookings.map(b => ({
    'No. Booking': b.bid,
    'Nama Pelanggan': b.customer_name,
    'Kamar': b.room_name,
    'Tanggal': b.date,
    'Durasi (jam)': b.duration,
    'Harga': b.price,
    'Harga 2': b.price_2,
    'Total': b.price + b.price_2,
    'Metode Bayar 1': b.payment_method || '-',
    'Metode Bayar 2': b.payment_method_2 || '-',
    'Status': b.status || 'Aktif',
    'Sumber': b.source,
  }));

  const expensesSheet = data.expenses.map(e => ({
    'Deskripsi': e.description,
    'Kategori': e.category,
    'Jumlah': e.amount,
    'Tanggal': e.date,
  }));

  const productsSheet = data.products.map(p => ({
    'Nama Produk': p.product_name,
    'Qty': p.quantity,
    'Subtotal': p.subtotal,
  }));

  exportMultipleSheets([
    { name: 'Ringkasan', data: summarySheet },
    { name: 'Daftar Booking', data: bookingsSheet },
    { name: 'Pengeluaran', data: expensesSheet },
    { name: 'Penjualan Produk', data: productsSheet },
  ], getExportFileName('Laporan_Penjualan', storeName, dateRange));
};

// Income/Expense Report Export
export interface IncomeExpenseExportData {
  incomes: {
    customer_name: string;
    description: string;
    amount: number;
    payment_method: string;
    date: string;
    creator_name: string;
  }[];
  expenses: {
    description: string;
    category: string;
    amount: number;
    date: string;
    creator_name: string;
  }[];
  summary: {
    total_incomes: number;
    total_expenses: number;
    net_profit: number;
    expense_categories: { category: string; total: number }[];
    income_payment_methods: { method: string; total: number }[];
  };
}

export const exportIncomeExpenseReport = (data: IncomeExpenseExportData, storeName: string, dateRange: string) => {
  const summarySheet = [{
    'Ringkasan': 'Laporan Pemasukan/Pengeluaran',
    'Nilai': dateRange,
  }, {
    'Ringkasan': 'Cabang',
    'Nilai': storeName,
  }, {
    'Ringkasan': '',
    'Nilai': '',
  }, {
    'Ringkasan': 'Total Pemasukan',
    'Nilai': `Rp ${formatCurrencyPlain(data.summary.total_incomes)}`,
  }, {
    'Ringkasan': 'Total Pengeluaran',
    'Nilai': `Rp ${formatCurrencyPlain(data.summary.total_expenses)}`,
  }, {
    'Ringkasan': 'Selisih Bersih',
    'Nilai': `Rp ${formatCurrencyPlain(data.summary.net_profit)}`,
  }, {
    'Ringkasan': '',
    'Nilai': '',
  }, {
    'Ringkasan': '--- Pengeluaran per Kategori ---',
    'Nilai': '',
  }, ...data.summary.expense_categories.map(c => ({
    'Ringkasan': c.category,
    'Nilai': `Rp ${formatCurrencyPlain(c.total)}`,
  })), {
    'Ringkasan': '',
    'Nilai': '',
  }, {
    'Ringkasan': '--- Pemasukan per Metode Bayar ---',
    'Nilai': '',
  }, ...data.summary.income_payment_methods.map(m => ({
    'Ringkasan': m.method,
    'Nilai': `Rp ${formatCurrencyPlain(m.total)}`,
  }))];

  const incomesSheet = data.incomes.map(i => ({
    'Nama Pelanggan': i.customer_name || '-',
    'Deskripsi': i.description || '-',
    'Jumlah': i.amount,
    'Metode Bayar': i.payment_method,
    'Tanggal': i.date,
    'Dibuat Oleh': i.creator_name,
  }));

  const expensesSheet = data.expenses.map(e => ({
    'Deskripsi': e.description,
    'Kategori': e.category,
    'Jumlah': e.amount,
    'Tanggal': e.date,
    'Dibuat Oleh': e.creator_name,
  }));

  exportMultipleSheets([
    { name: 'Ringkasan', data: summarySheet },
    { name: 'Daftar Pemasukan', data: incomesSheet },
    { name: 'Daftar Pengeluaran', data: expensesSheet },
  ], getExportFileName('Laporan_Pemasukan_Pengeluaran', storeName, dateRange));
};

// Purchase Report Export
export interface PurchaseExportData {
  transactions: {
    product_name: string;
    quantity: number;
    product_price: number;
    subtotal: number;
    customer_name: string;
    date: string;
  }[];
  productSales: {
    product_name: string;
    total_quantity: number;
    total_revenue: number;
  }[];
  summary: {
    total_transactions: number;
    total_products_sold: number;
    total_revenue: number;
  };
}

export const exportPurchaseReport = (data: PurchaseExportData, storeName: string, dateRange: string) => {
  const summarySheet = [{
    'Ringkasan': 'Laporan Pembelian Produk',
    'Nilai': dateRange,
  }, {
    'Ringkasan': 'Cabang',
    'Nilai': storeName,
  }, {
    'Ringkasan': '',
    'Nilai': '',
  }, {
    'Ringkasan': 'Total Transaksi',
    'Nilai': data.summary.total_transactions,
  }, {
    'Ringkasan': 'Total Produk Terjual',
    'Nilai': data.summary.total_products_sold,
  }, {
    'Ringkasan': 'Total Pendapatan',
    'Nilai': `Rp ${formatCurrencyPlain(data.summary.total_revenue)}`,
  }];

  const productSalesSheet = data.productSales.map((p, idx) => ({
    'Ranking': idx + 1,
    'Nama Produk': p.product_name,
    'Jumlah Terjual': p.total_quantity,
    'Total Pendapatan': p.total_revenue,
  }));

  const transactionsSheet = data.transactions.map(t => ({
    'Nama Produk': t.product_name,
    'Qty': t.quantity,
    'Harga Satuan': t.product_price,
    'Subtotal': t.subtotal,
    'Pelanggan': t.customer_name || '-',
    'Tanggal': t.date,
  }));

  exportMultipleSheets([
    { name: 'Ringkasan', data: summarySheet },
    { name: 'Produk Terlaris', data: productSalesSheet },
    { name: 'Detail Transaksi', data: transactionsSheet },
  ], getExportFileName('Laporan_Pembelian', storeName, dateRange));
};

// Employee Performance Report Export
export interface EmployeePerformanceExportData {
  performances: {
    rank: number;
    user_name: string;
    rooms_cleaned: number;
    rooms_list: string[];
  }[];
  logs: {
    room_name: string;
    user_name: string;
    date: string;
  }[];
  summary: {
    total_rooms_cleaned: number;
    total_employees: number;
  };
}

export const exportEmployeePerformanceReport = (data: EmployeePerformanceExportData, storeName: string, dateRange: string) => {
  const summarySheet = [{
    'Ringkasan': 'Laporan Kinerja Karyawan',
    'Nilai': dateRange,
  }, {
    'Ringkasan': 'Cabang',
    'Nilai': storeName,
  }, {
    'Ringkasan': '',
    'Nilai': '',
  }, {
    'Ringkasan': 'Total Kamar Dibersihkan',
    'Nilai': data.summary.total_rooms_cleaned,
  }, {
    'Ringkasan': 'Karyawan Aktif',
    'Nilai': data.summary.total_employees,
  }];

  const performancesSheet = data.performances.map(p => ({
    'Ranking': p.rank,
    'Nama Karyawan': p.user_name,
    'Jumlah Kamar': p.rooms_cleaned,
    'Daftar Kamar': p.rooms_list.join(', '),
  }));

  const logsSheet = data.logs.map(l => ({
    'Kamar': l.room_name,
    'Karyawan': l.user_name,
    'Tanggal': l.date,
    'Status': 'Ready',
  }));

  exportMultipleSheets([
    { name: 'Ringkasan', data: summarySheet },
    { name: 'Peringkat Karyawan', data: performancesSheet },
    { name: 'Log Aktivitas', data: logsSheet },
  ], getExportFileName('Laporan_Kinerja', storeName, dateRange));
};
