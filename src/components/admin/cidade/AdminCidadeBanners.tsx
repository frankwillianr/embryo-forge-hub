import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Clock, CheckCircle, XCircle, CreditCard } from "lucide-react";
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

interface AdminCidadeBannersProps {
  cidadeId: string;
}

const AdminCidadeBanners = ({ cidadeId }: AdminCidadeBannersProps) => {
  const queryClient = useQueryClient();

  const { data: banners, isLoading } = useQuery({
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
      return bannersData || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ bannerId, ativo }: { bannerId: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("banner")
        .update({ ativo })
        .eq("id", bannerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-banners", cidadeId] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar status: " + error.message);
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (!banners || banners.length === 0) {
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

  // Agrupar por status
  const aguardandoPagamento = banners.filter((b: any) => b.status === "aguardando_pagamento");
  const pendentes = banners.filter((b: any) => b.status === "pendente" || b.ativo === null || b.ativo === undefined);
  const ativos = banners.filter((b: any) => b.ativo === true && b.status !== "aguardando_pagamento");
  const inativos = banners.filter((b: any) => b.ativo === false && b.status !== "aguardando_pagamento");

  const renderBannerTable = (items: any[], showActions: boolean = false) => (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Imagem</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Dias</TableHead>
            <TableHead>Criado em</TableHead>
            {showActions && <TableHead className="w-[200px]">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showActions ? 5 : 4} className="text-center py-8 text-muted-foreground">
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
                {showActions && (
                  <TableCell>
                    <div className="flex gap-2">
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
                    </div>
                  </TableCell>
                )}
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
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-muted/50 border rounded-lg p-4 text-center">
          <CreditCard className="h-6 w-6 mx-auto text-amber-600 mb-2" />
          <p className="text-2xl font-bold">{aguardandoPagamento.length}</p>
          <p className="text-sm text-muted-foreground">Aguardando Pagamento</p>
        </div>
        <div className="bg-muted/50 border rounded-lg p-4 text-center">
          <Clock className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-2xl font-bold">{pendentes.length}</p>
          <p className="text-sm text-muted-foreground">Pendentes</p>
        </div>
        <div className="bg-muted/50 border rounded-lg p-4 text-center">
          <CheckCircle className="h-6 w-6 mx-auto text-green-600 mb-2" />
          <p className="text-2xl font-bold">{ativos.length}</p>
          <p className="text-sm text-muted-foreground">Ativos</p>
        </div>
        <div className="bg-muted/50 border rounded-lg p-4 text-center">
          <XCircle className="h-6 w-6 mx-auto text-red-600 mb-2" />
          <p className="text-2xl font-bold">{inativos.length}</p>
          <p className="text-sm text-muted-foreground">Inativos</p>
        </div>
      </div>

      {/* Tabs por status */}
      <Tabs defaultValue="aguardando_pagamento">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="aguardando_pagamento" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Aguardando ({aguardandoPagamento.length})
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pendentes ({pendentes.length})
          </TabsTrigger>
          <TabsTrigger value="ativos" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Ativos ({ativos.length})
          </TabsTrigger>
          <TabsTrigger value="inativos" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Inativos ({inativos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aguardando_pagamento" className="mt-4">
          {renderBannerTable(aguardandoPagamento, false)}
        </TabsContent>

        <TabsContent value="pendentes" className="mt-4">
          {renderBannerTable(pendentes, true)}
        </TabsContent>

        <TabsContent value="ativos" className="mt-4">
          {renderBannerTable(ativos, true)}
        </TabsContent>

        <TabsContent value="inativos" className="mt-4">
          {renderBannerTable(inativos, true)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCidadeBanners;
