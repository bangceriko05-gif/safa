import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";

interface Store {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  is_active: boolean;
  image_url?: string | null;
  calendar_type?: string | null;
}

interface StoreContextType {
  currentStore: Store | null;
  userStores: Store[];
  setCurrentStore: (store: Store) => void;
  refreshStores: () => Promise<void>;
  isLoading: boolean;
  userRole: string | null;
  isStoreInactive: boolean;
  inactiveStoreName: string | null;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/booking", "/auth"];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentStore, setCurrentStoreState] = useState<Store | null>(null);
  const [userStores, setUserStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isStoreInactive, setIsStoreInactive] = useState(false);
  const [inactiveStoreName, setInactiveStoreName] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchUserStoresAndRole();
  }, []);

  const fetchUserStoresAndRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if current route is public
      const isPublicRoute = PUBLIC_ROUTES.some(route => location.pathname.startsWith(route));
      
      if (!user) {
        setIsLoading(false);
        // Only redirect to auth if NOT on a public route
        if (!isPublicRoute) {
          navigate("/auth");
        }
        return;
      }

      // Fetch user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const role = roleData?.role || "user";
      setUserRole(role);

      // Check if super admin
      const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
        _user_id: user.id
      });

      let stores: Store[] = [];

      if (isSuperAdmin) {
        // Super admin can access all active stores
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        stores = data || [];
      } else {
        // Regular users - fetch all stores they have access to (including inactive)
        const { data, error } = await supabase
          .from("user_store_access")
          .select(`
            store_id,
            role,
            stores (*)
          `)
          .eq("user_id", user.id);

        if (error) throw error;

        const allUserStores = data
          ?.map((access: any) => access.stores)
          .filter((store: any) => store) || [];
        
        // Only show active stores in the list
        stores = allUserStores.filter((store: any) => store.is_active);
        
        // Check if user's saved store is inactive
        const savedStoreId = localStorage.getItem("current_store_id");
        if (savedStoreId) {
          const savedStore = allUserStores.find((s: Store) => s.id === savedStoreId);
          if (savedStore && !savedStore.is_active) {
            // The user's current store is inactive - show the notice
            setIsStoreInactive(true);
            setInactiveStoreName(savedStore.name);
            setIsLoading(false);
            return;
          }
        }
      }

      setUserStores(stores);
      setIsStoreInactive(false);
      setInactiveStoreName(null);

      // Set current store from localStorage or first available store
      const savedStoreId = localStorage.getItem("current_store_id");
      const savedStore = stores.find(s => s.id === savedStoreId);
      
      if (savedStore) {
        setCurrentStoreState(savedStore);
      } else if (stores.length > 0) {
        setCurrentStoreState(stores[0]);
        localStorage.setItem("current_store_id", stores[0].id);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching user stores:", error);
      setIsLoading(false);
    }
  };

  const setCurrentStore = (store: Store) => {
    // Check if store is active
    if (!store.is_active) {
      setIsStoreInactive(true);
      setInactiveStoreName(store.name);
      return;
    }
    
    setCurrentStoreState(store);
    setIsStoreInactive(false);
    setInactiveStoreName(null);
    localStorage.setItem("current_store_id", store.id);
  };

  return (
    <StoreContext.Provider value={{ 
      currentStore, 
      userStores, 
      setCurrentStore, 
      refreshStores: fetchUserStoresAndRole,
      isLoading, 
      userRole,
      isStoreInactive,
      inactiveStoreName
    }}>
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