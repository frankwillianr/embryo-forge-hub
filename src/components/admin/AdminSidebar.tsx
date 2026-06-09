import {
  LayoutDashboard,
  ArrowLeft,
  Newspaper,
  Film,
  Phone,
  Megaphone,
  CalendarDays,
  Music2,
  Building2,
  MessageCircle,
  Users,
  DollarSign,
  Rss,
  Bell,
  Activity,
  Lightbulb,
  Search,
  Briefcase,
  Smartphone,
  FolderTree,
  ShoppingBag,
  Trophy,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const cidadeMenuItems = [
  { id: "dashboard", title: "Dashboard", icon: LayoutDashboard, route: "/admin" },
  { id: "atividade", title: "Atividade", icon: Activity, route: "/admin/atividade" },
  { id: "enquete", title: "Enquete", icon: MessageCircle, route: "/admin/enquete" },
  { id: "sugestoes", title: "Sugestoes", icon: Lightbulb, route: "/admin/sugestoes" },
  { id: "verificar-ios", title: "Verificar iOS", icon: Smartphone, route: "/admin/verificar-ios" },
  { id: "scarping-cinema", title: "Scarping cinema", icon: Film, route: "/admin/scarping-cinema" },
  { id: "scraping-emprego", title: "Scraping emprego", icon: Briefcase, route: "/admin/scraping-emprego" },
  { id: "categorias-servicos", title: "Categorias de serviços", icon: FolderTree, route: "/admin/categorias-servicos" },
  { id: "jornal", title: "Jornal", icon: Newspaper },
  { id: "cinema", title: "Cinema", icon: Film },
  { id: "alo-prefeitura", title: "Voz do Povo", icon: Phone },
  { id: "banners", title: "Banners", icon: Megaphone },
  { id: "eventos", title: "Eventos", icon: CalendarDays },
  { id: "musica-ao-vivo", title: "Musica ao vivo", icon: Music2 },
  { id: "sorteio-copa-2026", title: "Sorteio Copa 2026", icon: Trophy },
  { id: "marketplace", title: "Marketplace", icon: ShoppingBag },
  { id: "empresas", title: "Empresas", icon: Building2 },
  { id: "comentarios", title: "Comentarios", icon: MessageCircle },
  { id: "usuarios", title: "Usuarios", icon: Users },
  { id: "admins", title: "Admins", icon: Users },
  { id: "precificacao", title: "Precificacao", icon: DollarSign },
  { id: "scraping", title: "Scraping noticias", icon: Rss },
  { id: "scraping-noticias-v2", title: "Scraping noticias V2", icon: Rss },
  { id: "scraping-eventos", title: "Scraping eventos", icon: Rss },
  { id: "push-notificacao", title: "Push notificacao", icon: Bell },
];

interface AdminSidebarProps {
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
}

const AdminSidebar = ({ isCollapsed, onCollapsedChange }: AdminSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedCidadeId, setSelectedCidadeId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("admin:selectedCidadeId") || "";
  });
  const selectedTab = new URLSearchParams(location.search).get("tab") || "jornal";

  const { data: cidades = [] } = useQuery({
    queryKey: ["admin-sidebar-cidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cidade").select("id, nome").order("nome");
      if (error) throw error;
      return data as Array<{ id: string; nome: string }>;
    },
  });

  useEffect(() => {
    const match = location.pathname.match(/^\/admin\/cidades\/([^/]+)/);
    if (match?.[1]) {
      const cidadeIdFromRoute = match[1];
      setSelectedCidadeId(cidadeIdFromRoute);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("admin:selectedCidadeId", cidadeIdFromRoute);
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleToggle = () => setIsOpen((prev) => !prev);
    const handleClose = () => setIsOpen(false);

    window.addEventListener("admin:toggle-sidebar", handleToggle as EventListener);
    window.addEventListener("admin:close-sidebar", handleClose as EventListener);

    return () => {
      window.removeEventListener("admin:toggle-sidebar", handleToggle as EventListener);
      window.removeEventListener("admin:close-sidebar", handleClose as EventListener);
    };
  }, []);

  const normalizedSearch = menuSearch.trim().toLowerCase();
  const filteredCidadeMenuItems = cidadeMenuItems.filter((item) =>
    item.title.toLowerCase().includes(normalizedSearch)
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-[100dvh] w-64 overflow-y-auto bg-black transition-[transform,width] duration-200 lg:h-screen lg:translate-x-0",
          isCollapsed ? "lg:w-20" : "lg:w-64",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}
      >
        <div className={cn("flex h-16 items-center gap-2 px-6", isCollapsed && "lg:justify-center lg:px-3")}>
          <h1 className={cn("tracking-tight text-xl font-semibold text-white", isCollapsed && "lg:hidden")}>
            Admin
          </h1>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "ml-auto hidden h-9 w-9 text-gray-400 hover:bg-white/10 hover:text-white lg:inline-flex",
              isCollapsed && "lg:ml-0",
            )}
            onClick={() => onCollapsedChange(!isCollapsed)}
            aria-label={isCollapsed ? "Expandir menu admin" : "Recolher menu admin"}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        <nav className={cn("space-y-1 px-3 py-2", isCollapsed && "lg:px-2")}>
          <div className={cn("px-1 pt-1 pb-2", isCollapsed && "lg:hidden")}>
            <p className="px-3 pb-2 text-[11px] uppercase tracking-wide text-gray-500">
              Selecionar cidade
            </p>
            <Select
              value={selectedCidadeId}
              onValueChange={(cidadeId) => {
                setSelectedCidadeId(cidadeId);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("admin:selectedCidadeId", cidadeId);
                }
                setIsOpen(false);
                navigate(`/admin/cidades/${cidadeId}`);
              }}
            >
              <SelectTrigger className="h-10 border-white/10 bg-white/5 text-sm text-white">
                <SelectValue placeholder="Escolha uma cidade" />
              </SelectTrigger>
              <SelectContent>
                {cidades.map((cidade) => (
                  <SelectItem key={cidade.id} value={cidade.id}>
                    {cidade.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCidadeId && (
            <div className="pt-2">
              <p className={cn("px-4 pb-2 text-[11px] uppercase tracking-wide text-gray-500", isCollapsed && "lg:hidden")}>
                Menus da cidade
              </p>
              <div className={cn("relative px-3 pb-2", isCollapsed && "lg:hidden")}>
                <Search className="pointer-events-none absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                <Input
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Buscar menu..."
                  className="h-9 border-white/10 bg-white/5 pl-8 text-sm text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-1">
                {filteredCidadeMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setIsOpen(false);
                      if ("route" in item) {
                        navigate(item.route);
                        return;
                      }
                      navigate(`/admin/cidades/${selectedCidadeId}?tab=${item.id}`);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm transition-colors",
                      isCollapsed && "lg:justify-center lg:px-0",
                      ("route" in item
                        ? location.pathname === item.route
                        : selectedTab === item.id && location.pathname === `/admin/cidades/${selectedCidadeId}`)
                        ? "bg-white/10 text-white font-medium"
                      : "text-gray-400 hover:bg-white/5 hover:text-white",
                    )}
                    title={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className={cn(isCollapsed && "lg:hidden")}>{item.title}</span>
                  </button>
                ))}
                {filteredCidadeMenuItems.length === 0 && !isCollapsed && (
                  <p className="px-4 py-2 text-xs text-gray-500">Nenhum menu encontrado.</p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setIsOpen(false);
              navigate("/cidade/gv");
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white",
              isCollapsed && "lg:justify-center lg:px-0",
            )}
            title="Voltar para cidade"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className={cn(isCollapsed && "lg:hidden")}>Voltar para cidade</span>
          </button>
        </nav>
      </aside>
    </>
  );
};

export default AdminSidebar;

