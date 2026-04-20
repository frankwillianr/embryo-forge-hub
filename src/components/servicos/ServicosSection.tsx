import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Car, ShoppingBag, ChevronRight, Briefcase, Gift } from "lucide-react";
import {
  getFluent3dNameFromKey,
  DEFAULT_SERVICO_CATEGORIAS,
  DEFAULT_SERVICOS_AUTOCOMPLETE_EXTRAS,
  getIconifyNameFromKey,
  getServicoAssetByIconKey,
  isFluent3dIconKey,
  isIconifyIconKey,
  type ServicoCategoria,
} from "@/lib/servicosCatalog";
import { FLUENT_EMOJI_3D_BY_SLUG } from "@/lib/fluentEmoji3dLibrary";

interface ServicosSectionProps {
  cidadeSlug?: string;
  showHighlights?: boolean;
  onlyHighlights?: boolean;
}

const isTableNotFound = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  return (e.message || "").toLowerCase().includes("could not find the table");
};

const BannerCarousel = ({
  banners,
  cidadeSlug,
}: {
  banners: Array<{ id: string; nome: string; banner_oferta_url: string; categoria: string }>;
  cidadeSlug?: string;
}) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoPlay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 4000);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    startAutoPlay();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [banners.length, startAutoPlay]);

  if (banners.length === 0) return null;

  const banner = banners[currentIndex];

  return (
    <div className="px-5 mb-4">
      <button
        onClick={() => navigate(`/cidade/${cidadeSlug}/servicos/${banner.categoria}/${banner.id}`)}
        className="w-full relative rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] transition-transform"
      >
        <img
          src={banner.banner_oferta_url}
          alt={banner.nome}
          loading="lazy"
          className="w-full h-28 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
          <span className="text-white text-xs font-semibold drop-shadow-sm line-clamp-1">
            {banner.nome}
          </span>
          {banners.length > 1 && (
            <div className="flex gap-1">
              {banners.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all ${i === currentIndex ? "w-4 bg-white" : "w-1 bg-white/50"}`}
                />
              ))}
            </div>
          )}
        </div>
      </button>
    </div>
  );
};

const ServicosSection = ({ cidadeSlug, showHighlights = true, onlyHighlights = false }: ServicosSectionProps) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(DEFAULT_SERVICO_CATEGORIAS[0]?.slug || "bares");
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const tabRefsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const isScrollingByUserRef = useRef(false);

  const { data: cidade } = useQuery({
    queryKey: ["cidade", cidadeSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cidadeSlug,
  });

  const { data: categorias = DEFAULT_SERVICO_CATEGORIAS } = useQuery({
    queryKey: ["servicos-catalogo-v2"],
    queryFn: async () => {
      const { data: categoriasData, error: categoriasError } = await supabase
        .from("servico_categoria")
        .select("id, slug, titulo, emoji, ordem, ativo, categorias_banco")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });

      if (categoriasError) {
        if (isTableNotFound(categoriasError)) return DEFAULT_SERVICO_CATEGORIAS;
        throw categoriasError;
      }

      if (!categoriasData || categoriasData.length === 0) return DEFAULT_SERVICO_CATEGORIAS;

      const categoriaIds = categoriasData.map((item) => item.id);
      const { data: subcategoriasData, error: subcategoriasError } = await supabase
        .from("servico_subcategoria")
        .select("id, categoria_id, slug, nome, emoji, icon_key, ordem, ativo")
        .in("categoria_id", categoriaIds)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });

      if (subcategoriasError) {
        if (isTableNotFound(subcategoriasError)) return DEFAULT_SERVICO_CATEGORIAS;
        throw subcategoriasError;
      }

      const subsPorCategoria = (subcategoriasData || []).reduce(
        (acc, sub) => {
          if (!acc[sub.categoria_id]) acc[sub.categoria_id] = [];
          acc[sub.categoria_id].push({
            id: sub.id,
            categoria_id: sub.categoria_id,
            slug: sub.slug,
            nome: sub.nome,
            emoji: sub.emoji,
            icon_key: sub.icon_key,
            ordem: sub.ordem ?? 0,
            ativo: sub.ativo ?? true,
          });
          return acc;
        },
        {} as Record<string, ServicoCategoria["subcategorias"]>,
      );

      const categoriasFormatadas = categoriasData
        .map((categoria) => ({
          id: categoria.id,
          slug: categoria.slug,
          titulo: categoria.titulo,
          emoji: categoria.emoji || "📌",
          ordem: categoria.ordem ?? 0,
          ativo: categoria.ativo ?? true,
          categorias_banco: Array.isArray(categoria.categorias_banco) ? categoria.categorias_banco : [],
          subcategorias: subsPorCategoria[categoria.id] || [],
        }))
        .filter((categoria) => categoria.subcategorias.length > 0);

      return categoriasFormatadas.length ? categoriasFormatadas : DEFAULT_SERVICO_CATEGORIAS;
    },
  });

  useEffect(() => {
    if (!categorias.length) return;
    if (!categorias.some((categoria) => categoria.slug === categoriaSelecionada)) {
      setCategoriaSelecionada(categorias[0].slug);
    }
  }, [categorias, categoriaSelecionada]);

  const categoriaAtual = categorias.find((c) => c.slug === categoriaSelecionada) || categorias[0];

  const { data: todasOfertas } = useQuery({
    queryKey: ["servicos-banners", cidade?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome, categoria, banner_oferta_url")
        .eq("cidade_id", cidade!.id)
        .eq("status", "ativo")
        .not("banner_oferta_url", "is", null)
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!cidade?.id,
  });

  const bannersCategoria = useMemo(() => {
    if (!todasOfertas || !categoriaAtual) return [];
    const categoriasDB = categoriaAtual.categorias_banco.length
      ? categoriaAtual.categorias_banco
      : categoriaAtual.subcategorias.map((sub) => sub.slug);
    return todasOfertas.filter((o) => categoriasDB.includes(o.categoria) && o.banner_oferta_url) as Array<{
      id: string;
      nome: string;
      banner_oferta_url: string;
      categoria: string;
    }>;
  }, [todasOfertas, categoriaAtual]);

  const todosServicosAutocomplete = useMemo(() => {
    const base = categorias.flatMap((categoria) =>
      categoria.subcategorias.map((sub) => ({
        id: sub.slug,
        nome: sub.nome,
      })),
    );
    const joined = [...base, ...DEFAULT_SERVICOS_AUTOCOMPLETE_EXTRAS];
    const unique = new Map<string, { id: string; nome: string }>();
    joined.forEach((item) => {
      if (!unique.has(item.id)) unique.set(item.id, item);
    });
    return Array.from(unique.values());
  }, [categorias]);

  const servicosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return todosServicosAutocomplete.filter((s) =>
      s.nome.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [searchTerm, todosServicosAutocomplete]);

  const handleClick = (servicoId: string) => {
    if (servicoId === "veiculos") {
      navigate(`/cidade/${cidadeSlug}/veiculos`);
    } else if (servicoId === "vagas") {
      navigate(`/cidade/${cidadeSlug}/vagas`);
    } else if (servicoId === "desapega") {
      navigate(`/cidade/${cidadeSlug}/desapega`);
    } else if (servicoId === "doacoes") {
      navigate(`/cidade/${cidadeSlug}/doacoes`);
    } else {
      navigate(`/cidade/${cidadeSlug}/servicos/${servicoId}`);
    }
  };

  const handleSelectServico = (servicoId: string) => {
    setSearchTerm("");
    setIsSearchFocused(false);
    handleClick(servicoId);
  };

  const highlightsBlock = showHighlights ? (
    <div className="px-5 mb-[15px]">
      <div className="grid grid-cols-4" style={{ gap: "10px" }}>
        <button
          onClick={() => handleClick("veiculos")}
          className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 p-2.5 min-h-[90px] flex flex-col gap-1.5 text-white shadow-md active:scale-[0.97] transition-transform relative overflow-hidden"
        >
          <div className="absolute -right-2 -bottom-2 opacity-15">
            <Car className="w-10 h-10" strokeWidth={1} />
          </div>
          <Car className="w-4 h-4 text-white/80" />
          <span className="text-[11px] font-semibold relative z-10">Veículos</span>
        </button>

        <button
          onClick={() => handleClick("desapega")}
          className="rounded-2xl bg-gradient-to-br from-pink-500 to-rose-400 p-2.5 min-h-[90px] flex flex-col gap-1.5 text-white shadow-md active:scale-[0.97] transition-transform relative overflow-hidden"
        >
          <div className="absolute -right-2 -bottom-2 opacity-15">
            <ShoppingBag className="w-10 h-10" strokeWidth={1} />
          </div>
          <ShoppingBag className="w-4 h-4 text-white/80" />
          <span className="text-[11px] font-semibold relative z-10">Marketplace local</span>
        </button>

        <button
          onClick={() => handleClick("doacoes")}
          className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 p-2.5 min-h-[90px] flex flex-col gap-1.5 text-white shadow-md active:scale-[0.97] transition-transform relative overflow-hidden"
        >
          <div className="absolute -right-2 -bottom-2 opacity-15">
            <Gift className="w-10 h-10" strokeWidth={1} />
          </div>
          <Gift className="w-4 h-4 text-white/80" />
          <span className="text-[11px] font-semibold relative z-10">Doações</span>
        </button>

        <button
          onClick={() => handleClick("vagas")}
          className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 p-2.5 min-h-[90px] flex flex-col gap-1.5 text-white shadow-md active:scale-[0.97] transition-transform relative overflow-hidden"
        >
          <div className="absolute -right-2 -bottom-2 opacity-15">
            <Briefcase className="w-10 h-10" strokeWidth={1} />
          </div>
          <Briefcase className="w-4 h-4 text-white/80" />
          <span className="text-[11px] font-semibold relative z-10">Vagas de Emprego</span>
        </button>
      </div>
    </div>
  ) : null;

  const handleGridScroll = useCallback(() => {
    const el = gridScrollRef.current;
    if (!el || isScrollingByUserRef.current) return;
    const w = el.offsetWidth;
    const index = Math.round(el.scrollLeft / w);
    const i = Math.max(0, Math.min(index, categorias.length - 1));
    if (categorias[i] && categorias[i].slug !== categoriaSelecionada) {
      setCategoriaSelecionada(categorias[i].slug);
    }
  }, [categoriaSelecionada, categorias]);

  const handleTabClick = useCallback((catSlug: string) => {
    const index = categorias.findIndex((c) => c.slug === catSlug);
    if (index < 0) return;
    setCategoriaSelecionada(catSlug);
    const el = gridScrollRef.current;
    if (el) {
      isScrollingByUserRef.current = true;
      el.scrollTo({ left: index * el.offsetWidth, behavior: "smooth" });
      setTimeout(() => { isScrollingByUserRef.current = false; }, 400);
    }
  }, [categorias]);

  useEffect(() => {
    const el = gridScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleGridScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleGridScroll);
  }, [handleGridScroll]);

  if (onlyHighlights) {
    return <div className="pt-2 pb-1">{highlightsBlock}</div>;
  }

  useEffect(() => {
    const index = categorias.findIndex((c) => c.slug === categoriaSelecionada);
    const tabEl = tabRefsRef.current[index];
    const container = tabsScrollRef.current;
    if (!tabEl || !container) return;
    const tabLeft = tabEl.offsetLeft;
    const tabWidth = tabEl.offsetWidth;
    const containerWidth = container.offsetWidth;
    const targetScroll = tabLeft - containerWidth / 2 + tabWidth / 2;
    container.scrollTo({ left: targetScroll, behavior: "smooth" });
  }, [categoriaSelecionada, categorias]);

  if (!categorias.length) {
    return (
      <div className="pt-6 pb-2 px-5">
        <p className="text-sm text-muted-foreground">Nenhuma categoria de serviços ativa.</p>
      </div>
    );
  }

  return (
    <div className="pt-6 pb-2">
      <div className="px-5 mb-5">
        <h2 className="text-[14px] font-semibold text-foreground tracking-tight flex items-center gap-1.5 mb-0.5">
          <Briefcase className="h-4 w-4 text-primary" />
          Serviços
        </h2>
        <p className="text-[12px] text-muted-foreground/70 mb-3">
          Profissionais e empresas para o que você precisar.
        </p>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar serviço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-muted/60 transition-all"
          />
          {isSearchFocused && searchTerm.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border/60 rounded-2xl shadow-xl z-50 max-h-[200px] overflow-y-auto">
              {servicosFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum resultado</p>
              ) : (
                <div className="py-1">
                  {servicosFiltrados.map((servico) => (
                    <button
                      key={servico.id}
                      onMouseDown={() => handleSelectServico(servico.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <span>{servico.nome}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {highlightsBlock}

      <div ref={tabsScrollRef} className="overflow-x-auto scrollbar-hide mt-[15px] mb-[15px] scroll-smooth">
        <div className="flex px-5 border-b border-border/30" style={{ gap: "15px" }}>
          {categorias.map((cat, index) => (
            <button
              key={cat.slug}
              ref={(el) => { tabRefsRef.current[index] = el; }}
              onClick={() => handleTabClick(cat.slug)}
              className={`flex-shrink-0 flex items-center gap-1 px-4 pb-2.5 text-[13px] font-medium transition-all relative ${
                categoriaSelecionada === cat.slug ? "text-foreground" : "text-muted-foreground/60"
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.titulo}</span>
              {categoriaSelecionada === cat.slug && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <BannerCarousel
        key={categoriaSelecionada}
        banners={bannersCategoria}
        cidadeSlug={cidadeSlug}
      />

      <div
        ref={gridScrollRef}
        className="overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory scroll-smooth"
        style={{ scrollSnapType: "x mandatory" }}
      >
        <div className="flex" style={{ width: `${categorias.length * 100}%` }}>
          {categorias.map((cat) => (
            <div
              key={cat.slug}
              className="flex-shrink-0 snap-start px-5 pb-2"
              style={{ width: `${100 / categorias.length}%`, minWidth: `${100 / categorias.length}%` }}
            >
              <div className="grid grid-cols-4 gap-y-4 gap-x-3">
                {cat.subcategorias.map((item) => {
                  const iconSrc = getServicoAssetByIconKey(item.icon_key);
                  const iconifyName = getIconifyNameFromKey(item.icon_key);
                  const fluent3dName = getFluent3dNameFromKey(item.icon_key);
                  const fluent3dSrc = FLUENT_EMOJI_3D_BY_SLUG.get(fluent3dName);
                  return (
                    <button
                      key={item.slug}
                      onClick={() => handleClick(item.slug)}
                      className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      {iconSrc ? (
                        <img
                          src={iconSrc}
                          alt={item.nome}
                          loading="lazy"
                          className="w-11 h-11 object-contain mix-blend-multiply dark:mix-blend-screen dark:invert"
                        />
                      ) : item.icon_key && isFluent3dIconKey(item.icon_key) && fluent3dSrc ? (
                        <img src={fluent3dSrc} alt={item.nome} loading="lazy" className="w-11 h-11 object-contain" />
                      ) : item.icon_key && isIconifyIconKey(item.icon_key) && iconifyName ? (
                        <Icon icon={iconifyName} className="h-11 w-11 text-foreground/85" />
                      ) : (
                        <span className="text-[32px] leading-none">{item.emoji || "📌"}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground text-center leading-tight line-clamp-2">
                        {item.nome}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServicosSection;
