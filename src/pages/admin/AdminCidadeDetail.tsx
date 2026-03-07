import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Newspaper, Film, Phone, Megaphone, DollarSign, MessageCircle, Users, Building2, CalendarDays, Rss } from "lucide-react";
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
import { cn } from "@/lib/utils";

const tabs = [
  { id: "jornal", label: "Jornal", icon: Newspaper },
  { id: "cinema", label: "Cinema", icon: Film },
  { id: "alo-prefeitura", label: "Alô Prefeitura", icon: Phone },
  { id: "banners", label: "Banners", icon: Megaphone },
  { id: "eventos", label: "Eventos", icon: CalendarDays },
  { id: "empresas", label: "Empresas", icon: Building2 },
  { id: "comentarios", label: "Comentários", icon: MessageCircle },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "precificacao", label: "Precificação", icon: DollarSign },
  { id: "scraping", label: "Scraping", icon: Rss },
];

const AdminCidadeDetail = () => {
  const { cidadeId } = useParams<{ cidadeId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("jornal");

  // Fetch cidade details
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
        <div className="text-gray-400">Cidade não encontrada</div>
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate("/admin/cidades")}
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
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

      {/* Tab Buttons */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-black text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        {activeTab === "jornal" && <AdminCidadeJornal cidadeId={cidadeId!} />}
        {activeTab === "cinema" && <AdminCidadeCinema cidadeId={cidadeId!} />}
        {activeTab === "alo-prefeitura" && <AdminCidadeAloPrefeitura cidadeId={cidadeId!} />}
        {activeTab === "banners" && <AdminCidadeBanners cidadeId={cidadeId!} />}
        {activeTab === "eventos" && <AdminCidadeEventos cidadeId={cidadeId!} />}
        {activeTab === "empresas" && <AdminCidadeEmpresas cidadeId={cidadeId!} />}
        {activeTab === "comentarios" && <AdminCidadeComentarios cidadeId={cidadeId!} />}
        {activeTab === "usuarios" && <AdminCidadeUsuarios cidadeId={cidadeId!} />}
        {activeTab === "precificacao" && <AdminCidadePrecificacao cidadeId={cidadeId!} />}
        {activeTab === "scraping" && <AdminCidadeScraping cidadeId={cidadeId!} />}
      </div>
    </div>
  );
};

export default AdminCidadeDetail;
