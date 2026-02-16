import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, Megaphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import AloPrefeituraCard from "@/components/aloPrefeitura/AloPrefeituraCard";
import { useState } from "react";
import NovaDenunciaModal from "@/components/aloPrefeitura/NovaDenunciaModal";

const MinhasDenunciasPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

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

  // Buscar denúncias do usuário para esta cidade
  const { data: denuncias, isLoading } = useQuery({
    queryKey: ["minhas-denuncias", user?.id, cidade?.id],
    queryFn: async () => {
      if (!user?.id || !cidade?.id) return [];

      const { data, error } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .select("*")
        .eq("user_id", user.id)
        .eq("cidade_id", cidade.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar imagens para cada denúncia
      if (!data || data.length === 0) return [];

      const denunciaIds = data.map((d) => d.id);
      const { data: imagensData } = await supabase
        .from("rel_cidade_alo_prefeitura_imagens")
        .select("*")
        .in("alo_prefeitura_id", denunciaIds)
        .order("ordem");

      // Agrupar imagens por denúncia
      const imagensPorDenuncia = (imagensData || []).reduce((acc, img) => {
        if (!acc[img.alo_prefeitura_id]) acc[img.alo_prefeitura_id] = [];
        acc[img.alo_prefeitura_id].push(img);
        return acc;
      }, {} as Record<string, any[]>);

      return data.map((d) => ({
        ...d,
        imagens: imagensPorDenuncia[d.id] || [],
      }));
    },
    enabled: !!user?.id && !!cidade?.id,
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Megaphone className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4 text-center">
          Você precisa estar logado para ver suas denúncias.
        </p>
        <Button onClick={() => navigate(`/cidade/${slug}/auth`)}>
          Fazer Login
        </Button>
      </div>
    );
  }

  // Categorizar denúncias por status
  const aprovadas = denuncias?.filter((d) => d.status === "aprovado") || [];
  const pendentes = denuncias?.filter((d) => d.status === "pendente") || [];
  const recusadas = denuncias?.filter((d) => d.status === "recusado") || [];

  const renderEmptyState = (message: string) => (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        <Megaphone className="h-8 w-8 text-muted-foreground" />
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
            <h1 className="font-bold text-lg">Minhas Denúncias</h1>
            <p className="text-xs text-muted-foreground">{cidade?.nome}</p>
          </div>
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Denunciar</span>
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
          <Tabs defaultValue="aprovadas" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="aprovadas" className="flex flex-col gap-1 py-2 text-xs">
                <span>Aprovadas</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {aprovadas.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pendentes" className="flex flex-col gap-1 py-2 text-xs">
                <span>Pendentes</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {pendentes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="recusadas" className="flex flex-col gap-1 py-2 text-xs">
                <span>Recusadas</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {recusadas.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="aprovadas" className="mt-4 space-y-3">
              {aprovadas.length > 0 ? (
                <div className="grid gap-3">
                  {aprovadas.map((denuncia) => (
                    <AloPrefeituraCard key={denuncia.id} item={denuncia} cidadeSlug={slug} />
                  ))}
                </div>
              ) : (
                renderEmptyState("Nenhuma denúncia aprovada")
              )}
            </TabsContent>

            <TabsContent value="pendentes" className="mt-4 space-y-3">
              {pendentes.length > 0 ? (
                <div className="grid gap-3">
                  {pendentes.map((denuncia) => (
                    <AloPrefeituraCard key={denuncia.id} item={denuncia} cidadeSlug={slug} />
                  ))}
                </div>
              ) : (
                renderEmptyState("Nenhuma denúncia aguardando aprovação")
              )}
            </TabsContent>

            <TabsContent value="recusadas" className="mt-4 space-y-3">
              {recusadas.length > 0 ? (
                <div className="grid gap-3">
                  {recusadas.map((denuncia) => (
                    <AloPrefeituraCard key={denuncia.id} item={denuncia} cidadeSlug={slug} />
                  ))}
                </div>
              ) : (
                renderEmptyState("Nenhuma denúncia recusada")
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Modal de nova denúncia */}
      {cidade?.id && (
        <NovaDenunciaModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          cidadeId={cidade.id}
          cidadeSlug={slug || ""}
        />
      )}
    </div>
  );
};

export default MinhasDenunciasPage;
