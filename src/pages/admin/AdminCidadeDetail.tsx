import { useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Newspaper, Film, Phone, Megaphone, DollarSign, MessageCircle, Users, Building2, CalendarDays, Rss, Bell, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Cidade } from "@/types/cidade";
import AdminCidadeJornal from "@/components/admin/cidade/AdminCidadeJornal";
import AdminCidadeCinema from "@/components/admin/cidade/AdminCidadeCinema";
import AdminCidadeAloPrefeitura from "@/components/admin/cidade/AdminCidadeAloPrefeitura";
import AdminCidadeBanners from "@/components/admin/cidade/AdminCidadeBanners";
import AdminCidadePrecificacao from "@/components/admin/cidade/AdminCidadePrecificacao";
import AdminCidadeComentarios from "@/components/admin/cidade/AdminCidadeComentarios";
import AdminCidadeUsuarios from "@/components/admin/cidade/AdminCidadeUsuarios";
import AdminCidadeEmpresas from "@/components/admin/cidade/AdminCidadeEmpresas";
import AdminCidadeEventos from "@/components/admin/cidade/AdminCidadeEventos";
import AdminCidadeScraping from "@/components/admin/cidade/AdminCidadeScraping";
import AdminCidadeScrapingNoticiasV2 from "@/components/admin/cidade/AdminCidadeScrapingNoticiasV2";
import AdminCidadeScrapingEventos from "@/components/admin/cidade/AdminCidadeScrapingEventos";
import AdminCidadePushNotifications from "@/components/admin/cidade/AdminCidadePushNotifications";
import AdminCidadeAdmins from "@/components/admin/cidade/AdminCidadeAdmins";
import AdminCidadeMusicaAoVivo from "@/components/admin/cidade/AdminCidadeMusicaAoVivo";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "jornal", label: "Jornal", icon: Newspaper },
  { id: "cinema", label: "Cinema", icon: Film },
  { id: "alo-prefeitura", label: "Voz do Povo", icon: Phone },
  { id: "banners", label: "Banners", icon: Megaphone },
  { id: "eventos", label: "Eventos", icon: CalendarDays },
  { id: "musica-ao-vivo", label: "Musica ao vivo", icon: Music2 },
  { id: "empresas", label: "Empresas", icon: Building2 },
  { id: "comentarios", label: "Comentarios", icon: MessageCircle },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "admins", label: "Admins", icon: Users },
  { id: "precificacao", label: "Precificacao", icon: DollarSign },
  { id: "scraping", label: "scarpping de noticas", icon: Rss },
  { id: "scraping-noticias-v2", label: "scraping de noticias v2", icon: Rss },
  { id: "scraping-eventos", label: "scraping de eventos", icon: Rss },
  { id: "push-notificacao", label: "Push notificação", icon: Bell },
];

const AdminCidadeDetail = () => {
  const { cidadeId } = useParams<{ cidadeId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = useMemo(() => {
    const requested = searchParams.get("tab") || "jornal";
    return tabs.some((tab) => tab.id === requested) ? requested : "jornal";
  }, [searchParams]);

  const { data: cidade, isLoading } = useQuery({
    queryKey: ["cidade", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("*")
        .eq("id", cidadeId)
        .maybeSingle();

      if (error) throw error;
      return data as Cidade | null;
    },
    enabled: !!cidadeId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Carregando...</div>
      </div>
    );
  }

  if (!cidade) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-gray-400">Cidade nao encontrada</div>
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/cidades")}
          className="text-gray-600"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4">
          {cidade.banner_url && (
            <img
              src={cidade.banner_url}
              alt={cidade.nome}
              className="w-16 h-10 object-cover rounded-lg"
            />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{cidade.nome}</h1>
            <p className="text-gray-400 text-sm">/{cidade.slug}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        {activeTab === "jornal" && <AdminCidadeJornal cidadeId={cidadeId!} />}
        {activeTab === "cinema" && <AdminCidadeCinema cidadeId={cidadeId!} />}
        {activeTab === "alo-prefeitura" && <AdminCidadeAloPrefeitura cidadeId={cidadeId!} />}
        {activeTab === "banners" && <AdminCidadeBanners cidadeId={cidadeId!} />}
        {activeTab === "eventos" && <AdminCidadeEventos cidadeId={cidadeId!} />}
        {activeTab === "musica-ao-vivo" && <AdminCidadeMusicaAoVivo cidadeId={cidadeId!} />}
        {activeTab === "empresas" && <AdminCidadeEmpresas cidadeId={cidadeId!} />}
        {activeTab === "comentarios" && <AdminCidadeComentarios cidadeId={cidadeId!} />}
        {activeTab === "usuarios" && <AdminCidadeUsuarios cidadeId={cidadeId!} />}
        {activeTab === "admins" && <AdminCidadeAdmins cidadeId={cidadeId!} />}
        {activeTab === "precificacao" && <AdminCidadePrecificacao cidadeId={cidadeId!} />}
        {activeTab === "scraping" && <AdminCidadeScraping cidadeId={cidadeId!} />}
        {activeTab === "scraping-noticias-v2" && <AdminCidadeScrapingNoticiasV2 cidadeId={cidadeId!} />}
        {activeTab === "scraping-eventos" && <AdminCidadeScrapingEventos cidadeId={cidadeId!} />}
        {activeTab === "push-notificacao" && <AdminCidadePushNotifications cidadeId={cidadeId!} />}
      </div>
    </div>
  );
};

export default AdminCidadeDetail;



