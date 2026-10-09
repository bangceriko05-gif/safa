import { useStore } from "@/contexts/StoreContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, ChevronDown } from "lucide-react";

export default function StoreSelector() {
  const { currentStore, userStores, setCurrentStore } = useStore();

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 group-data-[collapsible=icon]:flex-none">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-primary">
        {currentStore?.image_url ? (
          <img src={currentStore.image_url} alt={`Logo ${currentStore.name}`} className="h-full w-full object-cover" />
        ) : (
          <Building2 className="h-4 w-4" />
        )}
      </div>
      <Select
        value={currentStore?.id || ""}
        onValueChange={(value) => {
          const store = userStores.find(s => s.id === value);
          if (store) setCurrentStore(store);
        }}
        disabled={userStores.length === 0}
      >
        <SelectTrigger className="h-9 min-w-0 flex-1 border-0 bg-transparent px-1 text-xs font-semibold shadow-none focus:ring-0 group-data-[collapsible=icon]:hidden [&>span]:truncate [&>svg]:hidden">
          <SelectValue placeholder="Pilih Cabang" />
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </SelectTrigger>
        <SelectContent>
          {userStores.length === 0 && (
            <SelectItem value="" disabled>
              Tidak ada outlet
            </SelectItem>
          )}
          {userStores.map((store) => (
            <SelectItem key={store.id} value={store.id}>
              {store.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
