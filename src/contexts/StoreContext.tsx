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
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
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
const PUBLIC_ROUTES = ["/", "/booking", "/auth"];
const STORE_CACHE_KEY = "anka_store_context_v1";
const STORE_CACHE_TTL_MS = 5 * 60 * 1000;

type StoreCache = {
  userId: string;
  role: string | null;
  stores: Store[];
  savedAt: number;
};

function readStoreCache(userId: string): StoreCache | null {
  try {
    const raw = sessionStorage.getItem(STORE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as StoreCache;
    if (cached.userId !== userId) return null;
    if (Date.now() - cached.savedAt > STORE_CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeStoreCache(payload: Omit<StoreCache, "savedAt">) {
  try {
    sessionStorage.setItem(STORE_CACHE_KEY, JSON.stringify({ ...payload, savedAt: Date.now() }));
  } catch {
    // Ignore storage quota/private mode errors; backend data remains source of truth.
  }
}

// Consider a store expired when its subscription_end_date is before today (local).
function isSubscriptionExpired(store: { subscription_end_date?: string | null }): boolean {
  if (!store?.subscription_end_date) return false;
  const end = new Date(store.subscription_end_date);
  if (isNaN(end.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  // Block on the expiry day itself too ("0 hari lagi" == habis).
  return end.getTime() <= today.getTime();
}

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
    let lastUserId: string | null = null;

    // First restore session from storage, then fetch stores
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        lastUserId = session.user.id;
        applyCachedStores(session.user.id);
        await fetchUserStoresAndRole(session.user);
      } else {
        const isPublicRoute = PUBLIC_ROUTES.some(route => location.pathname.startsWith(route));
        if (isPublicRoute) {
          setIsLoading(false);
          return;
        }

        // Briefly allow auth storage to hydrate before redirecting protected pages.
        await new Promise(resolve => setTimeout(resolve, 250));
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (retrySession?.user) {
          lastUserId = retrySession.user.id;
          applyCachedStores(retrySession.user.id);
          await fetchUserStoresAndRole(retrySession.user);
        } else {
          setIsLoading(false);
          navigate("/auth");
        }
      }
    };
    
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only refetch when the user actually changes (sign in / sign out / different user).
      // Ignore TOKEN_REFRESHED and INITIAL_SESSION events triggered when switching browser tabs,
      // because they would cause an unwanted full reload of stores/role.
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }
      const newUserId = session?.user?.id ?? null;
      if (newUserId === lastUserId) return;
      lastUserId = newUserId;
      if (session?.user) {
        void fetchUserStoresAndRole(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserStoresAndRole = async (user: any) => {
    try {
      const [roleResult, superAdminResult, accessResult, allActiveStoresResult] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.rpc("is_super_admin", { _user_id: user.id }),
        supabase
          .from("user_store_access")
          .select(`
            store_id,
            role,
            stores (*)
          `)
          .eq("user_id", user.id),
        supabase
          .from("stores")
          .select("*")
          .eq("is_active", true)
          .order("name"),
      ]);

      const role = roleResult.data?.role || "user";
      setUserRole(role);

      const isSuperAdmin = Boolean(superAdminResult.data);

      let stores: Store[] = [];

      if (isSuperAdmin) {
        // Super admin can access all active stores
        if (allActiveStoresResult.error) throw allActiveStoresResult.error;
        stores = allActiveStoresResult.data || [];
      } else {
        // Regular users - fetch all stores they have access to (including inactive)
        if (accessResult.error) throw accessResult.error;

        const allUserStores = accessResult.data
          ?.map((access: any) => access.stores)
          .filter((store: any) => store) || [];
        
        // Only show active AND non-expired stores in the list
        stores = allUserStores.filter(
          (store: any) => store.is_active && !isSubscriptionExpired(store)
        );
        
        // Check if user's saved store is inactive or subscription expired
        const savedStoreId = localStorage.getItem("current_store_id");
        if (savedStoreId) {
          const savedStore = allUserStores.find((s: Store) => s.id === savedStoreId);
          if (savedStore && (!savedStore.is_active || isSubscriptionExpired(savedStore))) {
            // The user's current store is inactive/expired - show the notice
            setIsStoreInactive(true);
            setInactiveStoreName(savedStore.name);
            setIsLoading(false);
            return;
          }
        }
      }

      setUserStores(stores);
      writeStoreCache({ userId: user.id, role, stores });
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

  const applyCachedStores = (userId: string) => {
    const cached = readStoreCache(userId);
    if (!cached?.stores?.length) return false;

    setUserRole(cached.role || "user");
    setUserStores(cached.stores);
    setIsStoreInactive(false);
    setInactiveStoreName(null);

    const savedStoreId = localStorage.getItem("current_store_id");
    const savedStore = cached.stores.find(store => store.id === savedStoreId);
    setCurrentStoreState(savedStore || cached.stores[0]);
    setIsLoading(false);
    return true;
  };

  const setCurrentStore = (store: Store) => {
    // Check if store is active and not expired
    if (!store.is_active || isSubscriptionExpired(store)) {
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
      refreshStores: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) await fetchUserStoresAndRole(session.user);
      },
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