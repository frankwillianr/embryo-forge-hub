import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, Briefcase, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import VagaCard from "@/components/vagas/VagaCard";

const MinhasVagasPage = () => {
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

  // Buscar vagas do usuário para esta cidade
  const { data: vagas, isLoading } = useQuery({
    queryKey: ["minhas-vagas", user?.id, cidade?.id],
    queryFn: async () => {
      if (!user?.id || !cidade?.id) return [];

      const { data, error } = await supabase
        .from("rel_cidade_vagas")
        .select("*")
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
        <Briefcase className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4 text-center">
          Você precisa estar logado para ver suas vagas.
        </p>
        <Button onClick={() => navigate(`/cidade/${slug}/auth`)}>
          Fazer Login
        </Button>
      </div>
    );
  }

  // Categorizar vagas por status
  const ativas = vagas?.filter((v) => v.status === "ativo") || [];
  const pendentes = vagas?.filter((v) => v.status === "pendente") || [];
  const inativas = vagas?.filter((v) => v.status === "inativo") || [];

  const renderEmptyState = (message: string) => (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        <Briefcase className="h-8 w-8 text-muted-foreground" />
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
            <h1 className="font-bold text-lg">Minhas Vagas</h1>
            <p className="text-xs text-muted-foreground">{cidade?.nome}</p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/cidade/${slug}/vagas/nova`)}
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
          <Tabs defaultValue="ativas" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="ativas" className="flex flex-col gap-1 py-2 text-xs">
                <span>Ativas</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {ativas.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pendentes" className="flex flex-col gap-1 py-2 text-xs">
                <span>Pendentes</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {pendentes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="inativas" className="flex flex-col gap-1 py-2 text-xs">
                <span>Inativas</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {inativas.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ativas" className="mt-4 space-y-3">
              {ativas.length > 0 ? (
                ativas.map((vaga) => (
                  <VagaCard key={vaga.id} vaga={vaga} />
                ))
              ) : (
                renderEmptyState("Nenhuma vaga ativa no momento")
              )}
            </TabsContent>

            <TabsContent value="pendentes" className="mt-4 space-y-3">
              {pendentes.length > 0 ? (
                pendentes.map((vaga) => (
                  <VagaCard key={vaga.id} vaga={vaga} />
                ))
              ) : (
                renderEmptyState("Nenhuma vaga aguardando aprovação")
              )}
            </TabsContent>

            <TabsContent value="inativas" className="mt-4 space-y-3">
              {inativas.length > 0 ? (
                inativas.map((vaga) => (
                  <VagaCard key={vaga.id} vaga={vaga} />
                ))
              ) : (
                renderEmptyState("Nenhuma vaga inativa")
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default MinhasVagasPage;
