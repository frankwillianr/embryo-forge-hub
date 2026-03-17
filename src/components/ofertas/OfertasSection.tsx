import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgePercent, Heart } from "lucide-react";

interface OfertasSectionProps {
  cidadeSlug?: string;
}

type Oferta = {
  id: string;
  nome: string;
  categoria: string;
  categorias_adicionais: string[] | null;
  banner_oferta_url: string | null;
  logomarca_url: string | null;
};

const CATEGORIAS = [
  { id: "todas", label: "🏷️ Todas" },
  { id: "beleza", label: "💇 Beleza" },
  { id: "servicos", label: "🛠️ Serviços" },
  { id: "saude", label: "🏥 Saúde" },
  { id: "comercio", label: "🛍️ Comércio" },
  { id: "veiculos", label: "🚗 Veículos" },
  { id: "profissionais", label: "👔 Profissionais" },
  { id: "pets", label: "🐶 Pets" },
];

const CATEGORIA_MAP: Record<string, string[]> = {
  beleza: ["salao", "barbeiro", "manicure", "estetica", "maquiagem", "sobrancelha", "depilacao", "cosmeticos", "cosmetico"],
  servicos: ["reparos", "eletricista", "encanador", "obras", "limpeza", "dedetizacao", "chaveiro", "pintor", "marceneiro", "serralheria", "vidraceiro", "ar-condicionado", "jardinagem", "mudancas", "diarista", "costura"],
  profissionais: ["advogado", "contador", "despachante", "engenheiro", "arquiteto", "corretor", "fotografo", "aulas", "idiomas", "informatica", "eventos"],
  saude: ["clinica", "dentista", "psicologo", "fisioterapeuta", "nutricionista", "personal", "academia", "massagista", "farmacia"],
  comercio: ["desapega", "lojas", "promocoes", "restaurantes", "entregador", "moda", "eletronicos"],
  veiculos: ["mecanico", "lava-jato", "auto-pecas", "guincho", "funilaria", "borracharia", "vistoria", "motorista"],
  pets: ["veterinario", "pet", "petshop", "adestrador", "hotel-pet", "passeador"],
};

const normalizeCategoria = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const parseCategoriasAdicionais = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/^\{|\}$/g, "");
    return cleaned
      .split(",")
      .map((v) => v.replace(/^"+|"+$/g, "").trim())
      .filter(Boolean);
  }

  return [];
};

