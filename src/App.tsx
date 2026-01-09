import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StoreProvider } from "@/contexts/StoreContext";

// Admin pages (Super Admin only)
import AdminAuth from "./pages/admin/AdminAuth";
import AdminDashboard from "./pages/admin/AdminDashboard";

// Store-specific pages (Admin Toko only)
import StoreAdminAuth from "./pages/store/StoreAdminAuth";
import StoreAdminDashboard from "./pages/store/StoreAdminDashboard";
import StoreSettings from "./pages/store/StoreSettings";

// Legacy/utility pages
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <StoreProvider>
          <Routes>
            {/* ============================================ */}
            {/* DOMAIN UTAMA - PRIVATE (SUPER_ADMIN ONLY)   */}
            {/* ============================================ */}
            
            {/* Root redirects to auth */}
            <Route path="/" element={<Navigate to="/auth" replace />} />
            
            {/* Super Admin Auth */}
            <Route path="/auth" element={<AdminAuth />} />
            
            {/* Super Admin Dashboard */}
            <Route path="/dashboard" element={<AdminDashboard />} />
            
            {/* Super Admin additional pages - all redirect to dashboard */}
            <Route path="/pengaturan" element={<Navigate to="/dashboard" replace />} />
            <Route path="/manajemen-toko" element={<Navigate to="/dashboard" replace />} />
            <Route path="/manajemen-user" element={<Navigate to="/dashboard" replace />} />

            {/* ============================================ */}
            {/* STORE ROUTES - PRIVATE (ADMIN_TOKO ONLY)    */}
            {/* ============================================ */}
            
            {/* Store root redirects to auth */}
            <Route path="/:storeSlug" element={<Navigate to="auth" replace />} />
            
            {/* Store Admin Auth */}
            <Route path="/:storeSlug/auth" element={<StoreAdminAuth />} />
            
            {/* Store Admin Dashboard */}
            <Route path="/:storeSlug/dashboard" element={<StoreAdminDashboard />} />
            
            {/* Store Settings */}
            <Route path="/:storeSlug/pengaturan" element={<StoreSettings />} />
            
            {/* Store additional pages - redirect to dashboard */}
            <Route path="/:storeSlug/booking-manage" element={<Navigate to="dashboard" replace />} />
            <Route path="/:storeSlug/kamar-manage" element={<Navigate to="dashboard" replace />} />

            {/* ============================================ */}
            {/* CATCH-ALL - 404                              */}
            {/* ============================================ */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </StoreProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
