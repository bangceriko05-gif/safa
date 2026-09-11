import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { StoreProvider } from "@/contexts/StoreContext";
import { Loader2 } from "lucide-react";

// Lazy load all route pages for code splitting
const Landing = lazyWithRetry(() => import("./pages/Landing"));
const Index = lazyWithRetry(() => import("./pages/Index"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const SelectStore = lazyWithRetry(() => import("./pages/SelectStore"));
const Booking = lazyWithRetry(() => import("./pages/Booking"));
const BookingConfirmation = lazyWithRetry(() => import("./pages/BookingConfirmation"));
const Receipt = lazyWithRetry(() => import("./pages/Receipt"));
const TransactionReceiptPage = lazyWithRetry(() => import("./pages/TransactionReceipt"));
const DepositReceiptPage = lazyWithRetry(() => import("./pages/DepositReceipt"));
const SuperAdmin = lazyWithRetry(() => import("./pages/SuperAdmin"));
const PosOrderDetail = lazyWithRetry(() => import("./pages/PosOrderDetail"));
const RoomScan = lazyWithRetry(() => import("./pages/RoomScan"));
const Shop = lazyWithRetry(() => import("./pages/Shop"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <StoreProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/select-store" element={<SelectStore />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/booking/confirm" element={<BookingConfirmation />} />
              <Route path="/receipt" element={<Receipt />} />
              <Route path="/receipt/transaction" element={<TransactionReceiptPage />} />
              <Route path="/receipt/deposit" element={<DepositReceiptPage />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              <Route path="/pos-order/:id" element={<PosOrderDetail />} />
              <Route path="/room-scan" element={<RoomScan />} />
              <Route path="/shop" element={<Shop />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </StoreProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
