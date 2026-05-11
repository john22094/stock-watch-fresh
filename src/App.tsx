import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import DashboardPage from "@/pages/DashboardPage";
import ProductsPage from "@/pages/ProductsPage";
import ScanPage from "@/pages/ScanPage";
import EstoquePage from "@/pages/EstoquePage";
import PrateleirasPage from "@/pages/PrateleirasPage";
import MapaPage from "@/pages/MapaPage";
import FuncionariosPage from "@/pages/FuncionariosPage";
import RHPage from "@/pages/RHPage";
import AuditLogPage from "@/pages/AuditLogPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function LayoutRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/recuperar-senha" element={<ResetPasswordPage />} />
            <Route path="/dashboard" element={<LayoutRoute><DashboardPage /></LayoutRoute>} />
            <Route path="/produtos" element={<LayoutRoute><ProductsPage /></LayoutRoute>} />
            <Route path="/escanear" element={<LayoutRoute><ScanPage /></LayoutRoute>} />
            <Route path="/estoque" element={<LayoutRoute><EstoquePage /></LayoutRoute>} />
            <Route path="/prateleiras" element={<LayoutRoute><PrateleirasPage /></LayoutRoute>} />
            <Route path="/mapa" element={<LayoutRoute><MapaPage /></LayoutRoute>} />
            <Route path="/funcionarios" element={<LayoutRoute><FuncionariosPage /></LayoutRoute>} />
            <Route path="/rh" element={<LayoutRoute><RHPage /></LayoutRoute>} />
            <Route path="/auditoria" element={<LayoutRoute><AuditLogPage /></LayoutRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
