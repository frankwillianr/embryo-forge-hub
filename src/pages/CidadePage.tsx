import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell } from "lucide-react";
import { IonPage } from "@ionic/react";
import { supabase } from "@/integrations/supabase/client";
import CidadeBanner from "@/components/CidadeBanner";
import HomeSection from "@/components/sections/HomeSection";
import CinemaSection from "@/components/sections/CinemaSection";
import AloPrefeituraSection from "@/components/sections/AloPrefeituraSection";
import MenuSection from "@/components/sections/MenuSection";
import MapaEmpresasView from "@/components/mapa/MapaEmpresasView";
import BottomNavBar from "@/components/navigation/BottomNavBar";
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
  const getInitialTab = (): TabType => {
    const queryTab = new URLSearchParams(location.search).get("tab");
    if (queryTab === "home" || queryTab === "cinema" || queryTab === "prefeitura" || queryTab === "maps" || queryTab === "menu") {
      return queryTab;
    }
    const stateTab = (location.state as { tab?: TabType } | null)?.tab;
    if (stateTab === "home" || stateTab === "cinema" || stateTab === "prefeitura" || stateTab === "maps" || stateTab === "menu") {
      return stateTab;
    }
    return "home";
  };
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
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
    if (!saved || Number(saved) <= 0) return;

    const target = Number(saved);
    sessionStorage.removeItem(`home-scroll-${slug}`);

    // Try immediately (works when data is cached)
    window.scrollTo({ top: target, behavior: "auto" });

    // Retry after a tick in case content wasn't rendered yet
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - target) > 50) {
        window.scrollTo({ top: target, behavior: "auto" });
      }
    });
  }, [slug]);

  // Handle navigation state (e.g., from cinema horizontal list)
  useEffect(() => {
    const state = location.state as { tab?: TabType } | null;
    if (state?.tab && state.tab !== activeTab) {
      scrollPositions.current[activeTab] = window.scrollY;
      setActiveTab(state.tab);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [location.state, activeTab]);

  // Handle query param tab (e.g., ?tab=maps)
  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (!tab) return;
    if (tab !== "home" && tab !== "cinema" && tab !== "prefeitura" && tab !== "maps" && tab !== "menu") return;
    if (tab === activeTab) return;
    scrollPositions.current[activeTab] = window.scrollY;
    setActiveTab(tab as TabType);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.search, activeTab]);

  // Função temporÃ¡ria para testar push
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
            title: "ðŸŽ‰ Teste de Push!",
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
        return <HomeSection cidadeSlug={slug} onMapClick={() => switchTab("maps")} />;
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

  const bottomNavActive = activeTab === "prefeitura" ? undefined : activeTab;

  return (
    <IonPage className="flex flex-col min-h-screen bg-background overflow-visible [contain:none]">
      {/* Main Content */}
      <main className="flex-1 pb-20">
        {isHome ? (
          <CidadeBanner
            bannerUrl={cidade?.banner_url}
            cidadeNome={cidade?.nome}
            userName={firstName}
            onMenuClick={() => switchTab("menu")}
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

      <BottomNavBar
        slug={slug}
        active={bottomNavActive}
        onHomeClick={handleHomeClick}
        onCinemaClick={() => switchTab("cinema")}
      />
    </IonPage>
  );
};

export default CidadePage;

