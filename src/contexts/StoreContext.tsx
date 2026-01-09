import { createContext, useContext, useState, ReactNode } from "react";

interface Store {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  is_active: boolean;
  image_url?: string | null;
}

interface StoreContextType {
  currentStore: Store | null;
  userStores: Store[];
  setCurrentStore: (store: Store) => void;
  isLoading: boolean;
  userRole: string | null;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentStore, setCurrentStoreState] = useState<Store | null>(() => {
    // Try to get from localStorage on initial load
    const savedStoreId = localStorage.getItem("current_store_id");
    return null; // Will be set by individual page components
  });
  const [userStores, setUserStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const setCurrentStore = (store: Store) => {
    setCurrentStoreState(store);
    localStorage.setItem("current_store_id", store.id);
  };

  return (
    <StoreContext.Provider value={{ currentStore, userStores, setCurrentStore, isLoading, userRole }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
