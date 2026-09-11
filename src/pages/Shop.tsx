import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Building2,
  ImageIcon,
  Loader2,
  MapPin,
  Search,
  ShoppingBag,
  Store,
} from "lucide-react";

type CatalogRow = {
  store_id: string;
  store_name: string;
  store_slug: string;
  store_description: string | null;
  store_location: string | null;
  store_image_url: string | null;
  product_id: string;
  product_name: string;
  product_description: string | null;
  product_price: number;
  product_images: unknown;
  product_stock: number;
  track_inventory: boolean;
  category_id: string | null;
  category_name: string | null;
  variant_id: string | null;
  variant_name: string | null;
  variant_price: number | null;
  variant_stock: number | null;
};

type CatalogItem = CatalogRow & {
  key: string;
  displayName: string;
  displayPrice: number;
  displayStock: number;
  imageUrl: string | null;
};

const ALL = "all";

function getFirstImage(images: unknown): string | null {
  if (Array.isArray(images)) {
    const first = images.find((image) => typeof image === "string" && image.length > 0);
    return typeof first === "string" ? first : null;
  }
  if (typeof images === "string" && images.length > 0) return images;
  return null;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function Shop() {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storeId, setStoreId] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      const { data, error: catalogError } = await supabase.rpc("get_public_shop_catalog");
      if (!active) return;
      if (catalogError) {
        console.error("Error loading public catalog:", catalogError);
        setError("Katalog belum dapat dimuat. Silakan coba lagi.");
      } else {
        setRows((data || []) as CatalogRow[]);
      }
      setLoading(false);
    };
    void loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  const stores = useMemo(() => {
    const map = new Map<string, CatalogRow>();
    rows.forEach((row) => map.set(row.store_id, row));
    return Array.from(map.values());
  }, [rows]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if ((storeId === ALL || row.store_id === storeId) && row.category_id && row.category_name) {
        map.set(row.category_id, row.category_name);
      }
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, storeId]);

  const items = useMemo<CatalogItem[]>(() => {
    const productsWithVariants = new Set(rows.filter((row) => row.variant_id).map((row) => row.product_id));
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");

    return rows
      .filter((row) => !productsWithVariants.has(row.product_id) || Boolean(row.variant_id))
      .map((row) => ({
        ...row,
        key: row.variant_id || row.product_id,
        displayName: row.variant_name ? `${row.product_name} — ${row.variant_name}` : row.product_name,
        displayPrice: row.variant_id ? Number(row.variant_price || 0) : Number(row.product_price || 0),
        displayStock: row.variant_id ? Number(row.variant_stock || 0) : Number(row.product_stock || 0),
        imageUrl: getFirstImage(row.product_images),
      }))
      .filter((item) => storeId === ALL || item.store_id === storeId)
      .filter((item) => categoryId === ALL || item.category_id === categoryId)
      .filter((item) => {
        if (!normalizedQuery) return true;
        return [item.displayName, item.category_name, item.store_name, item.product_description]
          .some((value) => value?.toLocaleLowerCase("id-ID").includes(normalizedQuery));
      });
  }, [rows, storeId, categoryId, query]);

  const currentStore = stores.find((store) => store.store_id === storeId);

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Kembali ke ANKA">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-extrabold text-foreground">ANKA Shop</span>
              <span className="block text-xs font-medium text-muted-foreground">Belanja dari outlet pilihan Anda</span>
            </span>
          </Link>
          <Button asChild variant="ghost" className="shrink-0">
            <Link to="/"><ArrowLeft className="h-4 w-4" />Beranda</Link>
          </Button>
        </div>
      </header>

      <section className="border-b bg-secondary/50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <div className="max-w-3xl">
            <p className="mb-2 text-sm font-bold uppercase text-primary">Katalog Online</p>
            <h1 className="text-3xl font-black text-foreground sm:text-4xl">Produk terbaik dari setiap outlet</h1>
            <p className="mt-3 text-base font-medium text-muted-foreground sm:text-lg">
              Pilih outlet, temukan produk, dan lihat harga serta ketersediaannya secara langsung.
            </p>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
            <label className="relative block">
              <span className="sr-only">Cari produk</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari produk atau kategori..."
                className="h-12 bg-card pl-12 text-base"
              />
            </label>
            <select
              aria-label="Pilih outlet"
              value={storeId}
              onChange={(event) => {
                setStoreId(event.target.value);
                setCategoryId(ALL);
              }}
              className="h-12 rounded-md border border-input bg-card px-4 text-base font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={ALL}>Semua outlet</option>
              {stores.map((store) => <option key={store.store_id} value={store.store_id}>{store.store_name}</option>)}
            </select>
            <select
              aria-label="Pilih kategori"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-12 rounded-md border border-input bg-card px-4 text-base font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={ALL}>Semua kategori</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {currentStore && (
          <div className="mb-8 flex items-center gap-4 border-b pb-6">
            {currentStore.store_image_url ? (
              <img src={currentStore.store_image_url} alt={`Logo ${currentStore.store_name}`} className="h-16 w-16 rounded-md border object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-md bg-muted"><Store className="h-7 w-7 text-muted-foreground" /></span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-xl font-extrabold text-foreground">{currentStore.store_name}</h2>
              {currentStore.store_location && <p className="mt-1 flex items-center gap-1 text-sm font-medium text-muted-foreground"><MapPin className="h-4 w-4" />{currentStore.store_location}</p>}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <ShoppingBag className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-bold text-foreground">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <Building2 className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-bold text-foreground">Belum ada produk yang sesuai</p>
            <p className="mt-1 text-muted-foreground">Coba ubah outlet, kategori, atau kata pencarian.</p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-foreground">Katalog Produk</h2>
                <p className="mt-1 font-medium text-muted-foreground">{items.length} produk tersedia</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => {
                const soldOut = item.track_inventory && item.displayStock <= 0;
                return (
                  <article key={item.key} className="group overflow-hidden rounded-md border bg-card shadow-[var(--shadow-card)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-hover)]">
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.displayName} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-10 w-10 text-muted-foreground/60" /></div>
                      )}
                      <Badge className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate bg-card text-card-foreground hover:bg-card">{item.store_name}</Badge>
                    </div>
                    <div className="p-3 sm:p-4">
                      <p className="min-h-5 truncate text-xs font-bold uppercase text-primary">{item.category_name || "Produk"}</p>
                      <h3 className="mt-1 line-clamp-2 min-h-12 text-base font-extrabold text-foreground sm:text-lg">{item.displayName}</h3>
                      {item.product_description && <p className="mt-2 line-clamp-2 text-sm font-medium text-muted-foreground">{item.product_description}</p>}
                      <div className="mt-4 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end sm:justify-between">
                        <p className="text-base font-black text-foreground sm:text-lg">{formatPrice(item.displayPrice)}</p>
                        <span className={soldOut ? "text-xs font-bold text-destructive" : "text-xs font-bold text-muted-foreground"}>
                          {soldOut ? "Stok habis" : item.track_inventory ? `Stok ${item.displayStock}` : "Tersedia"}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}