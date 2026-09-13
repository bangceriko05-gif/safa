import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Globe, ImageIcon, Loader2, Search, ShoppingBag } from "lucide-react";

type WebsiteProduct = {
  id: string;
  name: string;
  price: number | null;
  images: unknown;
  is_active: boolean;
  show_on_website: boolean;
  category_id: string | null;
};

type WebsiteOrder = {
  id: string;
  bid: string | null;
  date: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number | null;
  payment_status: string | null;
  process_status: string | null;
  order_source: string | null;
};

function formatPrice(value: number | null) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function firstImage(images: unknown): string | null {
  if (Array.isArray(images)) {
    const found = images.find((i) => typeof i === "string" && i.length > 0);
    return typeof found === "string" ? found : null;
  }
  return typeof images === "string" && images ? images : null;
}

export default function WebsiteManagement({ section }: { section: "storefront" | "orders" }) {
  const { currentStore } = useStore();
  const storeId = currentStore?.id;
  const [products, setProducts] = useState<WebsiteProduct[]>([]);
  const [orders, setOrders] = useState<WebsiteOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shopUrl = useMemo(() => {
    const slug = (currentStore as any)?.slug;
    if (!slug) return null;
    return `${window.location.origin}/shop/${slug}`;
  }, [currentStore]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      if (section === "storefront") {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, price, images, is_active, show_on_website, category_id")
          .eq("store_id", storeId)
          .order("name");
        if (!active) return;
        if (error) toast.error("Gagal memuat produk");
        else setProducts((data || []) as WebsiteProduct[]);
      } else {
        const { data, error } = await supabase
          .from("booking_orders")
          .select("id, bid, date, customer_name, customer_phone, total_amount, payment_status, process_status, order_source")
          .eq("store_id", storeId)
          .in("order_source", ["website", "barcode"])
          .order("date", { ascending: false })
          .limit(300);
        if (!active) return;
        if (error) toast.error("Gagal memuat transaksi website");
        else setOrders((data || []) as WebsiteOrder[]);
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [storeId, section]);

  const toggleShow = async (product: WebsiteProduct) => {
    setSavingId(product.id);
    const next = !product.show_on_website;
    const { error } = await supabase
      .from("products")
      .update({ show_on_website: next })
      .eq("id", product.id);
    setSavingId(null);
    if (error) {
      toast.error("Gagal menyimpan perubahan");
      return;
    }
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, show_on_website: next } : p)));
    toast.success(next ? `${product.name} tampil di website` : `${product.name} disembunyikan dari website`);
  };

  const copyLink = async () => {
    if (!shopUrl) return;
    await navigator.clipboard.writeText(shopUrl);
    setCopied(true);
    toast.success("Link halaman toko disalin");
    setTimeout(() => setCopied(false), 1500);
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID")),
  );

  const filteredOrders = orders.filter((o) => {
    const q = query.trim().toLocaleLowerCase("id-ID");
    if (!q) return true;
    return [o.bid, o.customer_name, o.customer_phone].some((v) => v?.toLocaleLowerCase("id-ID").includes(q));
  });

  if (loading) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (section === "storefront") {
    const shownCount = products.filter((p) => p.show_on_website && p.is_active).length;
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-primary" />
              Halaman Toko Online
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {shownCount} produk sedang tampil di halaman toko online outlet ini.
            </p>
            {shopUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-md border bg-muted px-3 py-2 text-sm font-semibold">{shopUrl}</code>
                <Button variant="outline" size="sm" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  Salin Link
                </Button>
                <Button asChild size="sm">
                  <a href={shopUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Buka Halaman
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Halaman toko belum tersedia untuk outlet ini.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Produk yang Tampil di Website</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari produk..."
                className="pl-9"
              />
            </div>
            {filteredProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada produk yang cocok.</p>
            ) : (
              <div className="divide-y rounded-md border">
                {filteredProducts.map((product) => {
                  const image = firstImage(product.images);
                  return (
                    <div key={product.id} className="flex items-center gap-3 p-3">
                      {image ? (
                        <img src={image} alt={product.name} loading="lazy" className="h-12 w-12 rounded-md border object-cover" />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{formatPrice(product.price)}</p>
                      </div>
                      {!product.is_active && <Badge variant="secondary">Nonaktif</Badge>}
                      <Switch
                        checked={product.show_on_website}
                        onCheckedChange={() => toggleShow(product)}
                        disabled={savingId === product.id}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingBag className="h-5 w-5 text-primary" />
          Transaksi dari Website
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari BID, nama, atau nomor telepon..."
            className="pl-9"
          />
        </div>
        {filteredOrders.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Belum ada transaksi dari website.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {filteredOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => window.open(`/pos-order/${order.id}`, "_blank")}
                className="flex w-full flex-wrap items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-foreground">{order.bid || "-"}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.date || "-"} · {order.customer_name || "Tanpa nama"}
                    {order.customer_phone ? ` · ${order.customer_phone}` : ""}
                  </p>
                </div>
                <Badge variant="outline">{order.order_source === "barcode" ? "Barcode Kamar" : "Website"}</Badge>
                <Badge variant={order.payment_status === "LUNAS" ? "default" : "secondary"}>
                  {order.payment_status || "-"}
                </Badge>
                <span className="font-bold">{formatPrice(order.total_amount)}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
