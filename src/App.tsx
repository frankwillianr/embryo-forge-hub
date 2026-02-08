import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCidades from "@/pages/admin/AdminCidades";
import AdminCidadeDetail from "@/pages/admin/AdminCidadeDetail";
import AdminJornal from "@/pages/admin/AdminJornal";
import AdminCinema from "@/pages/admin/AdminCinema";
import AdminAloPrefeitura from "@/pages/admin/AdminAloPrefeitura";
import AdminEmpresas from "@/pages/admin/AdminEmpresas";
import CidadePage from "@/pages/CidadePage";
import BannerDetailPage from "@/pages/BannerDetailPage";
import JornalDetailPage from "@/pages/JornalDetailPage";
import JornalListPage from "@/pages/JornalListPage";
import AloPrefeituraListPage from "@/pages/AloPrefeituraListPage";
import AloPrefeituraDetailPage from "@/pages/AloPrefeituraDetailPage";
import VeiculosListPage from "@/pages/VeiculosListPage";
import NovoVeiculoPage from "@/pages/NovoVeiculoPage";
import DesapegaListPage from "@/pages/DesapegaListPage";
import NovoDesapegaPage from "@/pages/NovoDesapegaPage";
import DesapegaDetailPage from "@/pages/DesapegaDetailPage";
import ServicosListPage from "@/pages/ServicosListPage";
import ServicoCategoriaPage from "@/pages/ServicoCategoriaPage";
import NovaEmpresaPage from "@/pages/NovaEmpresaPage";
import ServicoEmpresaDetailPage from "@/pages/ServicoEmpresaDetailPage";
import OfertasListPage from "@/pages/OfertasListPage";
import VagasListPage from "@/pages/VagasListPage";
import NovaVagaPage from "@/pages/NovaVagaPage";
import VagaDetailPage from "@/pages/VagaDetailPage";
import PetsListPage from "@/pages/PetsListPage";
import PetDetailPage from "@/pages/PetDetailPage";
import NovoPetPage from "@/pages/NovoPetPage";
import AnunciarPage from "@/pages/AnunciarPage";
import NovoBannerPage from "@/pages/NovoBannerPage";
import AuthPage from "@/pages/AuthPage";
import MeusAnunciosPage from "@/pages/MeusAnunciosPage";
import MinhasEmpresasPage from "@/pages/MinhasEmpresasPage";
import NotFound from "@/pages/NotFound";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Redirect root to default city */}
            <Route path="/" element={<Navigate to="/cidade/governador-valadares" replace />} />
            
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
            path="/admin/cidades/:cidadeId"
            element={
              <AdminLayout>
                <AdminCidadeDetail />
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
          <Route
            path="/admin/cinema"
            element={
              <AdminLayout>
                <AdminCinema />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/alo-prefeitura"
            element={
              <AdminLayout>
                <AdminAloPrefeitura />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/empresas"
            element={
              <AdminLayout>
                <AdminEmpresas />
              </AdminLayout>
            }
          />

          {/* Alô Prefeitura public routes */}
          <Route path="/cidade/:slug/alo-prefeitura" element={<AloPrefeituraListPage />} />
          <Route path="/cidade/:slug/alo-prefeitura/:itemId" element={<AloPrefeituraDetailPage />} />

          {/* Veículos public routes */}
          <Route path="/cidade/:slug/veiculos" element={<VeiculosListPage />} />
          <Route path="/cidade/:slug/veiculos/novo" element={<NovoVeiculoPage />} />

          {/* Desapega public routes */}
          <Route path="/cidade/:slug/desapega" element={<DesapegaListPage />} />
          <Route path="/cidade/:slug/desapega/novo" element={<NovoDesapegaPage />} />
          <Route path="/cidade/:slug/desapega/:anuncioId" element={<DesapegaDetailPage />} />

          {/* Serviços */}
          <Route path="/cidade/:slug/servicos" element={<ServicosListPage />} />
          <Route path="/cidade/:slug/servicos/:categoriaId" element={<ServicoCategoriaPage />} />
          <Route path="/cidade/:slug/servicos/:categoriaId/novo" element={<NovaEmpresaPage />} />
          <Route path="/cidade/:slug/servicos/:categoriaId/:empresaId" element={<ServicoEmpresaDetailPage />} />

          {/* Ofertas */}
          <Route path="/cidade/:slug/ofertas" element={<OfertasListPage />} />

          {/* Vagas de Emprego */}
          <Route path="/cidade/:slug/vagas" element={<VagasListPage />} />
          <Route path="/cidade/:slug/vagas/nova" element={<NovaVagaPage />} />
          <Route path="/cidade/:slug/vagas/:vagaId" element={<VagaDetailPage />} />

          {/* Pets Perdidos */}
          <Route path="/cidade/:slug/pets" element={<PetsListPage />} />
          <Route path="/cidade/:slug/pets/novo" element={<NovoPetPage />} />
          <Route path="/cidade/:slug/pets/:id" element={<PetDetailPage />} />

            {/* Anunciar Hub */}
            <Route path="/cidade/:slug/anunciar" element={<AnunciarPage />} />
            <Route path="/cidade/:slug/banner/novo" element={<NovoBannerPage />} />

            {/* Minha Conta */}
            <Route path="/cidade/:slug/meus-anuncios" element={<MeusAnunciosPage />} />
            <Route path="/cidade/:slug/minhas-empresas" element={<MinhasEmpresasPage />} />

            {/* Auth */}
            <Route path="/cidade/:slug/auth" element={<AuthPage />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
