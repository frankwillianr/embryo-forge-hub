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

const cidadeMenuItems = [
  { id: "dashboard", title: "Dashboard", icon: LayoutDashboard, route: "/admin" },
  { id: "atividade", title: "Atividade", icon: Activity, route: "/admin/atividade" },
  { id: "enquete", title: "Enquete", icon: MessageCircle, route: "/admin/enquete" },
  { id: "sugestoes", title: "Sugestoes", icon: Lightbulb, route: "/admin/sugestoes" },
  { id: "jornal", title: "Jornal", icon: Newspaper },
  { id: "cinema", title: "Cinema", icon: Film },
  { id: "alo-prefeitura", title: "Voz do Povo", icon: Phone },
  { id: "banners", title: "Banners", icon: Megaphone },
  { id: "eventos", title: "Eventos", icon: CalendarDays },
  { id: "musica-ao-vivo", title: "Musica ao vivo", icon: Music2 },
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

const AdminSidebar = () => {
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
          "fixed left-0 top-0 z-40 h-[100dvh] w-64 overflow-y-auto bg-black transition-transform lg:h-screen lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}
      >
        <div className="flex h-16 items-center px-6">
          <h1 className="tracking-tight text-xl font-semibold text-white">Admin</h1>
        </div>

        <nav className="space-y-1 px-3 py-2">
          <div className="px-1 pt-1 pb-2">
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
              <p className="px-4 pb-2 text-[11px] uppercase tracking-wide text-gray-500">
                Menus da cidade
              </p>
              <div className="relative px-3 pb-2">
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
                      ("route" in item
                        ? location.pathname === item.route
                        : selectedTab === item.id && location.pathname === `/admin/cidades/${selectedCidadeId}`)
                        ? "bg-white/10 text-white font-medium"
                        : "text-gray-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </button>
                ))}
                {filteredCidadeMenuItems.length === 0 && (
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

