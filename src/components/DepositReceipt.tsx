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

export default function DepositReceipt() {
  const [searchParams] = useSearchParams();
  const depositId = searchParams.get("id");

  const [isLoading, setIsLoading] = useState(true);
  const [deposit, setDeposit] = useState<Record<string, any> | null>(null);
  const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
  const [storeName, setStoreName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [isReprint, setIsReprint] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (depositId) fetchData();
  }, [depositId]);

  const fetchData = async () => {
    if (!depositId) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("room_deposits")
        .select("*")
        .eq("id", depositId)
        .single();

      if (error) throw error;
      setDeposit(data);

      // Check if reprint (print_count >= 1 means this is at least 2nd print)
      const currentPrintCount = data.print_count || 0;
      setIsReprint(currentPrintCount >= 1);

      // Increment print_count
      await supabase
        .from("room_deposits")
        .update({ print_count: currentPrintCount + 1 })
        .eq("id", depositId);

      const storeId = data.store_id;
      const roomId = data.room_id;

      // Fetch store name, room name, print settings, creator in parallel
      const [storeRes, roomRes, settingsRes, profileRes] = await Promise.all([
        storeId
          ? supabase.from("stores").select("name").eq("id", storeId).single()
          : null,
        roomId
          ? supabase.from("rooms").select("name").eq("id", roomId).single()
          : null,
        storeId
          ? supabase.from("print_settings").select("*").eq("store_id", storeId).maybeSingle()
          : null,
        data.created_by
          ? supabase.from("profiles").select("name").eq("id", data.created_by).single()
          : null,
      ]);

      setStoreName(storeRes?.data?.name || "");
      setRoomName(roomRes?.data?.name || "");
      setCreatorName(profileRes?.data?.name || "-");

      setPrintSettings(settingsRes?.data || {
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

  if (!deposit) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-muted-foreground">Deposit tidak ditemukan</p>
      </div>
    );
  }

  const isUang = deposit.deposit_type === "uang";

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
        {/* Reprint Label */}
        {isReprint && (
          <div className="text-center mb-2">
            <span
              style={{
                fontSize: isSmall ? "10px" : "12px",
                fontWeight: "bold",
                color: "#dc2626",
                border: "1px solid #dc2626",
                padding: "2px 8px",
                borderRadius: "4px",
              }}
            >
              REPRINT
            </span>
          </div>
        )}

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

        {/* Title */}
        <div className="text-center mb-2">
          <p className="font-bold" style={{ fontSize: isSmall ? "11px" : "13px" }}>
            NOTA DEPOSIT
          </p>
          <p className="text-gray-600" style={{ fontSize: isSmall ? "9px" : "10px" }}>
            {format(new Date(deposit.created_at), "dd/MM/yyyy HH:mm", { locale: idLocale })}
          </p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" style={{ borderTopWidth: "1px" }} />

        {/* Deposit Details */}
        <div className="mb-2" style={{ fontSize: isSmall ? "9px" : "11px" }}>
          <div className="flex justify-between">
            <span>Kamar:</span>
            <span className="font-semibold">{roomName}</span>
          </div>
          <div className="flex justify-between">
            <span>Jenis Deposit:</span>
            <span className="font-semibold">{isUang ? "Uang" : "Identitas"}</span>
          </div>

          {isUang && deposit.amount && (
            <div className="flex justify-between">
              <span>Nominal:</span>
              <span className="font-semibold">{formatCurrency(deposit.amount)}</span>
            </div>
          )}

          {!isUang && (
            <>
              <div className="flex justify-between">
                <span>Jenis Identitas:</span>
                <span className="font-semibold">{deposit.identity_type || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Nama Pemilik:</span>
                <span className="font-semibold">{deposit.identity_owner_name || "-"}</span>
              </div>
            </>
          )}

          {deposit.notes && (
            <div className="flex justify-between">
              <span>Catatan:</span>
              <span className="text-right">{deposit.notes}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span>Status:</span>
            <span className="font-semibold">
              {deposit.status === "active" ? "Aktif" : "Dikembalikan"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Dibuat oleh:</span>
            <span>{creatorName}</span>
          </div>
        </div>

        {isUang && deposit.amount && (
          <>
            <div className="border-t border-dashed border-gray-400 my-2" style={{ borderTopWidth: "1px" }} />
            <div className="mb-2 font-bold" style={{ fontSize: isSmall ? "11px" : "13px" }}>
              <div className="flex justify-between">
                <span>TOTAL DEPOSIT</span>
                <span>{formatCurrency(deposit.amount)}</span>
              </div>
            </div>
          </>
        )}

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
