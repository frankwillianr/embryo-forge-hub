import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DesapegaCard from "@/components/desapega/DesapegaCard";
import DesapegaCategorias from "@/components/desapega/DesapegaCategorias";

const DesapegaListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);

  // Buscar cidade
  const { data: cidade } = useQuery({
    queryKey: ["cidade", slug],
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

  // Buscar anúncios
  const { data: anuncios, isLoading } = useQuery({
    queryKey: ["desapega", cidade?.id, categoriaId, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("rel_cidade_desapega")
        .select(`
          *,
          categoria:rel_cidade_desapega_categoria(id, nome, icone),
          imagens:rel_cidade_desapega_imagem(id, url, ordem)
        `)
        .eq("cidade_id", cidade!.id)
        .eq("status", "ativo")
        .order("created_at", { ascending: false });

      if (categoriaId) {
        query = query.eq("categoria_id", categoriaId);
      }

      if (searchTerm) {
        query = query.ilike("titulo", `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!cidade?.id,
  });

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/cidade/${slug}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground flex-1">
          Desapega
        </h1>
        <Button
          size="sm"
          onClick={() => navigate(`/cidade/${slug}/desapega/novo`)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Anunciar
        </Button>
      </header>

      {/* Search */}
      <div className="p-4 border-b border-border bg-card/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-10"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Categorias */}
      <DesapegaCategorias
        cidadeId={cidade?.id}
        selectedId={categoriaId}
        onSelect={setCategoriaId}
      />

      {/* Lista de anúncios */}
      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : anuncios && anuncios.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {anuncios.map((anuncio) => (
              <DesapegaCard
                key={anuncio.id}
                anuncio={anuncio}
                cidadeSlug={slug!}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">
              Nenhum anúncio encontrado
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Seja o primeiro a anunciar!
            </p>
            <Button
              onClick={() => navigate(`/cidade/${slug}/desapega/novo`)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Criar anúncio
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default DesapegaListPage;
