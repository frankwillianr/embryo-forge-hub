import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { ArrowLeft, Newspaper, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { type Jornal, parseImagens } from "@/types/jornal";
import type { AloPrefeitura, AloPrefeituraImagem } from "@/types/aloPrefeitura";
import JornalFeedCard from "@/components/jornal/JornalFeedCard";
import AloPrefeituraFeedCard from "@/components/aloPrefeitura/AloPrefeituraFeedCard";
import NovaDenunciaModal from "@/components/aloPrefeitura/NovaDenunciaModal";
import BottomNavBar from "@/components/navigation/BottomNavBar";
import jornalBanner from "@/assets/jornal-banner.jpg";

const PAGE_SIZE = 10;
const FILTER_ALL = "todos";
const FILTER_JORNAL = "__jornal__";
const FILTER_VOZ = "__voz__";

type FeedItem =
  | { source: "jornal"; sortDate: string; data: Jornal }
  | { source: "voz"; sortDate: string; data: AloPrefeitura };

const JornalListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  useSwipeBack({ onBack: () => navigate(`/cidade/${slug}`) });
  const location = useLocation();
  const [categoriaAtiva, setCategoriaAtiva] = useState(FILTER_ALL);
  const [activeAloId, setActiveAloId] = useState<string | null>(null);
  const [globalMuted, setGlobalMuted] = useState(true);
  const [globalAutoplay, setGlobalAutoplay] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const isOnlyVoz = categoriaAtiva === FILTER_VOZ;
  const isOnlyJornal = categoriaAtiva === FILTER_JORNAL;
  const isJornalCategory = ![FILTER_ALL, FILTER_JORNAL, FILTER_VOZ].includes(categoriaAtiva);
  const shouldFetchJornal = !isOnlyVoz;
  const shouldFetchVoz = !isOnlyJornal && !isJornalCategory;

  const { data: cidadeData, isLoading: isLoadingCidade } = useQuery({
    queryKey: ["cidade-id", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: categoriasData = [] } = useQuery({
    queryKey: ["jornais-categorias", slug, cidadeData?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_jornal")
        .select("categoria")
        .eq("cidade_id", cidadeData!.id)
        .eq("ativo", true)
        .not("titulo", "like", "%{{%");

      if (error) throw error;

      const list = (data || [])
        .map((item) => (item.categoria || "").trim())
        .filter((categoria) => categoria.length > 0);

      return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
    enabled: !!cidadeData?.id,
  });

  const {
    data: feedPages,
    isLoading: isLoadingFeed,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed-jornal-voz", slug, cidadeData?.id, categoriaAtiva],
    queryFn: async ({ pageParam = 0 }) => {
      const jornalPromise = shouldFetchJornal
        ? (() => {
            const baseQuery = supabase
              .from("rel_cidade_jornal")
              .select("*")
              .eq("cidade_id", cidadeData!.id)
              .eq("ativo", true)
              .not("titulo", "like", "%{{%")
              .order("data_noticia", { ascending: false, nullsFirst: false })
              .order("created_at", { ascending: false })
              .range(pageParam, pageParam + PAGE_SIZE - 1);

            return isJornalCategory ? baseQuery.eq("categoria", categoriaAtiva) : baseQuery;
          })()
        : Promise.resolve({ data: [], error: null } as const);

      const vozPromise = shouldFetchVoz
        ? supabase
            .from("rel_cidade_alo_prefeitura")
            .select("*")
            .eq("cidade_id", cidadeData!.id)
            .eq("status", "aprovado")
            .order("created_at", { ascending: false })
            .range(pageParam, pageParam + PAGE_SIZE - 1)
        : Promise.resolve({ data: [], error: null } as const);

      const [{ data: jornaisData, error: jornaisError }, { data: vozData, error: vozError }] = await Promise.all([
        jornalPromise,
        vozPromise,
      ]);

      if (jornaisError) throw jornaisError;
      if (vozError) throw vozError;

      const jornais = (jornaisData || []).map((j) => ({
        ...j,
        imagens: parseImagens(j.imagens),
      })) as Jornal[];

      const vozItemsBase = (vozData || []) as AloPrefeitura[];
      let vozItems: AloPrefeitura[] = vozItemsBase;

      if (vozItemsBase.length > 0) {
        const vozIds = vozItemsBase.map((item) => item.id);
        const { data: imagensData, error: imagensError } = await supabase
          .from("rel_cidade_alo_prefeitura_imagens")
          .select("*")
          .in("alo_prefeitura_id", vozIds)
          .order("ordem");

        if (imagensError) throw imagensError;

        const imagensPorItem = (imagensData || []).reduce((acc, img) => {
          if (!acc[img.alo_prefeitura_id]) acc[img.alo_prefeitura_id] = [];
          acc[img.alo_prefeitura_id].push(img as AloPrefeituraImagem);
          return acc;
        }, {} as Record<string, AloPrefeituraImagem[]>);

        vozItems = vozItemsBase.map((item) => ({
          ...item,
          imagens: imagensPorItem[item.id] || [],
        }));
      }

      const items: FeedItem[] = [
        ...jornais.map((item) => ({
          source: "jornal" as const,
          sortDate: item.data_noticia ? `${item.data_noticia}T00:00:00` : item.created_at,
          data: item,
        })),
        ...vozItems.map((item) => ({
          source: "voz" as const,
          sortDate: item.created_at,
          data: item,
        })),
      ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

      return {
        items,
        nextOffset: pageParam + PAGE_SIZE,
        jornaisCount: jornais.length,
        vozCount: vozItems.length,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (shouldFetchJornal && shouldFetchVoz) {
        if (lastPage.jornaisCount < PAGE_SIZE && lastPage.vozCount < PAGE_SIZE) return undefined;
      } else if (shouldFetchJornal) {
        if (lastPage.jornaisCount < PAGE_SIZE) return undefined;
      } else if (shouldFetchVoz) {
        if (lastPage.vozCount < PAGE_SIZE) return undefined;
      } else {
        return undefined;
      }

      return lastPage.nextOffset;
    },
    enabled: !!cidadeData?.id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const { data: totalFeedCount } = useQuery({
    queryKey: ["feed-jornal-voz-total", slug, cidadeData?.id, categoriaAtiva],
    queryFn: async () => {
      const jornalCountPromise = shouldFetchJornal
        ? (() => {
            const baseQuery = supabase
              .from("rel_cidade_jornal")
              .select("*", { count: "exact", head: true })
              .eq("cidade_id", cidadeData!.id)
              .eq("ativo", true)
              .not("titulo", "like", "%{{%");

            return isJornalCategory ? baseQuery.eq("categoria", categoriaAtiva) : baseQuery;
          })()
        : Promise.resolve({ count: 0, error: null } as const);

      const vozCountPromise = shouldFetchVoz
        ? supabase
            .from("rel_cidade_alo_prefeitura")
            .select("*", { count: "exact", head: true })
            .eq("cidade_id", cidadeData!.id)
            .eq("status", "aprovado")
        : Promise.resolve({ count: 0, error: null } as const);

      const [{ count: jornalCount, error: jornalCountError }, { count: vozCount, error: vozCountError }] =
        await Promise.all([jornalCountPromise, vozCountPromise]);

      if (jornalCountError) throw jornalCountError;
      if (vozCountError) throw vozCountError;

      return (jornalCount || 0) + (vozCount || 0);
    },
    enabled: !!cidadeData?.id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const feedItems = useMemo(
    () => feedPages?.pages.flatMap((page) => page.items) ?? [],
    [feedPages]
  );
  const aloItemIds = useMemo(
    () => feedItems.filter((item) => item.source === "voz").map((item) => item.data.id),
    [feedItems]
  );

  const categorias = useMemo(() => categoriasData, [categoriasData]);
  const isLoading = isLoadingCidade || isLoadingFeed;

  useEffect(() => {
    if (isLoading) return;

    const navState = (location.state as { scrollToTop?: boolean; fromJornalCard?: boolean } | null) || null;

    if (navState?.scrollToTop) {
      window.scrollTo({ top: 0, behavior: "auto" });
      if (location.hash) {
        window.history.replaceState(null, "", location.pathname);
      }
      return;
    }

    if (!location.hash) return;

    const jornalId = location.hash.substring(1);
    const element = document.getElementById(`jornal-${jornalId}`);

    if (element) {
      setTimeout(() => {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", location.pathname);
      }, 100);
    } else if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    location.hash,
    location.pathname,
    location.state,
    feedItems.length,
  ]);

  useEffect(() => {
    if (isLoading || !hasNextPage || isFetchingNextPage) return;

    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: "120px 0px", threshold: 0.1 }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoading]);

  useEffect(() => {
    if (isLoading || aloItemIds.length === 0) return;

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

        const computedActiveId = maxRatio >= 0.45 ? nextActiveId : null;
        if (computedActiveId !== currentActiveId) {
          currentActiveId = computedActiveId;
          setActiveAloId(computedActiveId);
        }
      },
      { threshold: [0, 0.5] }
    );

    const elements = aloItemIds
      .map((id) => document.querySelector(`[data-alo-id="${id}"]`))
      .filter((el): el is Element => !!el);

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [aloItemIds, isLoading]);

  const feedFiltrado = useMemo(() => {
    if (categoriaAtiva === FILTER_ALL) return feedItems;
    if (categoriaAtiva === FILTER_JORNAL) return feedItems.filter((item) => item.source === "jornal");
    if (categoriaAtiva === FILTER_VOZ) return feedItems.filter((item) => item.source === "voz");

    return feedItems.filter(
      (item) => item.source === "jornal" && ((item.data as Jornal).categoria || "").trim() === categoriaAtiva
    );
  }, [categoriaAtiva, feedItems]);

  return (
    <div id="swipe-back-page" className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold flex-1">Jornal da cidade</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="h-8 px-2.5 rounded-full border border-destructive/20 bg-destructive/5 text-destructive text-[11px] font-medium flex items-center gap-1 hover:bg-destructive/10 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Postar
        </button>
      </header>

      <div className="relative h-52 overflow-hidden border-b border-border">
        <img src={jornalBanner} alt="Jornal da cidade" className="w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/35 to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,160,46,0.38),transparent_45%)]" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3 backdrop-blur-md shadow-lg">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90">
              <Newspaper className="h-3.5 w-3.5" />
              Notícias da cidade
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <h2 className="text-[22px] leading-tight font-black text-white">Jornal da Cidade</h2>
              <div className="h-8 min-w-8 px-2 rounded-full bg-white/20 border border-white/30 text-xs font-semibold text-white flex items-center justify-center">
                {totalFeedCount ?? feedItems.length}
              </div>
            </div>
            <p className="mt-1 text-xs text-white/80">Atualizações locais em tempo real para você.</p>
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-card/30">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-4 py-3 w-max">
            <button
              type="button"
              onClick={() => setCategoriaAtiva(FILTER_ALL)}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                categoriaAtiva === FILTER_ALL
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setCategoriaAtiva(FILTER_JORNAL)}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                categoriaAtiva === FILTER_JORNAL
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              Jornal
            </button>
            <button
              type="button"
              onClick={() => setCategoriaAtiva(FILTER_VOZ)}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                categoriaAtiva === FILTER_VOZ
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              Voz do Povo
            </button>
            {categorias.map((categoria) => (
              <button
                key={categoria}
                type="button"
                onClick={() => setCategoriaAtiva(categoria)}
                className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  categoriaAtiva === categoria
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {categoria}
              </button>
            ))}
          </div>
        </div>
      </div>

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
      ) : feedFiltrado.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm">Nenhuma publicação nesta seleção</div>
      ) : (
        <div>
          {feedFiltrado.map((item) =>
            item.source === "jornal" ? (
              <JornalFeedCard key={`jornal-${item.data.id}`} jornal={item.data as Jornal} cidadeSlug={slug} />
            ) : (
              <AloPrefeituraFeedCard
                key={`voz-${item.data.id}`}
                item={item.data as AloPrefeitura}
                cidadeSlug={slug}
                isVideoActive={activeAloId === item.data.id}
                globalMuted={globalMuted}
                onGlobalMutedChange={setGlobalMuted}
                globalAutoplay={globalAutoplay}
                onGlobalAutoplayChange={setGlobalAutoplay}
              />
            )
          )}
          <div ref={loadMoreRef} className="h-8" />
          {isFetchingNextPage && (
            <div className="py-6 text-center text-xs text-muted-foreground">Carregando mais publicações...</div>
          )}
        </div>
      )}

      <BottomNavBar slug={slug} active="jornal" />

      {cidadeData?.id && (
        <NovaDenunciaModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          cidadeId={cidadeData.id}
          cidadeSlug={slug || ""}
        />
      )}
    </div>
  );
};

export default JornalListPage;

