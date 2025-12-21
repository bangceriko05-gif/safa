import { useStore } from "@/contexts/StoreContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store } from "lucide-react";

export default function StoreSelector() {
  const { currentStore, userStores, setCurrentStore } = useStore();

  if (userStores.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Store className="h-4 w-4 text-muted-foreground" />
      <Select
        value={currentStore?.id}
        onValueChange={(value) => {
          const store = userStores.find(s => s.id === value);
          if (store) setCurrentStore(store);
        }}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Pilih Cabang" />
        </SelectTrigger>
        <SelectContent>
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