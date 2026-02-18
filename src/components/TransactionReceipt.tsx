import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PrintSettings {
  paper_size: string;
  logo_url: string | null;
  business_name: string | null;
  business_address: string | null;
  business_phone: string | null;
  manager_name: string | null;
  footer_text: string | null;
  show_logo: boolean;
  show_manager_signature: boolean;
}

interface TransactionProduct {
  product_name: string;
  quantity: number;
  subtotal: number;
}

export default function TransactionReceipt() {
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get("id");
  const type = searchParams.get("type"); // "income" or "expense"

  const [isLoading, setIsLoading] = useState(true);
  const [transaction, setTransaction] = useState<Record<string, any> | null>(null);
  const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
  const [products, setProducts] = useState<TransactionProduct[]>([]);
  const [storeName, setStoreName] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transactionId && type) fetchData();
  }, [transactionId, type]);

  const fetchData = async () => {
    if (!transactionId || !type) return;
    setIsLoading(true);

    try {
      const table = type === "expense" ? "expenses" : "incomes";
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", transactionId)
        .single();

      if (error) throw error;
      setTransaction(data);

      const storeId = data.store_id;

      // Fetch store name
      if (storeId) {
        const { data: storeData } = await supabase
          .from("stores")
          .select("name")
          .eq("id", storeId)
          .single();
        setStoreName(storeData?.name || "");
      }

      // Fetch print settings
      if (storeId) {
        const { data: settingsData } = await supabase
          .from("print_settings")
          .select("*")
          .eq("store_id", storeId)
          .maybeSingle();

        setPrintSettings(settingsData ? settingsData : {
          paper_size: "80mm",
          logo_url: null,
          business_name: null,
          business_address: null,
          business_phone: null,
          manager_name: null,
          footer_text: "Terima kasih atas kunjungan Anda!",
          show_logo: true,
          show_manager_signature: true,
        });
      }

      // Fetch creator name
      if (data.created_by) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", data.created_by)
          .single();
        setCreatorName(profileData?.name || "-");
      }

      // Fetch products for income
      if (type === "income") {
        const { data: productsData } = await supabase
          .from("income_products")
          .select("product_name, quantity, subtotal")
          .eq("income_id", transactionId);
        setProducts(productsData || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const handlePrint = () => window.print();

  const getPaperWidth = () => {
    switch (printSettings?.paper_size) {
      case "58mm": return "58mm";
      case "80mm": return "80mm";
      case "A5": return "148mm";
      case "A4": return "210mm";
      default: return "80mm";
    }
  };

  const isSmall = printSettings?.paper_size === "58mm";

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-muted-foreground">Transaksi tidak ditemukan</p>
      </div>
    );
  }

  const isExpense = type === "expense";
  const notaTitle = isExpense ? "NOTA PENGELUARAN" : "NOTA PEMASUKAN";
  const totalAmount = transaction.amount || 0;

  return (
    <div className="min-h-screen bg-gray-100 p-4 print:p-0 print:bg-white">
      {/* Print Controls */}
      <div className="max-w-md mx-auto mb-4 print:hidden flex gap-2">
        <Button onClick={handlePrint} className="flex-1">🖨️ Print Nota</Button>
        <Button variant="outline" onClick={() => window.close()}>Tutup</Button>
      </div>

      {/* Receipt */}
      <div
        ref={receiptRef}
        className="bg-white mx-auto shadow-lg print:shadow-none"
        style={{
          width: getPaperWidth(),
          maxWidth: "100%",
          padding: isSmall ? "8px" : "16px",
          fontFamily: "monospace",
        }}
      >
        {/* Logo */}
        {printSettings?.show_logo && printSettings?.logo_url && (
          <div className="text-center mb-3">
            <img
              src={printSettings.logo_url}
              alt="Logo"
              className="mx-auto"
              style={{ maxHeight: isSmall ? "40px" : "60px", maxWidth: "80%" }}
            />
          </div>
        )}

        {/* Business Info */}
        <div className="text-center mb-3">
          <h1 className="font-bold" style={{ fontSize: isSmall ? "12px" : "14px" }}>
            {printSettings?.business_name || storeName || "Store"}
          </h1>
          {printSettings?.business_address && (
            <p className="text-gray-600" style={{ fontSize: isSmall ? "9px" : "10px" }}>
              {printSettings.business_address}
            </p>
          )}
          {printSettings?.business_phone && (
            <p className="text-gray-600" style={{ fontSize: isSmall ? "9px" : "10px" }}>
              Tel: {printSettings.business_phone}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-gray-400 my-2" style={{ borderTopWidth: "1px" }} />

        {/* Title & BID */}
        <div className="text-center mb-2">
          <p className="font-bold" style={{ fontSize: isSmall ? "11px" : "13px" }}>{notaTitle}</p>
          {transaction.bid && (
            <p className="font-mono" style={{ fontSize: isSmall ? "10px" : "12px" }}>No: {transaction.bid}</p>
          )}
          <p className="text-gray-600" style={{ fontSize: isSmall ? "9px" : "10px" }}>
            {format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm", { locale: idLocale })}
          </p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" style={{ borderTopWidth: "1px" }} />

        {/* Transaction Details */}
        <div className="mb-2" style={{ fontSize: isSmall ? "9px" : "11px" }}>
          <div className="flex justify-between">
            <span>Tanggal:</span>
            <span>{format(new Date(transaction.date), "dd MMMM yyyy", { locale: idLocale })}</span>
          </div>

          {isExpense ? (
            <>
              <div className="flex justify-between">
                <span>Deskripsi:</span>
                <span className="font-semibold text-right">{transaction.description}</span>
              </div>
              <div className="flex justify-between">
                <span>Kategori:</span>
                <span>{transaction.category || "-"}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span className="font-semibold text-right">{transaction.customer_name || "-"}</span>
              </div>
              {transaction.description && (
                <div className="flex justify-between">
                  <span>Deskripsi:</span>
                  <span className="text-right">{transaction.description}</span>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between">
            <span>Metode Bayar:</span>
            <span>{transaction.payment_method || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span>Dibuat oleh:</span>
            <span>{creatorName}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" style={{ borderTopWidth: "1px" }} />

        {/* Products (income only) */}
        {!isExpense && products.length > 0 && (
          <>
            <div className="mb-2" style={{ fontSize: isSmall ? "9px" : "11px" }}>
              <p className="font-semibold mb-1">Produk:</p>
              {products.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span>{p.product_name} x{p.quantity}</span>
                  <span>{formatCurrency(p.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-gray-400 my-2" style={{ borderTopWidth: "1px" }} />
          </>
        )}

        {/* Total */}
        <div className="mb-2 font-bold" style={{ fontSize: isSmall ? "11px" : "13px" }}>
          <div className="flex justify-between">
            <span>TOTAL</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" style={{ borderTopWidth: "1px" }} />

        {/* Manager Signature */}
        {printSettings?.show_manager_signature && printSettings?.manager_name && (
          <div className="text-center my-4" style={{ fontSize: isSmall ? "9px" : "11px" }}>
            <p className="mb-8">Hormat Kami,</p>
            <p className="border-t border-gray-400 pt-1 inline-block px-4">{printSettings.manager_name}</p>
            <p className="text-gray-600 text-xs">Manager</p>
          </div>
        )}

        {/* Footer */}
        {printSettings?.footer_text && (
          <div className="text-center text-gray-600 mt-3" style={{ fontSize: isSmall ? "8px" : "10px" }}>
            <p>{printSettings.footer_text}</p>
          </div>
        )}

        {/* Powered by */}
        <div className="text-center text-gray-400 mt-2" style={{ fontSize: isSmall ? "7px" : "8px" }}>
          <p>Powered by ANKA PMS</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: ${getPaperWidth()} auto;
            margin: 0;
          }
          body { margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
