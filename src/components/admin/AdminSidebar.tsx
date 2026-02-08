import { LayoutDashboard, MapPin, Menu, X, Newspaper, Film, Megaphone } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const menuItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Cidades", url: "/admin/cidades", icon: MapPin },
  { title: "Jornal", url: "/admin/jornal", icon: Newspaper },
  { title: "Cinema", url: "/admin/cinema", icon: Film },
  { title: "Alô Prefeitura", url: "/admin/alo-prefeitura", icon: Megaphone },
];

const AdminSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden text-white hover:bg-white/10"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar - Pure Black */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 bg-black transition-transform lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center px-6">
          <h1 className="text-xl font-semibold text-white tracking-tight">Admin</h1>
        </div>

        <nav className="px-3 py-2 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/admin"}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
              activeClassName="bg-white/10 text-white font-medium"
              onClick={() => setIsOpen(false)}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default AdminSidebar;
