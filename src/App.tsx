import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCidades from "@/pages/admin/AdminCidades";
import Home from "@/pages/Home";
import Jornal from "@/pages/Jornal";
import Cinema from "@/pages/Cinema";
import Perfil from "@/pages/Perfil";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes with mobile layout */}
          <Route
            path="/"
            element={
              <MobileLayout>
                <Home />
              </MobileLayout>
            }
          />
          <Route
            path="/jornal"
            element={
              <MobileLayout>
                <Jornal />
              </MobileLayout>
            }
          />
          <Route
            path="/cinema"
            element={
              <MobileLayout>
                <Cinema />
              </MobileLayout>
            }
          />
          <Route
            path="/perfil"
            element={
              <MobileLayout>
                <Perfil />
              </MobileLayout>
            }
          />

          {/* Admin routes with admin layout */}
          <Route
            path="/admin"
            element={
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/cidades"
            element={
              <AdminLayout>
                <AdminCidades />
              </AdminLayout>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
