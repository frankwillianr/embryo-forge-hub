import { LayoutDashboard, MapPin, Menu, X, ArrowLeft } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const menuItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Cidades", url: "/admin/cidades", icon: MapPin },
];

const AdminSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-[60] bg-black text-white shadow-md hover:bg-black/90 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Abrir menu admin"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 bg-black transition-transform lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center px-6">
          <h1 className="tracking-tight text-xl font-semibold text-white">Admin</h1>
        </div>

        <nav className="space-y-1 px-3 py-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/admin"}
              className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
              activeClassName="bg-white/10 text-white font-medium"
              onClick={() => setIsOpen(false)}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          ))}

          <button
            onClick={() => {
              setIsOpen(false);
              navigate("/cidade/gv");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar para cidade</span>
          </button>
        </nav>
      </aside>
    </>
  );
};

export default AdminSidebar;
