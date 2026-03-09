import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgePercent } from "lucide-react";

interface OfertasSectionProps {
  cidadeSlug?: string;
}

type Oferta = { id: string; nome: string; categoria: string; banner_oferta_url: string };

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
  beleza: ["salao", "barbeiro", "manicure", "estetica", "maquiagem", "sobrancelha", "depilacao"],
  servicos: ["reparos", "eletricista", "encanador", "obras", "limpeza", "dedetizacao", "chaveiro", "pintor", "marceneiro", "serralheria", "vidraceiro", "ar-condicionado", "jardinagem", "mudancas", "diarista", "costura"],
  profissionais: ["advogado", "contador", "despachante", "engenheiro", "arquiteto", "corretor", "fotografo", "aulas", "idiomas", "informatica", "eventos"],
  saude: ["clinica", "dentista", "psicologo", "fisioterapeuta", "nutricionista", "personal", "academia", "massagista", "farmacia"],
  comercio: ["desapega", "lojas", "promocoes", "restaurantes", "entregador", "moda", "eletronicos"],
  veiculos: ["mecanico", "lava-jato", "auto-pecas", "guincho", "funilaria", "borracharia", "vistoria", "motorista"],
  pets: ["veterinario", "pet", "petshop", "adestrador", "hotel-pet", "passeador"],
};

const OfertasSection = ({ cidadeSlug }: OfertasSectionProps) => {
  const navigate = useNavigate();
  const [categoriaAtiva, setCategoriaAtiva] = useState("todas");
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const tabRefsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userInteractedRef = useRef(false);

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
        .select("id, nome, categoria, banner_oferta_url")
        .eq("cidade_id", cidade!.id)
        .eq("status", "ativo")
        .not("banner_oferta_url", "is", null);
      if (error) throw error;
      return (data || []) as Oferta[];
    },
    enabled: !!cidade?.id,
  });

  const categoriasComOfertas = CATEGORIAS.map((c) => c.id);

  const ofertasFiltradas = useMemo(() => {
    if (!ofertas) return [];
    if (categoriaAtiva === "todas") return [...ofertas].sort(() => Math.random() - 0.5);
    const dbCats = CATEGORIA_MAP[categoriaAtiva] || [];
    return ofertas.filter((o) => dbCats.includes(o.categoria));
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

  // Autoplay: avança categoria a cada 5s
  useEffect(() => {
    autoPlayRef.current = setInterval(() => {
      if (userInteractedRef.current) return;
      setCategoriaAtiva((prev) => {
        const available = categoriasComOfertas;
        const idx = available.indexOf(prev);
        return available[(idx + 1) % available.length];
      });
    }, 5000);
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, [categoriasComOfertas]);

  const handleTabClick = useCallback((catId: string) => {
    setCategoriaAtiva(catId);
    userInteractedRef.current = true;
    setTimeout(() => { userInteractedRef.current = false; }, 10_000);
  }, []);

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
      <div className="px-5 mb-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <BadgePercent className="h-4 w-4 text-primary" />
              Mural de ofertas
            </h2>
            <p className="text-[12px] text-muted-foreground/70 mt-0.5">
              Promoções imperdíveis
            </p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={() => navigate(`/cidade/${cidadeSlug}/empresa/novo`)}
              className="text-[11px] font-medium px-2 py-1 rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors whitespace-nowrap"
            >
              Adicionar minha empresa
            </button>
            <button
              onClick={() => navigate(`/cidade/${cidadeSlug}/ofertas`)}
              className="text-[11px] font-medium px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
            >
              Ver todas
            </button>
          </div>
        </div>
      </div>

      {/* Tabs de categoria */}
      <div ref={tabsScrollRef} className="overflow-x-auto scrollbar-hide mb-3">
        <div className="flex gap-0 px-5 border-b border-border/30">
          {CATEGORIAS.filter((c) => categoriasComOfertas.includes(c.id)).map((cat, index) => (
            <button
              key={cat.id}
              ref={(el) => { tabRefsRef.current[index] = el; }}
              onClick={() => handleTabClick(cat.id)}
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
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-5 pb-2">
          {ofertasFiltradas.length > 0 ? (
            ofertasFiltradas.map((oferta) => (
              <button
                key={oferta.id}
                onClick={() => navigate(`/cidade/${cidadeSlug}/servicos/${oferta.categoria}/${oferta.id}`)}
                className="relative flex-shrink-0 w-64 h-[192px] rounded-2xl overflow-hidden shadow-md transition-transform active:scale-[0.98]"
              >
                <img
                  src={oferta.banner_oferta_url}
                  alt={oferta.nome}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white text-sm font-semibold truncate">{oferta.nome}</p>
                </div>
              </button>
            ))
          ) : (
            <button
              onClick={() => navigate(`/cidade/${cidadeSlug}/empresa/novo`)}
              className="flex-shrink-0 w-64 h-[192px] rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-2 transition-colors hover:bg-primary/10 active:scale-[0.98]"
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
