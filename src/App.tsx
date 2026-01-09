import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { StoreProvider } from "@/contexts/StoreContext";

// Main pages
import StoreSelector from "./pages/StoreSelector";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import NotFound from "./pages/NotFound";

// Store-specific pages
import StoreAuth from "./pages/store/StoreAuth";
import StoreDashboard from "./pages/store/StoreDashboard";
import StoreSettings from "./pages/store/StoreSettings";
import StoreBooking from "./pages/store/StoreBooking";

// Legacy pages (will be deprecated)
import Booking from "./pages/Booking";
import BookingConfirmation from "./pages/BookingConfirmation";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <StoreProvider>
          <Routes>
            {/* Public store selector */}
            <Route path="/" element={<StoreSelector />} />
            
            {/* Super Admin Dashboard */}
            <Route path="/admin" element={<SuperAdminDashboard />} />
            
            {/* Store-specific routes */}
            <Route path="/:storeSlug" element={<StoreBooking />} />
            <Route path="/:storeSlug/auth" element={<StoreAuth />} />
            <Route path="/:storeSlug/dashboard" element={<StoreDashboard />} />
            <Route path="/:storeSlug/pengaturan" element={<StoreSettings />} />
            
            {/* Legacy booking confirmation (redirect or keep for now) */}
            <Route path="/booking/confirm" element={<BookingConfirmation />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </StoreProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
