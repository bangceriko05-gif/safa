import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { IdCard, ExternalLink, Loader2, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import IdentityUploadCard from "@/components/booking/IdentityUploadCard";

interface Props {
  storeId?: string;
  name: string;
  phone: string;
}

interface CrmData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  domicile: string | null;
  created_at: string;
  identity_type: string | null;
  identity_number: string | null;
  identity_document_url: string | null;
  visits: number;
  totalSpend: number;
  lastVisit: string | null;
}

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n || 0));

// Session-level caches so re-opening a booking shows CRM data instantly.
const crmCache = new Map<string, CrmData>();
const signedUrlCache = new Map<string, { thumb: string; full: string }>();

const segmentOf = (visits: number, spend: number) => {
  if (spend >= 5_000_000 || visits >= 10) return "VIP";
  if (visits >= 3) return "Loyal";
  return "Baru";
};

export default function BookingCustomerCRMCard({ storeId, name, phone }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [crm, setCrm] = useState<CrmData | null>(null);
  const [idThumbUrl, setIdThumbUrl] = useState<string | null>(null);
  const [idFullUrl, setIdFullUrl] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Resolve identity document (stored as a storage path) into signed URLs.
  // A small transformed thumbnail loads fast; the full URL is pre-signed so
  // "Lihat Identitas" opens instantly without waiting for a request.
  useEffect(() => {
    let cancelled = false;
    const path = crm?.identity_document_url || "";
    if (!path) {
      setIdThumbUrl(null);
      setIdFullUrl(null);
      return;
    }

    if (path.startsWith("http")) {
      setIdThumbUrl(path);
      setIdFullUrl(path);
      return;
    }

    const cachedUrl = signedUrlCache.get(path);
    if (cachedUrl) {
      setIdThumbUrl(cachedUrl.thumb);
      setIdFullUrl(cachedUrl.full);
      return;
    }
    setIdThumbUrl(null);
    setIdFullUrl(null);

    const run = async () => {
      const [thumb, full] = await Promise.all([
        supabase.storage
          .from("identity-documents")
          .createSignedUrl(path, 3600, { transform: { width: 320, quality: 50 } } as any),
        supabase.storage.from("identity-documents").createSignedUrl(path, 3600),
      ]);
      const fullUrl = full.data?.signedUrl || null;
      const thumbUrl = thumb.data?.signedUrl || fullUrl;
      if (fullUrl && thumbUrl) signedUrlCache.set(path, { thumb: thumbUrl, full: fullUrl });
      if (cancelled) return;
      setIdFullUrl(fullUrl);
      setIdThumbUrl(thumbUrl);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [crm?.identity_document_url]);

  useEffect(() => {
    let cancelled = false;
    const cleanPhoneKey = (phone || "").trim();
    const cleanNameKey = (name || "").trim();
    const cacheKey = `${storeId || ""}|${cleanPhoneKey || cleanNameKey.toLowerCase()}`;
    const cached = crmCache.get(cacheKey);
    if (cached) {
      setCrm(cached);
      setLoading(false);
    }
    const run = async () => {
      const cleanPhone = (phone || "").trim();
      const cleanName = (name || "").trim();
      if (!storeId || (!cleanPhone && !cleanName)) {
        setCrm(null);
        return;
      }
      if (!cached) setLoading(true);
      try {
        let query = supabase
          .from("customers")
          .select(
            "id, name, phone, email, birth_date, domicile, created_at, identity_type, identity_number, identity_document_url"
          )
          .eq("store_id", storeId)
          .limit(1);
        query = cleanPhone ? query.eq("phone", cleanPhone) : query.ilike("name", cleanName);
        const { data } = await query;
        const cust = data?.[0];
        if (!cust) {
          if (!cancelled) {
            crmCache.delete(cacheKey);
            setCrm(null);
          }
          return;
        }

        // Render identity + profile immediately; aggregates stream in after.
        const base: CrmData = {
          ...(cust as any),
          visits: cached?.visits ?? 0,
          totalSpend: cached?.totalSpend ?? 0,
          lastVisit: cached?.lastVisit ?? null,
        };
        if (!cancelled) {
          setCrm(base);
          setLoading(false);
        }

        const [{ data: bookings }, { data: orders }] = await Promise.all([
          supabase
            .from("bookings")
            .select("total_amount, check_in, status")
            .eq("store_id", storeId)
            .eq("phone", cust.phone),
          supabase
            .from("booking_orders")
            .select("total_amount, date, customer_phone")
            .eq("store_id", storeId)
            .eq("customer_phone", cust.phone),
        ]);

        const rows = [
          ...(bookings || [])
            .filter((b: any) => b.status !== "batal")
            .map((b: any) => ({ amount: Number(b.total_amount || 0), date: b.check_in })),
          ...(orders || []).map((o: any) => ({ amount: Number(o.total_amount || 0), date: o.date })),
        ];
        const totalSpend = rows.reduce((s, r) => s + r.amount, 0);
        const lastVisit = rows
          .map((r) => r.date)
          .filter(Boolean)
          .sort()
          .pop() as string | undefined;

        const full: CrmData = {
          ...base,
          visits: rows.length,
          totalSpend,
          lastVisit: lastVisit || null,
        };
        crmCache.set(cacheKey, full);
        if (!cancelled) setCrm(full);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, cached ? 0 : 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [storeId, name, phone, refreshKey]);

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b last:border-b-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );

  if (loading)
    return (
      <div className="rounded-lg border bg-card p-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat data CRM pelanggan...
      </div>
    );

  if (!crm || !crm.identity_document_url)
    return (
      <div className="space-y-2">
        {!crm && (
          <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground flex items-center gap-2">
            <UserRound className="h-4 w-4" /> Pelanggan belum terdaftar di database CRM.
          </div>
        )}
        <IdentityUploadCard
          storeId={storeId}
          customerId={crm?.id ?? null}
          name={name}
          phone={phone}
          onUploaded={() => {
            crmCache.clear();
            setRefreshKey((k) => k + 1);
          }}
        />
      </div>
    );

  const segment = segmentOf(crm.visits, crm.totalSpend);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-sm font-semibold text-blue-600 hover:underline"
          onClick={() =>
            navigate(
              `/?tab=customers&customersSection=crm&crmCustomer=${crm.id}` +
                `&crmPhone=${encodeURIComponent(crm.phone || "")}` +
                `&crmName=${encodeURIComponent(crm.name || "")}`
            )
          }
        >
          CRM Pelanggan
        </button>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{segment}</Badge>
          <Badge variant="outline">{fmt(crm.visits)} transaksi</Badge>
        </div>
      </div>

      <div className="px-3 py-2">
        <Row label="Total Belanja" value={`Rp ${fmt(crm.totalSpend)}`} />
        <Row
          label="Kunjungan Terakhir"
          value={crm.lastVisit ? format(new Date(crm.lastVisit), "dd-MM-yyyy") : "-"}
        />
        <Row label="Email" value={crm.email || "-"} />
        <Row label="Domisili" value={crm.domicile || "-"} />
        <Row
          label="Tanggal Lahir"
          value={crm.birth_date ? format(new Date(crm.birth_date), "dd-MM-yyyy") : "-"}
        />
      </div>

      <div className="px-3 py-2 border-t bg-muted/40">
        <div className="flex items-center gap-2 text-sm font-semibold mb-1">
          <IdCard className="h-4 w-4" /> Identitas
        </div>
        <Row label="Jenis Identitas" value={crm.identity_type || "-"} />
        <Row
          label="Nomor Identitas"
          value={<span className="tabular-nums">{crm.identity_number || "-"}</span>}
        />
        {crm.identity_document_url && (
          <div className="pt-2 space-y-2">
            {idThumbUrl ? (
              <button
                type="button"
                onClick={() => idFullUrl && window.open(idFullUrl, "_blank")}
                className="block w-full rounded-md border bg-background overflow-hidden"
                title="Klik untuk memperbesar"
              >
                <img
                  src={idThumbUrl}
                  alt={`Foto identitas ${crm.name}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto max-h-72 object-contain bg-muted"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    if (idFullUrl && img.src !== idFullUrl) img.src = idFullUrl;
                    else img.style.display = "none";
                  }}
                />
              </button>
            ) : (
              <div className="w-full h-24 rounded-md border bg-muted animate-pulse" />
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={!idFullUrl}
              onClick={() => idFullUrl && window.open(idFullUrl, "_blank")}
            >
              <ExternalLink className="h-3 w-3 mr-1" /> Lihat Identitas
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
