import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Clock, CheckCircle, XCircle, CreditCard, Pencil, CalendarCheck, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import BannerEditModal from "./BannerEditModal";

interface AdminCidadeBannersProps {
  cidadeId: string;
}

const AdminCidadeBanners = ({ cidadeId }: AdminCidadeBannersProps) => {
  const queryClient = useQueryClient();
  const [editingBanner, setEditingBanner] = useState<any>(null);

  const { data: bannersWithDias, isLoading } = useQuery({
    queryKey: ["admin-cidade-banners", cidadeId],
    queryFn: async () => {
      // Busca os banner_ids vinculados a esta cidade
      const { data: relData, error: relError } = await supabase
        .from("rel_cidade_banner")
        .select("banner_id")
        .eq("cidade_id", cidadeId);

      if (relError) throw relError;
      if (!relData || relData.length === 0) return [];

      const bannerIds = relData.map((r) => r.banner_id);

      // Busca os banners
      const { data: bannersData, error: bannersError } = await supabase
        .from("banner")
        .select("*")
        .in("id", bannerIds)
        .order("created_at", { ascending: false });

      if (bannersError) throw bannersError;

      // Buscar dias de exibição para cada banner
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
      // Update both 'ativo' field and 'status' field for consistency
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
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (!bannersWithDias || bannersWithDias.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/30">
        <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">Nenhum banner</h3>
        <p className="text-muted-foreground text-sm">
          Esta cidade ainda não possui banners promocionais.
        </p>
      </div>
    );
  }

  // Data de hoje para comparações
  const hoje = new Date().toISOString().split("T")[0];

  // Agrupar por status
  const aguardandoPagamento = bannersWithDias.filter((b: any) => b.status === "aguardando_pagamento");
  const pendentes = bannersWithDias.filter((b: any) => 
    b.status === "pendente" || 
    (b.status !== "aguardando_pagamento" && (b.ativo === null || b.ativo === undefined))
  );
  
  // Ativos Futuros: banners ativos com pelo menos um dia de exibição >= hoje
  const ativosFuturos = bannersWithDias.filter((b: any) => {
    if (b.ativo !== true || b.status === "aguardando_pagamento" || b.status === "pendente") return false;
    return b.dias_exibicao?.some((d: any) => d.data_exibicao >= hoje);
  });
  
  // Ativos Passados (Finalizados): banners ativos onde todos os dias são < hoje
  const ativosPassados = bannersWithDias.filter((b: any) => {
    if (b.ativo !== true || b.status === "aguardando_pagamento" || b.status === "pendente") return false;
    if (!b.dias_exibicao || b.dias_exibicao.length === 0) return false;
    return b.dias_exibicao.every((d: any) => d.data_exibicao < hoje);
  });
  
  const inativos = bannersWithDias.filter((b: any) => 
    b.ativo === false && 
    b.status !== "aguardando_pagamento"
  );

  const renderBannerTable = (items: any[], showActions: boolean = false) => (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Imagem</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Dias</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="w-[280px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                Nenhum banner nesta categoria
              </TableCell>
            </TableRow>
          ) : (
            items.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell>
                  {item.imagem_url ? (
                    <img
                      src={item.imagem_url}
                      alt={item.titulo}
                      className="w-16 h-10 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-10 bg-muted rounded flex items-center justify-center">
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {item.titulo || "Sem título"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {item.dias_comprados || 0} dias
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingBanner(item)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    {showActions && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              bannerId: item.id,
                              ativo: true,
                            })
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Ativar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              bannerId: item.id,
                              ativo: false,
                            })
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Desativar
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-muted/50 border rounded-lg p-3 text-center">
          <CreditCard className="h-5 w-5 mx-auto text-amber-600 mb-1" />
          <p className="text-xl font-bold">{aguardandoPagamento.length}</p>
          <p className="text-xs text-muted-foreground">Aguardando Pag.</p>
        </div>
        <div className="bg-muted/50 border rounded-lg p-3 text-center">
          <Clock className="h-5 w-5 mx-auto text-blue-600 mb-1" />
          <p className="text-xl font-bold">{pendentes.length}</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </div>
        <div className="bg-muted/50 border rounded-lg p-3 text-center">
          <CalendarCheck className="h-5 w-5 mx-auto text-green-600 mb-1" />
          <p className="text-xl font-bold">{ativosFuturos.length}</p>
          <p className="text-xs text-muted-foreground">Ativos/Futuros</p>
        </div>
        <div className="bg-muted/50 border rounded-lg p-3 text-center">
          <History className="h-5 w-5 mx-auto text-gray-500 mb-1" />
          <p className="text-xl font-bold">{ativosPassados.length}</p>
          <p className="text-xs text-muted-foreground">Finalizados</p>
        </div>
        <div className="bg-muted/50 border rounded-lg p-3 text-center">
          <XCircle className="h-5 w-5 mx-auto text-red-600 mb-1" />
          <p className="text-xl font-bold">{inativos.length}</p>
          <p className="text-xs text-muted-foreground">Recusados</p>
        </div>
      </div>

      {/* Tabs por status */}
      <Tabs defaultValue="pendentes">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="aguardando_pagamento" className="flex flex-col items-center gap-1 text-xs py-2">
            <CreditCard className="h-4 w-4" />
            <span>Aguardando ({aguardandoPagamento.length})</span>
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="flex flex-col items-center gap-1 text-xs py-2">
            <Clock className="h-4 w-4" />
            <span>Pendentes ({pendentes.length})</span>
          </TabsTrigger>
          <TabsTrigger value="ativos_futuros" className="flex flex-col items-center gap-1 text-xs py-2">
            <CalendarCheck className="h-4 w-4" />
            <span>Ativos ({ativosFuturos.length})</span>
          </TabsTrigger>
          <TabsTrigger value="ativos_passados" className="flex flex-col items-center gap-1 text-xs py-2">
            <History className="h-4 w-4" />
            <span>Finalizados ({ativosPassados.length})</span>
          </TabsTrigger>
          <TabsTrigger value="inativos" className="flex flex-col items-center gap-1 text-xs py-2">
            <XCircle className="h-4 w-4" />
            <span>Recusados ({inativos.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aguardando_pagamento" className="mt-4">
          {renderBannerTable(aguardandoPagamento, false)}
        </TabsContent>

        <TabsContent value="pendentes" className="mt-4">
          {renderBannerTable(pendentes, true)}
        </TabsContent>

        <TabsContent value="ativos_futuros" className="mt-4">
          {renderBannerTable(ativosFuturos, true)}
        </TabsContent>

        <TabsContent value="ativos_passados" className="mt-4">
          {renderBannerTable(ativosPassados, false)}
        </TabsContent>

        <TabsContent value="inativos" className="mt-4">
          {renderBannerTable(inativos, false)}
        </TabsContent>
      </Tabs>

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
