import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import UpdateAvailableBanner from "@/components/app/UpdateAvailableBanner";
import { IonApp } from "@ionic/react";
import { QueryClient, QueryClientProvider, dehydrate, hydrate } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminRouteGuard from "@/components/admin/AdminRouteGuard";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCidades from "@/pages/admin/AdminCidades";
import AdminCidadeDetail from "@/pages/admin/AdminCidadeDetail";
import AdminJornal from "@/pages/admin/AdminJornal";
import AdminCinema from "@/pages/admin/AdminCinema";
import AdminAloPrefeitura from "@/pages/admin/AdminAloPrefeitura";
import AdminScraping from "@/pages/admin/AdminScraping";
import AdminAtividade from "@/pages/admin/AdminAtividade";
import MobileLayout from "@/components/MobileLayout";
import AnimatedRoutes from "@/components/navigation/AnimatedRoutes";
import AndroidBackButtonHandler from "@/components/navigation/AndroidBackButtonHandler";

import CidadePage from "@/pages/CidadePage";
import BannerDetailPage from "@/pages/BannerDetailPage";
import JornalDetailPage from "@/pages/JornalDetailPage";
import JornalListPage from "@/pages/JornalListPage";
import AloPrefeituraListPage from "@/pages/AloPrefeituraListPage";
import AloPrefeituraDetailPage from "@/pages/AloPrefeituraDetailPage";
import VeiculosListPage from "@/pages/VeiculosListPage";
import VeiculoDetailPage from "@/pages/VeiculoDetailPage";
import NovoVeiculoPage from "@/pages/NovoVeiculoPage";
import DesapegaListPage from "@/pages/DesapegaListPage";
import NovoDesapegaPage from "@/pages/NovoDesapegaPage";
import DesapegaDetailPage from "@/pages/DesapegaDetailPage";
import DoacoesListPage from "@/pages/DoacoesListPage";
import NovaDoacaoPage from "@/pages/NovaDoacaoPage";
import DoacaoDetailPage from "@/pages/DoacaoDetailPage";

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
import SolicitarOrcamentoPage from "@/pages/SolicitarOrcamentoPage";
import MinhasSolicitacoesOrcamentoPage from "@/pages/MinhasSolicitacoesOrcamentoPage";
import OrcamentosCidadePage from "@/pages/OrcamentosCidadePage";
import OrcamentosRecebidosPage from "@/pages/OrcamentosRecebidosPage";
import OrcamentosEnviadosPage from "@/pages/OrcamentosEnviadosPage";
import ConversaOrcamentoPage from "@/pages/ConversaOrcamentoPage";
import EnviarOrcamentoPage from "@/pages/EnviarOrcamentoPage";
import EditarSolicitacaoOrcamentoPage from "@/pages/EditarSolicitacaoOrcamentoPage";
import AuthPage from "@/pages/AuthPage";
import MeusAnunciosPage from "@/pages/MeusAnunciosPage";
import MinhasEmpresasPage from "@/pages/MinhasEmpresasPage";
import EditarEmpresaPage from "@/pages/EditarEmpresaPage";
import EditarPerfilPage from "@/pages/EditarPerfilPage";
import MeusVeiculosPage from "@/pages/MeusVeiculosPage";
import MinhasDenunciasPage from "@/pages/MinhasDenunciasPage";
import MinhasVagasPage from "@/pages/MinhasVagasPage";
import NotFound from "@/pages/NotFound";
import EventoDetailPage from "@/pages/EventoDetailPage";
import EventosListPage from "@/pages/EventosListPage";
import OnibusListPage from "@/pages/OnibusListPage";
import CuponsListPage from "@/pages/CuponsListPage";
import MeusCuponsPage from "@/pages/MeusCuponsPage";
import PoliticaPrivacidadePage from "@/pages/PoliticaPrivacidadePage";
import SuportePage from "@/pages/SuportePage";

const QUERY_CACHE_STORAGE_KEY = "gc:offline-query-cache:v2";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,        // 2 min — dados considerados frescos
      gcTime: 1000 * 60 * 60 * 4,      // 4h — tempo de vida no cache
      retry: 1,
      networkMode: "online",            // Sempre tenta buscar da rede
      refetchOnWindowFocus: true,       // Atualiza ao voltar ao app
      refetchOnReconnect: true,         // Atualiza ao reconectar internet
    },
  },
});

