import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, CheckCircle, XCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import BannerEditModal from "./BannerEditModal";
import { cn } from "@/lib/utils";

interface AdminCidadeBannersProps {
  cidadeId: string;
}

const filterButtons = [
  { id: "aguardando_pagamento", label: "Aguardando" },
  { id: "pendentes", label: "Pendentes" },
  { id: "ativos_futuros", label: "Ativos" },
  { id: "ativos_passados", label: "Finalizados" },
  { id: "inativos", label: "Recusados" },
];

const AdminCidadeBanners = ({ cidadeId }: AdminCidadeBannersProps) => {
  const queryClient = useQueryClient();
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState("pendentes");

  const { data: bannersWithDias, isLoading } = useQuery({
    queryKey: ["admin-cidade-banners", cidadeId],
    queryFn: async () => {
      const { data: relData, error: relError } = await supabase
        .from("rel_cidade_banner")
        .select("banner_id")
        .eq("cidade_id", cidadeId);

      if (relError) throw relError;
      if (!relData || relData.length === 0) return [];

      const bannerIds = relData.map((r) => r.banner_id);

      const { data: bannersData, error: bannersError } = await supabase
        .from("banner")
        .select("*")
        .in("id", bannerIds)
        .order("created_at", { ascending: false });

      if (bannersError) throw bannersError;

      const bannersWithDiasData = await Promise.all(
        (bannersData || []).map(async (banner) => {
          const { data: dias } = await supabase
            .from("rel_banner_dias")
            .select("data_exibicao")
            .eq("banner_id", banner.id)
            .order("data_exibicao", { ascending: true });

          return {
            ...banner,
            dias_exibicao: dias || [],
          };
        })
      );

      return bannersWithDiasData;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ bannerId, ativo }: { bannerId: string; ativo: boolean }) => {
      const newStatus = ativo ? "ativo" : "inativo";
      
      const { error } = await supabase
        .from("banner")
        .update({ 
          ativo,
          status: newStatus 
        })
        .eq("id", bannerId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-banners", cidadeId] });
      const action = variables.ativo ? "ativado" : "desativado";
      toast.success(`Banner ${action} com sucesso!`);
    },
    onError: (error: any) => {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status: " + error.message);
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">Carregando...</div>;
  }

  if (!bannersWithDias || bannersWithDias.length === 0) {
    return (
      <div className="text-center py-12">
        <Megaphone className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <h3 className="font-medium text-gray-900 mb-1">Nenhum banner</h3>
        <p className="text-gray-400 text-sm">
          Esta cidade ainda não possui banners promocionais.
        </p>
      </div>
    );
  }

  const hoje = new Date().toISOString().split("T")[0];

  const aguardandoPagamento = bannersWithDias.filter((b: any) => b.status === "aguardando_pagamento");
  const pendentes = bannersWithDias.filter((b: any) => 
    b.status === "pendente" || 
    (b.status !== "aguardando_pagamento" && (b.ativo === null || b.ativo === undefined))
  );
  
  const ativosFuturos = bannersWithDias.filter((b: any) => {
    if (b.ativo !== true || b.status === "aguardando_pagamento" || b.status === "pendente") return false;
    return b.dias_exibicao?.some((d: any) => d.data_exibicao >= hoje);
  });
  
  const ativosPassados = bannersWithDias.filter((b: any) => {
    if (b.ativo !== true || b.status === "aguardando_pagamento" || b.status === "pendente") return false;
    if (!b.dias_exibicao || b.dias_exibicao.length === 0) return false;
    return b.dias_exibicao.every((d: any) => d.data_exibicao < hoje);
  });
  
  const inativos = bannersWithDias.filter((b: any) => 
    b.ativo === false && 
    b.status !== "aguardando_pagamento"
  );

  const getFilteredBanners = () => {
    switch (activeFilter) {
      case "aguardando_pagamento": return aguardandoPagamento;
      case "pendentes": return pendentes;
      case "ativos_futuros": return ativosFuturos;
      case "ativos_passados": return ativosPassados;
      case "inativos": return inativos;
      default: return pendentes;
    }
  };

  const getCount = (filterId: string) => {
    switch (filterId) {
      case "aguardando_pagamento": return aguardandoPagamento.length;
      case "pendentes": return pendentes.length;
      case "ativos_futuros": return ativosFuturos.length;
      case "ativos_passados": return ativosPassados.length;
      case "inativos": return inativos.length;
      default: return 0;
    }
  };

  const showActions = activeFilter === "pendentes" || activeFilter === "ativos_futuros";
  const filteredBanners = getFilteredBanners();

  return (
    <div className="space-y-6">
      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {filterButtons.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeFilter === filter.id
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {filter.label} ({getCount(filter.id)})
          </button>
        ))}
      </div>

      {/* Banner List */}
      <div className="space-y-3">
        {filteredBanners.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Nenhum banner nesta categoria
          </div>
        ) : (
          filteredBanners.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
            >
              <div className="flex items-center gap-4">
                {item.imagem_url ? (
                  <img
                    src={item.imagem_url}
                    alt={item.titulo}
                    className="w-16 h-10 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-16 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                    <Megaphone className="h-4 w-4 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">
                    {item.titulo || "Sem título"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs border-gray-200 text-gray-500">
                      {item.dias_comprados || 0} dias
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-500 hover:text-gray-900"
                  onClick={() => setEditingBanner(item)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {showActions && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          bannerId: item.id,
                          ativo: true,
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          bannerId: item.id,
                          ativo: false,
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de edição */}
      <BannerEditModal
        banner={editingBanner}
        cidadeId={cidadeId}
        open={!!editingBanner}
        onOpenChange={(open) => !open && setEditingBanner(null)}
      />
    </div>
  );
};

export default AdminCidadeBanners;
