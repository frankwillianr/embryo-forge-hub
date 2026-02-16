import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, Car, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import VeiculoCard from "@/components/veiculos/VeiculoCard";

const MeusVeiculosPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Buscar cidade
  const { data: cidade } = useQuery({
    queryKey: ["cidade-by-slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Buscar veículos do usuário para esta cidade
  const { data: veiculos, isLoading } = useQuery({
    queryKey: ["meus-veiculos", user?.id, cidade?.id],
    queryFn: async () => {
      if (!user?.id || !cidade?.id) return [];

      const { data, error } = await supabase
        .from("rel_cidade_veiculos")
        .select(`
          *,
          marca:marca_id(id, nome),
          modelo:modelo_id(id, nome)
        `)
        .eq("user_id", user.id)
        .eq("cidade_id", cidade.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!cidade?.id,
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Car className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4 text-center">
          Você precisa estar logado para ver seus veículos.
        </p>
        <Button onClick={() => navigate(`/cidade/${slug}/auth`)}>
          Fazer Login
        </Button>
      </div>
    );
  }

  // Categorizar veículos por status
  const ativos = veiculos?.filter((v) => v.status === "ativo") || [];
  const pendentes = veiculos?.filter((v) => v.status === "pendente") || [];
  const inativos = veiculos?.filter((v) => v.status === "inativo") || [];

  const renderEmptyState = (message: string) => (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        <Car className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border pt-safe">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/cidade/${slug}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Meus Veículos</h1>
            <p className="text-xs text-muted-foreground">{cidade?.nome}</p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/cidade/${slug}/veiculos/novo`)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Anunciar</span>
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="ativos" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="ativos" className="flex flex-col gap-1 py-2 text-xs">
                <span>Ativos</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {ativos.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pendentes" className="flex flex-col gap-1 py-2 text-xs">
                <span>Pendentes</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {pendentes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="inativos" className="flex flex-col gap-1 py-2 text-xs">
                <span>Inativos</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {inativos.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ativos" className="mt-4 space-y-3">
              {ativos.length > 0 ? (
                ativos.map((veiculo) => (
                  <VeiculoCard key={veiculo.id} veiculo={veiculo} cidadeSlug={slug} />
                ))
              ) : (
                renderEmptyState("Nenhum veículo ativo no momento")
              )}
            </TabsContent>

            <TabsContent value="pendentes" className="mt-4 space-y-3">
              {pendentes.length > 0 ? (
                pendentes.map((veiculo) => (
                  <VeiculoCard key={veiculo.id} veiculo={veiculo} cidadeSlug={slug} />
                ))
              ) : (
                renderEmptyState("Nenhum veículo aguardando aprovação")
              )}
            </TabsContent>

            <TabsContent value="inativos" className="mt-4 space-y-3">
              {inativos.length > 0 ? (
                inativos.map((veiculo) => (
                  <VeiculoCard key={veiculo.id} veiculo={veiculo} cidadeSlug={slug} />
                ))
              ) : (
                renderEmptyState("Nenhum veículo inativo")
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default MeusVeiculosPage;
