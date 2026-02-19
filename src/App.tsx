import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { StoreProvider } from "@/contexts/StoreContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SelectStore from "./pages/SelectStore";
import Booking from "./pages/Booking";
import BookingConfirmation from "./pages/BookingConfirmation";
import Receipt from "./pages/Receipt";
import TransactionReceiptPage from "./pages/TransactionReceipt";
import DepositReceiptPage from "./pages/DepositReceipt";
import SuperAdmin from "./pages/SuperAdmin";
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
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/select-store" element={<SelectStore />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/booking/confirm" element={<BookingConfirmation />} />
            <Route path="/receipt" element={<Receipt />} />
            <Route path="/receipt/transaction" element={<TransactionReceiptPage />} />
            <Route path="/receipt/deposit" element={<DepositReceiptPage />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </StoreProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
