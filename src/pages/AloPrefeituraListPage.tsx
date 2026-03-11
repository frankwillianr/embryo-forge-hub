import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { AloPrefeitura, AloPrefeituraImagem } from "@/types/aloPrefeitura";
import AloPrefeituraFeedCard from "@/components/aloPrefeitura/AloPrefeituraFeedCard";

const AloPrefeituraListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [globalMuted, setGlobalMuted] = useState(true);
  const [globalAutoplay, setGlobalAutoplay] = useState(true);

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
        .eq("status", "aprovado")
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

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  // Scroll automático até a publicação quando há hash na URL
  useEffect(() => {
    if (!isLoading && location.hash) {
      const itemId = location.hash.substring(1); // Remove o #
      const element = document.getElementById(`alo-${itemId}`);

      if (element) {
        // Aguarda um momento para garantir que o DOM está pronto
        setTimeout(() => {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          // Remove o hash da URL sem recarregar a página
          window.history.replaceState(null, '', location.pathname);
        }, 100);
      }
    }
  }, [isLoading, location.hash, location.pathname]);

  useEffect(() => {
    if (isLoading || itemIds.length === 0) return;

    const visibleRatios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-alo-id");
          if (!id) return;
          visibleRatios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let nextActiveId: string | null = null;
        let maxRatio = 0;

        visibleRatios.forEach((ratio, id) => {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            nextActiveId = id;
          }
        });

        setActiveItemId(maxRatio >= 0.45 ? nextActiveId : null);
      },
      {
        threshold: [0, 0.25, 0.45, 0.65, 0.85, 1],
      }
    );

    const elements = itemIds
      .map((id) => document.querySelector(`[data-alo-id="${id}"]`))
      .filter((el): el is Element => !!el);

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [isLoading, itemIds]);

  return (
    <div className="min-h-screen bg-background pb-4">
      {/* Header estilo Instagram */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold text-foreground">Voz do Povo</h1>
      </header>

      {/* Feed estilo Instagram */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-b border-border/50">
              <div className="px-3 py-2.5 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-muted/50 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 bg-muted/50 animate-pulse rounded" />
                  <div className="h-2 w-20 bg-muted/50 animate-pulse rounded" />
                </div>
              </div>
              <div className="aspect-square w-full bg-muted/50 animate-pulse" />
              <div className="px-3 py-3 space-y-2">
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
        <div>
          {items.map((item) => (
            <AloPrefeituraFeedCard
              key={item.id}
              item={item}
              cidadeSlug={slug}
              isVideoActive={activeItemId === item.id}
              globalMuted={globalMuted}
              onGlobalMutedChange={setGlobalMuted}
              globalAutoplay={globalAutoplay}
              onGlobalAutoplayChange={setGlobalAutoplay}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AloPrefeituraListPage;
