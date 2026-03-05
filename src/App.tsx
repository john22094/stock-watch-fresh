import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ProductsPage from "@/pages/ProductsPage";
import ScanPage from "@/pages/ScanPage";
import PalletsPage from "@/pages/PalletsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function LayoutRoute({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<LayoutRoute><DashboardPage /></LayoutRoute>} />
          <Route path="/produtos" element={<LayoutRoute><ProductsPage /></LayoutRoute>} />
          <Route path="/escanear" element={<LayoutRoute><ScanPage /></LayoutRoute>} />
          <Route path="/paletes" element={<LayoutRoute><PalletsPage /></LayoutRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
