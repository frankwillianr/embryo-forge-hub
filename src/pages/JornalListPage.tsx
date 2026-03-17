import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { ArrowLeft, Home, Newspaper, Film, Megaphone, Menu, Map } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { type Jornal, parseImagens } from "@/types/jornal";
import JornalFeedCard from "@/components/jornal/JornalFeedCard";
import jornalBanner from "@/assets/jornal-banner.jpg";

const PAGE_SIZE = 10;

const JornalListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  useSwipeBack({ onBack: () => navigate(`/cidade/${slug}`) });
  const location = useLocation();
  const [categoriaAtiva, setCategoriaAtiva] = useState("todos");
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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
    data: jornaisPages,
    isLoading: isLoadingJornais,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["jornais-list", slug, cidadeData?.id, categoriaAtiva],
    queryFn: async ({ pageParam = 0 }) => {
      const query = supabase
        .from("rel_cidade_jornal")
        .select("*")
        .eq("cidade_id", cidadeData!.id)
        .eq("ativo", true)
        .not("titulo", "like", "%{{%")
        .order("data_noticia", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      const filteredQuery =
        categoriaAtiva === "todos" ? query : query.eq("categoria", categoriaAtiva);

      const { data, error } = await filteredQuery;
      if (error) throw error;

      const items = (data || []).map((j) => ({
        ...j,
        imagens: parseImagens(j.imagens),
      })) as Jornal[];

      return {
        items,
        nextOffset: pageParam + items.length,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.items.length < PAGE_SIZE) return undefined;
      return lastPage.nextOffset;
    },
    enabled: !!cidadeData?.id,
  });

  const jornais = useMemo(
    () => jornaisPages?.pages.flatMap((page) => page.items) ?? [],
    [jornaisPages]
  );

  const categorias = useMemo(() => categoriasData, [categoriasData]);
  const isLoading = isLoadingCidade || isLoadingJornais;

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
    jornais.length,
  ]);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 40) {
        setHasUserScrolled(true);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isLoading || !hasNextPage || isFetchingNextPage) return;

    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasUserScrolled) {
          fetchNextPage();
        }
      },
      { rootMargin: "120px 0px", threshold: 0.1 }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, hasUserScrolled, isFetchingNextPage, isLoading]);

  const jornaisFiltrados = useMemo(() => {
    if (categoriaAtiva === "todos") return jornais;
    return jornais.filter((j) => (j.categoria || "").trim() === categoriaAtiva);
  }, [jornais, categoriaAtiva]);

  return (
    <div id="swipe-back-page" className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">Jornal da cidade</h1>
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
                {jornais.length}
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
              onClick={() => setCategoriaAtiva("todos")}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                categoriaAtiva === "todos"
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              Todos
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
      ) : jornaisFiltrados.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm">Nenhuma notícia nesta categoria</div>
      ) : (
        <div>
          {jornaisFiltrados.map((jornal) => (
            <JornalFeedCard key={jornal.id} jornal={jornal} cidadeSlug={slug} />
          ))}
          <div ref={loadMoreRef} className="h-8" />
          {isFetchingNextPage && (
            <div className="py-6 text-center text-xs text-muted-foreground">Carregando mais notícias...</div>
          )}
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
            <button className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-primary">
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
            <button
              onClick={() => navigate(`/cidade/${slug}/alo-prefeitura`)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-gray-400 hover:text-white"
            >
              <Megaphone className="h-5 w-5" />
              <span className="text-[9px] font-medium">Voz</span>
            </button>
            <button
              onClick={() => navigate(`/cidade/${slug}`, { state: { tab: "maps" } })}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-gray-400 hover:text-white"
            >
              <Map className="h-5 w-5" />
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

export default JornalListPage;