const OfertasSection = ({ cidadeSlug }: OfertasSectionProps) => {
  const navigate = useNavigate();
  const [categoriaAtiva, setCategoriaAtiva] = useState("todas");
  const [likedOfertas, setLikedOfertas] = useState<Set<string>>(new Set());
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const tabRefsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const ofertasScrollRef = useRef<HTMLDivElement>(null);
  const likeStorageKey = `ofertas-liked-${cidadeSlug || "global"}`;

  const { data: cidade } = useQuery({
    queryKey: ["cidade-id", cidadeSlug],
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

  const { data: ofertas, isLoading } = useQuery({
    queryKey: ["ofertas", cidade?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome, categoria, categorias_adicionais, banner_oferta_url, logomarca_url")
        .eq("cidade_id", cidade!.id)
        .eq("status", "ativo")
        .limit(60);
      if (error) throw error;
      return (data || []) as Oferta[];
    },
    enabled: !!cidade?.id,
  });

  const categoriasComOfertas = CATEGORIAS.map((c) => c.id);

  const ofertasFiltradas = useMemo(() => {
    if (!ofertas) return [];
    if (categoriaAtiva === "todas") return ofertas;
    const dbCats = (CATEGORIA_MAP[categoriaAtiva] || []).map(normalizeCategoria);
    const dbSet = new Set(dbCats);

    return ofertas.filter((o) => {
      const categoriasEmpresa = [
        o.categoria,
        ...parseCategoriasAdicionais(o.categorias_adicionais),
      ].map(normalizeCategoria);

      if (categoriasEmpresa.some((cat) => dbSet.has(cat))) return true;

      // fallback extra para variações de cosméticos
      if (categoriaAtiva === "beleza") {
        return categoriasEmpresa.some((cat) => cat.startsWith("cosmetic"));
      }

      return false;
    });
  }, [ofertas, categoriaAtiva]);

  // Centraliza aba sem rolar a página
  useEffect(() => {
    const index = CATEGORIAS.findIndex((c) => c.id === categoriaAtiva);
    const tabEl = tabRefsRef.current[index];
    const container = tabsScrollRef.current;
    if (!tabEl || !container) return;
    const target = tabEl.offsetLeft - container.offsetWidth / 2 + tabEl.offsetWidth / 2;
    container.scrollTo({ left: target, behavior: "smooth" });
  }, [categoriaAtiva]);

  // Autoplay horizontal do mural de ofertas (a cada 3s)
  useEffect(() => {
    const container = ofertasScrollRef.current;
    if (!container) return;

    const intervalId = window.setInterval(() => {
      if (!ofertasFiltradas.length) return;

      const firstCard = container.querySelector("button");
      const cardWidth = firstCard ? (firstCard as HTMLElement).offsetWidth + 12 : 268; // largura + gap
      const maxScroll = container.scrollWidth - container.clientWidth;

      if (maxScroll <= 0) return;

      const next = container.scrollLeft + cardWidth;
      if (next >= maxScroll - 4) {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        container.scrollTo({ left: next, behavior: "smooth" });
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [categoriaAtiva, ofertasFiltradas.length]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(likeStorageKey);
      if (!raw) return;
      const ids = JSON.parse(raw);
      if (Array.isArray(ids)) {
        setLikedOfertas(new Set(ids.map((id) => String(id))));
      }
    } catch {
      // noop
    }
  }, [likeStorageKey]);

  useEffect(() => {
    localStorage.setItem(likeStorageKey, JSON.stringify(Array.from(likedOfertas)));
  }, [likeStorageKey, likedOfertas]);

  const toggleLikeOferta = (ofertaId: string) => {
    setLikedOfertas((prev) => {
      const next = new Set(prev);
      if (next.has(ofertaId)) {
        next.delete(ofertaId);
      } else {
        next.add(ofertaId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="py-6">
        <div className="px-5 mb-4">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex gap-3 px-5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="w-64 h-28 rounded-2xl flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (!ofertas || ofertas.length === 0) return null;

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 mb-1">
        <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <BadgePercent className="h-4 w-4 text-primary" />
          Mural de ofertas
        </h2>
        <button
          onClick={() => navigate(`/cidade/${cidadeSlug}/ofertas`)}
          className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
        >
          Ver todas
        </button>
      </div>

      {/* Adicionar empresa */}
      <div className="px-5 mb-3">
        <button
          onClick={() => navigate(`/cidade/${cidadeSlug}/empresa/novo`)}
          className="text-xs font-medium px-3 py-1.5 rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Adicionar minha empresa
        </button>
      </div>

      {/* Tabs de categoria */}
      <div ref={tabsScrollRef} className="overflow-x-auto scrollbar-hide mb-3">
        <div className="flex gap-0 px-5 border-b border-border/30">
          {CATEGORIAS.filter((c) => categoriasComOfertas.includes(c.id)).map((cat, index) => (
            <button
              key={cat.id}
              ref={(el) => { tabRefsRef.current[index] = el; }}
              onClick={() => setCategoriaAtiva(cat.id)}
              className={`flex-shrink-0 px-4 pb-2.5 text-[13px] font-medium transition-all relative whitespace-nowrap ${
                categoriaAtiva === cat.id
                  ? "text-foreground"
                  : "text-muted-foreground/60"
              }`}
            >
              {cat.label}
              {categoriaAtiva === cat.id && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lista horizontal */}
      <div ref={ofertasScrollRef} className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-5 pb-2">
          {ofertasFiltradas.length > 0 ? (
            ofertasFiltradas.map((oferta) => (
              <div
                key={oferta.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/cidade/${cidadeSlug}/servicos/${oferta.categoria}/${oferta.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/cidade/${cidadeSlug}/servicos/${oferta.categoria}/${oferta.id}`);
                  }
                }}
                className="relative flex-shrink-0 w-64 aspect-[1288/718] rounded-2xl overflow-hidden shadow-md transition-transform active:scale-[0.98]"
              >
                {oferta.banner_oferta_url || oferta.logomarca_url ? (
                  <img
                    src={oferta.banner_oferta_url || oferta.logomarca_url || ""}
                    alt={oferta.nome}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-muted to-muted/60" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <button
                  type="button"
                  aria-label={likedOfertas.has(oferta.id) ? "Descurtir oferta" : "Curtir oferta"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLikeOferta(oferta.id);
                  }}
                  className="absolute top-2 right-2 z-10 h-9 w-9 rounded-full bg-white/95 border border-white shadow-lg flex items-center justify-center"
                >
                  <Heart
                    className={`h-4 w-4 transition-colors ${
                      likedOfertas.has(oferta.id)
                        ? "text-red-500 fill-red-500"
                        : "text-red-500"
                    }`}
                  />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white text-sm font-semibold truncate">{oferta.nome}</p>
                </div>
              </div>
            ))
          ) : (
            <button
              onClick={() => navigate(`/cidade/${cidadeSlug}/empresa/novo`)}
              className="flex-shrink-0 w-64 aspect-[1288/718] rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-2 transition-colors hover:bg-primary/10 active:scale-[0.98]"
            >
              <BadgePercent className="h-8 w-8 text-primary/40" />
              <p className="text-sm font-medium text-primary/60">Coloque sua empresa aqui</p>
              <p className="text-[11px] text-muted-foreground/50">Anuncie nesta categoria</p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfertasSection;

