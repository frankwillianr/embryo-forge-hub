import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ArrowLeft, Home, Newspaper, Film, Megaphone, Menu, Map as MapIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { AloPrefeitura, AloPrefeituraImagem } from "@/types/aloPrefeitura";
import AloPrefeituraFeedCard from "@/components/aloPrefeitura/AloPrefeituraFeedCard";
import aloPrefeituraBanner from "@/assets/alo-prefeitura-banner.jpg";

const PAGE_SIZE = 8;

const AloPrefeituraListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [globalMuted, setGlobalMuted] = useState(true);
  const [globalAutoplay, setGlobalAutoplay] = useState(true);
  const [pageOffset, setPageOffset] = useState(0);
  const [allItems, setAllItems] = useState<AloPrefeitura[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Initial load
  const { data: initialData, isLoading } = useQuery({
    queryKey: ["alo-prefeitura-list", slug, 0],
    queryFn: async () => {
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return [];

      const { data: itemsData, error: itemsError } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .eq("status", "aprovado")
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (itemsError) throw itemsError;
      if (!itemsData || itemsData.length === 0) return [];

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

      const items = itemsData.map((j) => ({
        ...j,
        imagens: imagensPorItem[j.id] || [],
      })) as AloPrefeitura[];

      return items;
    },
    enabled: !!slug,
  });

  // Sync initial data to state
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initialData && !initializedRef.current) {
      initializedRef.current = true;
      setAllItems(initialData);
      setPageOffset(PAGE_SIZE);
      setHasMore(initialData.length >= PAGE_SIZE);
    }
  }, [initialData]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !slug) return;

    setIsLoadingMore(true);
    try {
      const { data: cidadeData } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (!cidadeData) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const { data: itemsData } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .eq("status", "aprovado")
        .order("created_at", { ascending: false })
        .range(pageOffset, pageOffset + PAGE_SIZE - 1);

      if (!itemsData || itemsData.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

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

      const newItems = itemsData.map((j) => ({
        ...j,
        imagens: imagensPorItem[j.id] || [],
      })) as AloPrefeitura[];

      setAllItems((prev) => [...prev, ...newItems]);
      setPageOffset((prev) => prev + PAGE_SIZE);
      setHasMore(newItems.length >= PAGE_SIZE);
    } catch (err) {
      console.error("Error loading more items:", err);
    }
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, slug, pageOffset]);

  const itemIds = useMemo(() => allItems.map((item) => item.id), [allItems]);

  // Infinite scroll: load more when sentinel becomes visible
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  // Scroll automático até a publicação quando há hash na URL
  useEffect(() => {
    if (isLoading) return;

    const navState = (location.state as { scrollToTop?: boolean; fromAloCard?: boolean } | null) || null;

    if (navState?.scrollToTop) {
      window.scrollTo({ top: 0, behavior: "auto" });
      if (location.hash) {
        window.history.replaceState(null, "", location.pathname);
      }
      return;
    }

    if (!location.hash) return;

    const itemId = location.hash.substring(1);
    const element = document.getElementById(`alo-${itemId}`);

    if (element) {
      setTimeout(() => {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", location.pathname);
      }, 100);
    }
  }, [isLoading, location.hash, location.pathname, location.state]);

  useEffect(() => {
    if (isLoading || itemIds.length === 0) return;

    const visibleRatios = new Map<string, number>();
    let currentActiveId: string | null = null;
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

        const computedActive = maxRatio >= 0.45 ? nextActiveId : null;
        if (computedActive !== currentActiveId) {
          currentActiveId = computedActive;
          setActiveItemId(computedActive);
        }
      },
      {
        threshold: [0, 0.5],
      }
    );

    const elements = itemIds
      .map((id) => document.querySelector(`[data-alo-id="${id}"]`))
      .filter((el): el is Element => !!el);

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [isLoading, itemIds]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header estilo Instagram */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold text-foreground">Voz do Povo</h1>
      </header>

      <div className="relative h-52 overflow-hidden border-b border-border">
        <img src={aloPrefeituraBanner} alt="Voz do Povo" className="w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/35 to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,160,46,0.38),transparent_45%)]" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3 backdrop-blur-md shadow-lg">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90">
              <Megaphone className="h-3.5 w-3.5" />
              Participação cidadã
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <h2 className="text-[22px] leading-tight font-black text-white">Voz do Povo</h2>
              <div className="h-8 min-w-8 px-2 rounded-full bg-white/20 border border-white/30 text-xs font-semibold text-white flex items-center justify-center">
                {allItems.length}
              </div>
            </div>
            <p className="mt-1 text-xs text-white/80">Relatos da cidade para acompanhar, apoiar e cobrar soluções.</p>
          </div>
        </div>
      </div>

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
      ) : allItems.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm">
          Nenhuma publicação ainda
        </div>
      ) : (
        <div>
          {allItems.map((item) => (
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

          {/* Infinite scroll sentinel */}
          <div ref={loadMoreRef} className="py-8 flex justify-center">
            {isLoadingMore && (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      )}

      <nav className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 pb-safe">
        <div className="relative flex items-center">
          <button
            onClick={() => navigate(`/cidade/${slug}`)}
            className="absolute -left-6 z-10 flex items-center justify-center w-14 h-14 rounded-full shadow-xl bg-white"
            style={{ boxShadow: "0 4px 20px -4px rgba(0,0,0,0.15)" }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted">
              <Home className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
          <div className="flex items-center gap-2 bg-[#1a1a2e] rounded-full py-2 px-5 pl-12 shadow-2xl">
            <button
              onClick={() => navigate(`/cidade/${slug}/jornal`)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-gray-400 hover:text-white"
            >
              <Newspaper className="h-5 w-5" />
              <span className="text-[9px] font-medium">Jornal</span>
            </button>
            <button
              onClick={() => navigate(`/cidade/${slug}`, { state: { tab: "cinema" } })}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-gray-400 hover:text-white"
            >
              <Film className="h-5 w-5" />
              <span className="text-[9px] font-medium">Cinema</span>
            </button>
            <button className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-primary">
              <Megaphone className="h-5 w-5" />
              <span className="text-[9px] font-medium">Voz</span>
            </button>
            <button
              onClick={() => navigate(`/cidade/${slug}`, { state: { tab: "maps" } })}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-gray-400 hover:text-white"
            >
              <MapIcon className="h-5 w-5" />
              <span className="text-[9px] font-medium">Maps</span>
            </button>
            <button
              onClick={() => navigate(`/cidade/${slug}`, { state: { tab: "menu" } })}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-gray-400 hover:text-white"
            >
              <Menu className="h-5 w-5" />
              <span className="text-[9px] font-medium">Menu</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default AloPrefeituraListPage;
