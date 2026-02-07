import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Clock, CheckCircle, XCircle, Eye } from "lucide-react";
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

interface AdminCidadeBannersProps {
  cidadeId: string;
}

const statusConfig = {
  pendente: { label: "Aguardando", variant: "secondary" as const, icon: Clock, color: "text-yellow-600" },
  aprovado: { label: "Aprovado", variant: "default" as const, icon: CheckCircle, color: "text-green-600" },
  rejeitado: { label: "Rejeitado", variant: "destructive" as const, icon: XCircle, color: "text-red-600" },
};

const AdminCidadeBanners = ({ cidadeId }: AdminCidadeBannersProps) => {
  const queryClient = useQueryClient();

  const { data: banners, isLoading } = useQuery({
    queryKey: ["admin-cidade-banners", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_banner")
        .select(`
          *,
          banner:banner_id (*)
        `)
        .eq("cidade_id", cidadeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ bannerId, status }: { bannerId: string; status: string }) => {
      const { error } = await supabase
        .from("banner")
        .update({ status })
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
  const pendentes = banners.filter((b: any) => b.banner?.status === "pendente" || !b.banner?.status);
  const aprovados = banners.filter((b: any) => b.banner?.status === "aprovado");
  const rejeitados = banners.filter((b: any) => b.banner?.status === "rejeitado");

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
                  {item.banner?.imagem_url ? (
                    <img
                      src={item.banner.imagem_url}
                      alt={item.banner.titulo}
                      className="w-16 h-10 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-10 bg-muted rounded flex items-center justify-center">
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {item.banner?.titulo || "Sem título"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {item.banner?.dias_comprados || 0} dias
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.banner?.created_at
                    ? new Date(item.banner.created_at).toLocaleDateString("pt-BR")
                    : "—"}
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
                            bannerId: item.banner_id,
                            status: "aprovado",
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            bannerId: item.banner_id,
                            status: "rejeitado",
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Recusar
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
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
          <Clock className="h-6 w-6 mx-auto text-yellow-600 mb-2" />
          <p className="text-2xl font-bold">{pendentes.length}</p>
          <p className="text-sm text-muted-foreground">Aguardando</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
          <CheckCircle className="h-6 w-6 mx-auto text-green-600 mb-2" />
          <p className="text-2xl font-bold">{aprovados.length}</p>
          <p className="text-sm text-muted-foreground">Aprovados</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
          <XCircle className="h-6 w-6 mx-auto text-red-600 mb-2" />
          <p className="text-2xl font-bold">{rejeitados.length}</p>
          <p className="text-sm text-muted-foreground">Rejeitados</p>
        </div>
      </div>

      {/* Tabs por status */}
      <Tabs defaultValue="pendentes">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pendentes" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Aguardando ({pendentes.length})
          </TabsTrigger>
          <TabsTrigger value="aprovados" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Aprovados ({aprovados.length})
          </TabsTrigger>
          <TabsTrigger value="rejeitados" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Rejeitados ({rejeitados.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          {renderBannerTable(pendentes, true)}
        </TabsContent>

        <TabsContent value="aprovados" className="mt-4">
          {renderBannerTable(aprovados)}
        </TabsContent>

        <TabsContent value="rejeitados" className="mt-4">
          {renderBannerTable(rejeitados)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCidadeBanners;
