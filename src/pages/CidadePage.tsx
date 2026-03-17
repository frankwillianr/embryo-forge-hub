import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Home, Newspaper, Film, Megaphone, Menu, Map, ArrowLeft, Bell } from "lucide-react";
import { IonPage } from "@ionic/react";
import { supabase } from "@/integrations/supabase/client";
import CidadeBanner from "@/components/CidadeBanner";
import HomeSection from "@/components/sections/HomeSection";
import CinemaSection from "@/components/sections/CinemaSection";
import AloPrefeituraSection from "@/components/sections/AloPrefeituraSection";
import MenuSection from "@/components/sections/MenuSection";
import MapaEmpresasView from "@/components/mapa/MapaEmpresasView";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import { useTrackCidadeAccess } from "@/hooks/useTrackCidadeAccess";
import { toast } from "sonner";

type TabType = "home" | "cinema" | "prefeitura" | "maps" | "menu";

const sectionTitles: Record<TabType, string> = {
  home: "Home",
  cinema: "Cinema",
  prefeitura: "Voz do Povo",
  maps: "Mapa",
  menu: "Menu",
};

const CidadePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const { profile } = useAuth();
  useTrackCidadeAccess(slug);
  const scrollPositions = useRef<Record<TabType, number>>({
    home: 0, cinema: 0, prefeitura: 0, maps: 0, menu: 0,
  });


  // Get first name from profile
  const firstName = profile?.nome?.split(" ")[0] || null;

  // Busca dados da cidade
  const { data: cidade } = useQuery({
    queryKey: ["cidade-detail", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      
      return data;
    },
    enabled: !!slug,
  });

  // Inicializa push notifications com o ID da cidade
  const { permissionStatus } = usePushNotifications({
    cidadeId: cidade?.id || null
  });

  useEffect(() => {
    console.log("[CidadePage] state", {
      slug,
      activeTab,
      cidadeId: cidade?.id ?? null,
      cidadeNome: cidade?.nome ?? null,
      userId: profile?.id ?? null,
      pushPermissionStatus: permissionStatus ?? null,
      now: new Date().toISOString(),
    });
  }, [slug, activeTab, cidade?.id, cidade?.nome, profile?.id, permissionStatus]);

  useEffect(() => {
    if (permissionStatus === 'granted') {
      console.log('Push notifications ativadas para esta cidade');
    }
  }, [permissionStatus]);

  // Track scroll position continuamente via ref
  const lastScrollY = useRef(0);
  useEffect(() => {
    const handleScroll = () => {
      lastScrollY.current = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Salva scroll da Home ao sair da rota (componente desmonta)
  useEffect(() => {
    return () => {
      if (activeTab === "home") {
        sessionStorage.setItem(`home-scroll-${slug}`, String(lastScrollY.current));
      }
    };
  }, [activeTab, slug]);

  // Restaura scroll da Home ao montar sem efeito de "refresh visual"
  useLayoutEffect(() => {
    const saved = sessionStorage.getItem(`home-scroll-${slug}`);
    if (saved && Number(saved) > 0) {
      window.scrollTo({ top: Number(saved), behavior: "instant" });
      sessionStorage.removeItem(`home-scroll-${slug}`);
    }
  }, [slug]);

  // Handle navigation state (e.g., from cinema horizontal list)
  useEffect(() => {
    const state = location.state as { tab?: TabType } | null;
    if (state?.tab) {
      scrollPositions.current[activeTab] = window.scrollY;
      setActiveTab(state.tab);
      window.scrollTo({ top: 0, behavior: "instant" });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Função temporária para testar push
  const handleTestPush = async () => {
    try {
      toast.loading("Enviando push de teste...");

      const response = await fetch(
        "https://umauozcntfxgphzbiifz.supabase.co/functions/v1/send-push-notification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "🎉 Teste de Push!",
            body: "Parabéns! As notificações push estão funcionando!",
          }),
        }
      );

      const result = await response.json();
      toast.dismiss();

      if (result.success) {
        toast.success(`Push enviado! ${result.sent} dispositivo(s)`);
      } else {
        toast.error(result.error || "Erro ao enviar push");
      }

      console.log("Resultado do push:", result);
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao enviar push");
      console.error("Erro:", error);
    }
  };

  const isHome = activeTab === "home";

  const switchTab = (tab: TabType) => {
    scrollPositions.current[activeTab] = window.scrollY;
    setActiveTab(tab);
    setTimeout(() => {
      window.scrollTo({ top: scrollPositions.current[tab], behavior: "instant" });
    }, 0);
  };

  const handleHomeClick = () => {
    if (activeTab === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      switchTab("home");
    }
  };

  const renderSection = () => {
    switch (activeTab) {
      case "home":
        return <HomeSection cidadeSlug={slug} />;
      case "cinema":
        return <CinemaSection cidadeSlug={slug} />;
      case "prefeitura":
        return <AloPrefeituraSection cidadeSlug={slug} />;
      case "maps":
        return cidade?.id ? (
          <MapaEmpresasView
            cidadeId={cidade.id}
            cidadeSlug={slug ?? ""}
            cidadeNome={cidade.nome}
            onClose={() => switchTab("home")}
          />
        ) : null;
      case "menu":
        return <MenuSection cidadeNome={cidade?.nome} cidadeSlug={slug} />;
    }
  };

  return (
    <IonPage className="flex flex-col min-h-screen bg-background overflow-visible [contain:none]">
      {/* Main Content */}
      <main className="flex-1 pb-20">
        {isHome ? (
          <CidadeBanner
            bannerUrl={cidade?.banner_url}
            cidadeNome={cidade?.nome}
            userName={firstName}
          />
        ) : activeTab !== "maps" ? (
          <header className="flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => switchTab("home")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">
              {sectionTitles[activeTab]}
            </h1>
          </header>
        ) : null}

        <div>
          {renderSection()}
        </div>

      </main>

      {/* Bottom Navigation - Pill Style */}
      <nav className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 pb-safe">
        <div className="relative flex items-center">
          {/* Home Button - Floating outside */}
          <button
            onClick={handleHomeClick}
            className={`absolute -left-6 z-10 flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all duration-300 ${
              activeTab === "home"
                ? "bg-white"
                : "bg-white"
            }`}
            style={{
              boxShadow: "0 4px 20px -4px rgba(0,0,0,0.15)"
            }}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
              activeTab === "home"
                ? "bg-gradient-to-br from-primary to-[#E80560]"
                : "bg-muted"
            }`}>
              <Home className={`h-4 w-4 ${activeTab === "home" ? "text-white" : "text-muted-foreground"}`} />
            </div>
          </button>

          {/* Dark Pill Container */}
          <div className="flex items-center gap-2 bg-[#1a1a2e] rounded-full py-2 px-5 pl-12 shadow-2xl">
            <button
              onClick={() => navigate(`/cidade/${slug}/jornal`)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 text-gray-400 hover:text-white"
            >
              <Newspaper className="h-5 w-5" />
              <span className="text-[9px] font-medium">Jornal</span>
            </button>

            <button
              onClick={() => switchTab("cinema")}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 ${
                activeTab === "cinema"
                  ? "text-primary"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Film className="h-5 w-5" />
              <span className="text-[9px] font-medium">Cinema</span>
            </button>

            <button
              onClick={() => navigate(`/cidade/${slug}/alo-prefeitura`)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 ${
                activeTab === "prefeitura"
                  ? "text-primary"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Megaphone className="h-5 w-5" />
              <span className="text-[9px] font-medium">Voz</span>
            </button>

            <button
              onClick={() => switchTab("maps")}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 ${
                activeTab === "maps"
                  ? "text-primary"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Map className="h-5 w-5" />
              <span className="text-[9px] font-medium">Maps</span>
            </button>

            <button
              onClick={() => switchTab("menu")}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 ${
                activeTab === "menu"
                  ? "text-primary"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Menu className="h-5 w-5" />
              <span className="text-[9px] font-medium">Menu</span>
            </button>
          </div>
        </div>
      </nav>
    </IonPage>
  );
};

export default CidadePage;
