import { useState } from "react";
import { Home, Newspaper, Film, User } from "lucide-react";
import DynamicBanner from "@/components/DynamicBanner";
import HomeSection from "@/components/sections/HomeSection";
import JornalSection from "@/components/sections/JornalSection";
import CinemaSection from "@/components/sections/CinemaSection";
import PerfilSection from "@/components/sections/PerfilSection";

type TabType = "home" | "jornal" | "cinema" | "perfil";

const navItems = [
  { id: "home" as TabType, title: "Home", icon: Home },
  { id: "jornal" as TabType, title: "Jornal", icon: Newspaper },
  { id: "cinema" as TabType, title: "Cinema", icon: Film },
  { id: "perfil" as TabType, title: "Perfil", icon: User },
];

const CidadePage = () => {
  const [activeTab, setActiveTab] = useState<TabType>("home");

  const renderSection = () => {
    switch (activeTab) {
      case "home":
        return <HomeSection />;
      case "jornal":
        return <JornalSection />;
      case "cinema":
        return <CinemaSection />;
      case "perfil":
        return <PerfilSection />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-16">
        <DynamicBanner />
        
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
        </div>
      </nav>
    </div>
  );
};

export default CidadePage;
