import { NavLink } from "@/components/NavLink";
import { Settings, MapPin } from "lucide-react";

interface MobileLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { title: "Cidade", url: "/cidade", icon: MapPin },
  { title: "Admin", url: "/admin", icon: Settings },
];

const MobileLayout = ({ children }: MobileLayoutProps) => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-16">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border">
        <div className="flex h-full items-center justify-around max-w-md mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              className="flex flex-col items-center justify-center gap-1 px-6 py-2 text-muted-foreground transition-colors"
              activeClassName="text-primary"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.title}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default MobileLayout;