const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 2; // 2h — cache offline máximo

const safeLoadCache = () => {
  try {
    const raw = localStorage.getItem(QUERY_CACHE_STORAGE_KEY);
    if (!raw) return null;

    // Verificar idade do cache
    const savedAt = localStorage.getItem(QUERY_CACHE_STORAGE_KEY + ":ts");
    if (savedAt) {
      const age = Date.now() - Number(savedAt);
      if (age > MAX_CACHE_AGE_MS) {
        console.log("[Cache] Cache offline expirado, descartando...");
        localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
        localStorage.removeItem(QUERY_CACHE_STORAGE_KEY + ":ts");
        return null;
      }
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error("Erro ao ler cache offline:", error);
    return null;
  }
};

// Limpar cache antigo v1
localStorage.removeItem("gc:offline-query-cache:v1");

const cachedState = safeLoadCache();
if (cachedState) {
  hydrate(queryClient, cachedState);
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
queryClient.getQueryCache().subscribe(() => {
  if (persistTimer) clearTimeout(persistTimer);

  // Debounce para evitar gravações excessivas durante múltiplas queries seguidas.
  persistTimer = setTimeout(() => {
    const dehydratedState = dehydrate(queryClient, {
      shouldDehydrateQuery: (query) => query.state.status === "success",
    });
    safeSaveCache(dehydratedState);
  }, 400);
});

const App = () => (
  <IonApp>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <UpdateAvailableBanner />
        <BrowserRouter>
          <AndroidBackButtonHandler />
          <AnimatedRoutes>
            <Routes>
            {/* Public routes with mobile max-width */}
            <Route element={<MobileLayout />}>
              <Route path="/" element={<Navigate to="/cidade/governador-valadares" replace />} />
              <Route path="/cidade/:slug" element={<CidadePage />} />
              <Route path="/cidade/:slug/banner/:id" element={<BannerDetailPage />} />
              <Route path="/cidade/:slug/jornal" element={<JornalListPage />} />
              <Route path="/cidade/:slug/jornal/:jornalId" element={<JornalDetailPage />} />
              <Route path="/cidade/:slug/alo-prefeitura" element={<AloPrefeituraListPage />} />
              <Route path="/cidade/:slug/alo-prefeitura/:itemId" element={<AloPrefeituraDetailPage />} />
              <Route path="/cidade/:slug/veiculos" element={<VeiculosListPage />} />
              <Route path="/cidade/:slug/veiculos/:veiculoId" element={<VeiculoDetailPage />} />
              <Route path="/cidade/:slug/veiculos/novo" element={<NovoVeiculoPage />} />
              <Route path="/cidade/:slug/desapega" element={<DesapegaListPage />} />
              <Route path="/cidade/:slug/desapega/novo" element={<NovoDesapegaPage />} />
              <Route path="/cidade/:slug/desapega/:anuncioId" element={<DesapegaDetailPage />} />
              <Route path="/cidade/:slug/doacoes" element={<DoacoesListPage />} />
              <Route path="/cidade/:slug/doacoes/novo" element={<NovaDoacaoPage />} />
              <Route path="/cidade/:slug/doacoes/:anuncioId" element={<DoacaoDetailPage />} />
              <Route path="/cidade/:slug/servicos/:categoriaId" element={<ServicoCategoriaPage />} />
              <Route path="/cidade/:slug/servicos/:categoriaId/novo" element={<NovaEmpresaPage />} />
              <Route path="/cidade/:slug/servicos/:categoriaId/:empresaId" element={<ServicoEmpresaDetailPage />} />
              <Route path="/cidade/:slug/ofertas" element={<OfertasListPage />} />
              <Route path="/cidade/:slug/vagas" element={<VagasListPage />} />
              <Route path="/cidade/:slug/vagas/nova" element={<NovaVagaPage />} />
              <Route path="/cidade/:slug/vagas/:vagaId" element={<VagaDetailPage />} />
              <Route path="/cidade/:slug/pets" element={<PetsListPage />} />
              <Route path="/cidade/:slug/pets/novo" element={<NovoPetPage />} />
              <Route path="/cidade/:slug/pets/:id" element={<PetDetailPage />} />
              <Route path="/cidade/:slug/anunciar" element={<AnunciarPage />} />
              <Route path="/cidade/:slug/solicitar-orcamento" element={<SolicitarOrcamentoPage />} />
              <Route path="/cidade/:slug/orcamentos" element={<OrcamentosCidadePage />} />
              <Route path="/cidade/:slug/orcamentos/recebidos" element={<OrcamentosRecebidosPage />} />
              <Route path="/cidade/:slug/orcamentos/enviados" element={<OrcamentosEnviadosPage />} />
              <Route path="/cidade/:slug/orcamentos/conversa/:conversaId" element={<ConversaOrcamentoPage />} />
              <Route path="/cidade/:slug/orcamentos/:solicitacaoId/enviar" element={<EnviarOrcamentoPage />} />
              <Route path="/cidade/:slug/editar-solicitacao-orcamento/:id" element={<EditarSolicitacaoOrcamentoPage />} />
              <Route path="/cidade/:slug/minhas-solicitacoes-orcamento" element={<MinhasSolicitacoesOrcamentoPage />} />
              <Route path="/cidade/:slug/banner/novo" element={<NovoBannerPage />} />
              <Route path="/cidade/:slug/meus-anuncios" element={<MeusAnunciosPage />} />
              <Route path="/cidade/:slug/minhas-empresas" element={<MinhasEmpresasPage />} />
              <Route path="/cidade/:slug/empresa/novo" element={<NovaEmpresaPage />} />
              <Route path="/cidade/:slug/minhas-empresas/:empresaId/editar" element={<EditarEmpresaPage />} />
              <Route path="/cidade/:slug/editar-perfil" element={<EditarPerfilPage />} />
              <Route path="/cidade/:slug/meus-veiculos" element={<MeusVeiculosPage />} />
              <Route path="/cidade/:slug/minhas-denuncias" element={<MinhasDenunciasPage />} />
              <Route path="/cidade/:slug/minhas-vagas" element={<MinhasVagasPage />} />
              <Route path="/cidade/:slug/eventos" element={<EventosListPage />} />
              <Route path="/cidade/:slug/eventos/:eventoId" element={<EventoDetailPage />} />
              <Route path="/cidade/:slug/onibus" element={<OnibusListPage />} />
              <Route path="/cidade/:slug/cupons" element={<CuponsListPage />} />
              <Route path="/cidade/:slug/meus-cupons" element={<MeusCuponsPage />} />
              <Route path="/cidade/:slug/auth" element={<AuthPage />} />
            </Route>

            {/* Public standalone pages */}
            <Route element={<MobileLayout />}>
              <Route path="/politica-privacidade" element={<PoliticaPrivacidadePage />} />
              <Route path="/suporte" element={<SuportePage />} />
            </Route>

            {/* Admin routes without max-width constraint */}
            <Route path="/admin" element={<AdminRouteGuard><AdminLayout><AdminDashboard /></AdminLayout></AdminRouteGuard>} />
            <Route path="/admin/cidades" element={<AdminRouteGuard><AdminLayout><AdminCidades /></AdminLayout></AdminRouteGuard>} />
            <Route path="/admin/cidades/:cidadeId" element={<AdminRouteGuard><AdminLayout><AdminCidadeDetail /></AdminLayout></AdminRouteGuard>} />
            <Route path="/admin/jornal" element={<AdminRouteGuard><AdminLayout><AdminJornal /></AdminLayout></AdminRouteGuard>} />
            <Route path="/admin/cinema" element={<AdminRouteGuard><AdminLayout><AdminCinema /></AdminLayout></AdminRouteGuard>} />
            <Route path="/admin/alo-prefeitura" element={<AdminRouteGuard><AdminLayout><AdminAloPrefeitura /></AdminLayout></AdminRouteGuard>} />
            <Route path="/admin/scraping" element={<AdminRouteGuard><AdminLayout><AdminScraping /></AdminLayout></AdminRouteGuard>} />
            <Route path="/admin/atividade" element={<AdminRouteGuard><AdminLayout><AdminAtividade /></AdminLayout></AdminRouteGuard>} />

            <Route path="*" element={<NotFound />} />
            </Routes>
          </AnimatedRoutes>
        </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </IonApp>
);

export default App;
