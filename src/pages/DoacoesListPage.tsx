import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DoacaoCard from "@/components/doacoes/DoacaoCard";
import DoacaoCategorias from "@/components/doacoes/DoacaoCategorias";

const DoacoesListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);

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

  const { data: anuncios, isLoading } = useQuery({
    queryKey: ["doacoes", cidade?.id, categoriaId, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("rel_cidade_doacao")
        .select(`
          *,
          categoria:rel_cidade_doacao_categoria(id, nome, icone),
          imagens:rel_cidade_doacao_imagem(id, url, ordem)
        `)
        .eq("cidade_id", cidade!.id)
        .in("status", ["ativo", "doado"])
        .order("created_at", { ascending: false });

      if (categoriaId) query = query.eq("categoria_id", categoriaId);
      if (searchTerm) query = query.ilike("titulo", `%${searchTerm}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!cidade?.id,
  });

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground flex-1">Doações</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/cidade/${slug}/doacoes/novo`)} className="btn-solar-soft gap-1.5">
          <Plus className="h-4 w-4" />
          Doar
        </Button>
      </header>

      <div className="p-4 border-b border-border bg-card/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar doações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-10"
          />
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DoacaoCategorias selectedId={categoriaId} onSelect={setCategoriaId} />

      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : anuncios && anuncios.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {anuncios.map((anuncio: any) => (
              <DoacaoCard key={anuncio.id} anuncio={anuncio} cidadeSlug={slug!} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">Nenhuma doação encontrada</h3>
            <p className="text-sm text-muted-foreground mb-4">Seja o primeiro a publicar uma doação!</p>
            <Button variant="ghost" onClick={() => navigate(`/cidade/${slug}/doacoes/novo`)} className="btn-solar-soft gap-2">
              <Plus className="h-4 w-4" />
              Criar doação
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default DoacoesListPage;
