import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Home, Newspaper, Film, Megaphone, Menu, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CidadeBanner from "@/components/CidadeBanner";
import HomeSection from "@/components/sections/HomeSection";
import JornalSection from "@/components/sections/JornalSection";
import CinemaSection from "@/components/sections/CinemaSection";
import AloPrefeituraSection from "@/components/sections/AloPrefeituraSection";
import MenuSheet from "@/components/menu/MenuSheet";
import { Button } from "@/components/ui/button";

type TabType = "home" | "jornal" | "cinema" | "prefeitura";

const navItems = [
  { id: "home" as TabType, title: "Home", icon: Home },
  { id: "jornal" as TabType, title: "Jornal", icon: Newspaper },
  { id: "cinema" as TabType, title: "Cinema", icon: Film },
  { id: "prefeitura" as TabType, title: "Prefeitura", icon: Megaphone },
];

const sectionTitles: Record<TabType, string> = {
  home: "Home",
  jornal: "Jornal",
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
      <main className="flex-1 overflow-auto pb-16">
        {isHome ? (
          <CidadeBanner bannerUrl={cidade?.banner_url} cidadeNome={cidade?.nome} />
        ) : (
          <header className="flex items-center gap-3 p-4 border-b border-border bg-card">
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

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border">
        <div className="flex h-full items-center justify-around max-w-md mx-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors ${
                activeTab === item.id
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.title}</span>
            </button>
          ))}
          
          {/* Menu Button */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
            <span className="text-xs font-medium">Menu</span>
          </button>
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
