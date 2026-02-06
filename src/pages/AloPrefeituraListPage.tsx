import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { AloPrefeitura, AloPrefeituraImagem } from "@/types/aloPrefeitura";
import aloPrefeituraBanner from "@/assets/alo-prefeitura-banner.jpg";

const AloPrefeituraListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["alo-prefeitura-list", slug],
    queryFn: async () => {
      // Busca cidade
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return [];

      // Busca todas as publicações
      const { data: itemsData, error: itemsError } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .order("created_at", { ascending: false });

      if (itemsError) throw itemsError;
      if (!itemsData || itemsData.length === 0) return [];

      // Busca imagens
      const itemIds = itemsData.map((j) => j.id);
      const { data: imagensData } = await supabase
        .from("rel_cidade_alo_prefeitura_imagens")
        .select("*")
        .in("alo_prefeitura_id", itemIds)
        .order("ordem");

      const imagensPorItem = (imagensData || []).reduce((acc, img) => {
        if (!acc[img.alo_prefeitura_id]) acc[img.alo_prefeitura_id] = [];
        acc[img.alo_prefeitura_id].push(img as AloPrefeituraImagem);
        return acc;
      }, {} as Record<string, AloPrefeituraImagem[]>);

      return itemsData.map((j) => ({
        ...j,
        imagens: imagensPorItem[j.id] || [],
      })) as AloPrefeitura[];
    },
    enabled: !!slug,
  });

  return (
    <div className="min-h-screen bg-background pb-4">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">Alô Prefeitura</h1>
      </header>

      {/* Banner Hero */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={aloPrefeituraBanner}
          alt="Alô Prefeitura"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-xs text-muted-foreground">Sua voz na cidade</p>
          <h2 className="text-lg font-bold text-foreground">Denúncias da Comunidade</h2>
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-24 h-20 bg-muted/50 animate-pulse rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-2 w-16 bg-muted/50 animate-pulse rounded" />
                  <div className="h-3 w-full bg-muted/50 animate-pulse rounded" />
                  <div className="h-3 w-3/4 bg-muted/50 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">
            Nenhuma publicação ainda
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const primeiraImagem = item.imagens?.[0]?.imagem_url;
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/cidade/${slug}/alo-prefeitura/${item.id}`)}
                  className="flex gap-3 cursor-pointer group"
                >
                  {/* Thumbnail */}
                  <div className="w-24 h-20 rounded-xl overflow-hidden bg-muted/30 flex-shrink-0">
                    {primeiraImagem ? (
                      <img
                        src={primeiraImagem}
                        alt={item.titulo}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted/20 to-muted/40" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">
                      {new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </p>
                    <h3 className="text-[13px] font-medium text-foreground line-clamp-2 leading-tight tracking-tight">
                      {item.titulo}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AloPrefeituraListPage;
