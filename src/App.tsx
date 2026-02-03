import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCidades from "@/pages/admin/AdminCidades";
import AdminJornal from "@/pages/admin/AdminJornal";
import CidadePage from "@/pages/CidadePage";
import BannerDetailPage from "@/pages/BannerDetailPage";
import JornalDetailPage from "@/pages/JornalDetailPage";
import JornalListPage from "@/pages/JornalListPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public city page with slug */}
          <Route path="/cidade/:slug" element={<CidadePage />} />
          <Route path="/cidade/:slug/banner/:id" element={<BannerDetailPage />} />
          <Route path="/cidade/:slug/jornal" element={<JornalListPage />} />
          <Route path="/cidade/:slug/jornal/:jornalId" element={<JornalDetailPage />} />

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
          <Route
            path="/admin/jornal"
            element={
              <AdminLayout>
                <AdminJornal />
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
