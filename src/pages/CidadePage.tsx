import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Home, Newspaper, Film, Megaphone, Menu, ArrowLeft, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CidadeBanner from "@/components/CidadeBanner";
import HomeSection from "@/components/sections/HomeSection";
import JornalSection from "@/components/sections/JornalSection";
import CinemaSection from "@/components/sections/CinemaSection";
import AloPrefeituraSection from "@/components/sections/AloPrefeituraSection";
import MenuSheet from "@/components/menu/MenuSheet";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

type TabType = "home" | "jornal" | "cinema" | "prefeitura";

const navItems = [
  { id: "home" as TabType, title: "Home", icon: Home },
  { id: "jornal" as TabType, title: "Jornal", icon: Newspaper },
  { id: "cinema" as TabType, title: "Cinema", icon: Film },
  { id: "prefeitura" as TabType, title: "Prefeitura", icon: Megaphone },
];

const sectionTitles: Record<TabType, string> = {
  home: "Home",
  jornal: "jornal da cidade",
  cinema: "Cinema",
  prefeitura: "Alô Prefeitura",
};

const CidadePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [menuOpen, setMenuOpen] = useState(false);

  // Busca dados da cidade
  const { data: cidade } = useQuery({
    queryKey: ["cidade", slug],
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
    if (permissionStatus === 'granted') {
      console.log('Push notifications ativadas para esta cidade');
    }
  }, [permissionStatus]);

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

  const renderSection = () => {
    switch (activeTab) {
      case "home":
        return <HomeSection cidadeSlug={slug} />;
      case "jornal":
        return <JornalSection cidadeSlug={slug} />;
      case "cinema":
        return <CinemaSection cidadeSlug={slug} />;
      case "prefeitura":
        return <AloPrefeituraSection cidadeSlug={slug} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        {isHome ? (
          <CidadeBanner bannerUrl={cidade?.banner_url} cidadeNome={cidade?.nome} />
        ) : (
          <header className="flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab("home")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">
              {sectionTitles[activeTab]}
            </h1>
          </header>
        )}
        
        <div className="animate-in fade-in duration-300">
          {renderSection()}
        </div>
      </main>

      {/* Bottom Navigation - Stylish */}
      <nav className="fixed bottom-0 left-0 right-0 z-50">
        {/* Background with blur */}
        <div className="absolute inset-0 bg-card/80 backdrop-blur-xl border-t border-border/50" />
        
        <div className="relative flex h-16 items-end justify-center max-w-md mx-auto px-2">
          {/* Left items */}
          <div className="flex flex-1 justify-around items-center pb-2">
            <button
              onClick={() => setActiveTab("jornal")}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all duration-200 ${
                activeTab === "jornal"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Newspaper className="h-[18px] w-[18px]" />
              <span className="text-[10px] font-medium">Jornal</span>
            </button>

            <button
              onClick={() => setActiveTab("cinema")}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all duration-200 ${
                activeTab === "cinema"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Film className="h-[18px] w-[18px]" />
              <span className="text-[10px] font-medium">Cinema</span>
            </button>
          </div>

          {/* Center Home Button - Floating */}
          <div className="relative flex flex-col items-center -mt-2 mx-2">
            <button
              onClick={() => setActiveTab("home")}
              className={`relative flex items-center justify-center w-11 h-11 rounded-full shadow-lg transition-all duration-300 ${
                activeTab === "home"
                  ? "bg-primary text-primary-foreground shadow-primary/30"
                  : "bg-card text-muted-foreground border border-border hover:border-primary/50 hover:text-primary"
              }`}
              style={{
                boxShadow: activeTab === "home" 
                  ? "0 6px 16px -3px hsl(var(--primary) / 0.4)" 
                  : "0 3px 8px -2px rgba(0,0,0,0.1)"
              }}
            >
              <Home className="h-5 w-5" />
            </button>
            <span className={`text-[10px] font-medium mt-0.5 transition-colors ${
              activeTab === "home" ? "text-primary" : "text-muted-foreground"
            }`}>
              Home
            </span>
          </div>

          {/* Right items */}
          <div className="flex flex-1 justify-around items-center pb-2">
            <button
              onClick={() => setActiveTab("prefeitura")}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all duration-200 ${
                activeTab === "prefeitura"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Megaphone className="h-[18px] w-[18px]" />
              <span className="text-[10px] font-medium">Alô</span>
            </button>

            <button
              onClick={() => setMenuOpen(true)}
              className="flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-[18px] w-[18px]" />
              <span className="text-[10px] font-medium">Menu</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Menu Sheet */}
      <MenuSheet 
        open={menuOpen} 
        onOpenChange={setMenuOpen} 
        cidadeNome={cidade?.nome} 
      />
    </div>
  );
};

export default CidadePage;
