import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Search,
  BadgePercent,
  Eye,
  ImageIcon,
  Video,
  Tag,
  Scissors,
  Wrench,
  HeartPulse,
  Store,
  Car,
  Briefcase,
  PawPrint,
} from "lucide-react";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BottomNavBar from "@/components/navigation/BottomNavBar";

type Categoria = {
  id: string;
  nome: string;
  Icone: LucideIcon;
};

const TODAS_CATEGORIAS: Categoria[] = [
  { id: "todas", nome: "Todas", Icone: Tag },
  { id: "beleza", nome: "Beleza", Icone: Scissors },
  { id: "servicos", nome: "Servi\u00E7os", Icone: Wrench },
  { id: "saude", nome: "Sa\u00FAde", Icone: HeartPulse },
  { id: "comercio", nome: "Com\u00E9rcio", Icone: Store },
  { id: "veiculos", nome: "Ve\u00EDculos", Icone: Car },
  { id: "profissionais", nome: "Profissionais", Icone: Briefcase },
  { id: "pets", nome: "Pets", Icone: PawPrint },
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

const CATEGORIA_LABELS: Record<string, string> = {
  salao: "Beleza",
  barbeiro: "Barbearia",
  manicure: "Manicure",
  estetica: "Estética",
  maquiagem: "Maquiagem",
  sobrancelha: "Sobrancelha",
  depilacao: "Depilação",
  reparos: "Reparos",
  eletricista: "Eletricista",
  encanador: "Encanador",
  obras: "Obras",
  limpeza: "Limpeza",
  dedetizacao: "Dedetização",
  chaveiro: "Chaveiro",
  pintor: "Pintor",
  marceneiro: "Marcenaria",
  serralheria: "Serralheria",
  vidraceiro: "Vidraceiro",
  "ar-condicionado": "Ar-condicionado",
  jardinagem: "Jardinagem",
  mudancas: "Mudanças",
  diarista: "Diarista",
  costura: "Costura",
  advogado: "Advocacia",
  contador: "Contabilidade",
  despachante: "Despachante",
  engenheiro: "Engenharia",
  arquiteto: "Arquitetura",
  corretor: "Imóveis",
  fotografo: "Fotografia",
  aulas: "Aulas",
  idiomas: "Idiomas",
  informatica: "Informática",
  eventos: "Eventos",
  clinica: "Clínica",
  dentista: "Dentista",
  psicologo: "Psicologia",
  fisioterapeuta: "Fisioterapia",
  nutricionista: "Nutrição",
  personal: "Personal",
  academia: "Academia",
  massagista: "Massagem",
  farmacia: "Farmácia",
  desapega: "Desapega",
  lojas: "Loja",
  promocoes: "Promoções",
  restaurantes: "Restaurante",
  entregador: "Delivery",
  moda: "Moda",
  eletronicos: "Eletrônicos",
  mecanico: "Mecânica",
  "lava-jato": "Lava-jato",
  "auto-pecas": "Autopeças",
  guincho: "Guincho",
  funilaria: "Funilaria",
  borracharia: "Borracharia",
  vistoria: "Vistoria",
  motorista: "Motorista",
  veterinario: "Veterinário",
  pet: "Pet",
  petshop: "Petshop",
  adestrador: "Adestrador",
  "hotel-pet": "Hotel pet",
  passeador: "Passeador",
};

const formatarCategoriaLabel = (categoria: string) => {
  const labelMapeada = CATEGORIA_LABELS[categoria];
  if (labelMapeada) return labelMapeada;

  return categoria
    .split("-")
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
};

const shuffleArray = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const OFERTA_IMPRESSAO_STORAGE_KEY = "ofertas-impressao-cooldown-v1";
const IMPRESSAO_COOLDOWN_MS = 30 * 60 * 1000;
const IMPRESSAO_MIN_VISIVEL_MS = 1000;
const IMPRESSAO_THRESHOLD = 0.5;

type Oferta = {
  id: string;
  nome: string;
  categoria: string;
  banner_oferta_url: string | null;
  logomarca_url: string | null;
  video_url: string | null;
  descricao: string | null;
  visualizacoes: number | null;
};

const getImpressaoMap = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(OFERTA_IMPRESSAO_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const setImpressaoMap = (value: Record<string, number>) => {
  try {
    localStorage.setItem(OFERTA_IMPRESSAO_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignora falha de storage (navegacao privada/cota).
  }
};

type OfertaCardProps = {
  oferta: Oferta;
  slug: string;
  visualizacoes: number;
  onImpressaoQualificada: (ofertaId: string) => void;
};

const OfertaCard = ({ oferta, slug, visualizacoes, onImpressaoQualificada }: OfertaCardProps) => {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const disparouRef = useRef(false);

  useEffect(() => {
    disparouRef.current = false;
  }, [oferta.id]);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const clearTimer = () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || disparouRef.current) return;

        if (entry.isIntersecting && entry.intersectionRatio >= IMPRESSAO_THRESHOLD) {
          if (timeoutRef.current == null) {
            timeoutRef.current = window.setTimeout(() => {
              disparouRef.current = true;
              timeoutRef.current = null;
              onImpressaoQualificada(oferta.id);
            }, IMPRESSAO_MIN_VISIVEL_MS);
          }
          return;
        }

        clearTimer();
      },
      { threshold: [0, IMPRESSAO_THRESHOLD, 1] },
    );

    observer.observe(node);

    return () => {
      clearTimer();
      observer.disconnect();
    };
  }, [oferta.id, onImpressaoQualificada]);

  const labelVisualizacao = visualizacoes <= 1 ? "visualiza\u00E7\u00E3o" : "visualiza\u00E7\u00F5es";
  const categoriaLabel = formatarCategoriaLabel(oferta.categoria);
  const imagemOferta = oferta.banner_oferta_url || oferta.logomarca_url || "";

  return (
    <button
      ref={cardRef}
      onClick={() =>
        navigate(`/cidade/${slug}/servicos/${oferta.categoria}/${oferta.id}`, {
          state: { backTo: `/cidade/${slug}/ofertas` },
        })
      }
      className="group relative overflow-hidden rounded-[17px] border border-border/30 bg-card shadow-[0_10px_26px_rgba(15,23,42,0.10)] transition-all hover:shadow-xl active:scale-[0.985] text-left"
    >
      <div className="relative aspect-[2.85] w-full">
        {imagemOferta ? (
          <img
            src={imagemOferta}
            alt={oferta.nome}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-muted to-muted/60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-transparent" />

        <div className="absolute right-3 top-3">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[10px] font-medium text-white/75 shadow-sm backdrop-blur-sm">
            {categoriaLabel}
          </span>
        </div>

        <div className="absolute bottom-3 left-3">
          <span className="mt-3 inline-flex w-fit items-center rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[10px] font-semibold text-white/80 shadow-sm backdrop-blur-sm">
            Ver oferta
          </span>
        </div>

        <div className="absolute bottom-3 right-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-normal text-white backdrop-blur-sm">
            <Eye className="h-3 w-3" />
            {visualizacoes} {labelVisualizacao}
          </span>
        </div>
      </div>
    </button>
  );
};

const OfertaVideoCard = ({ oferta, slug, visualizacoes }: Omit<OfertaCardProps, "onImpressaoQualificada">) => {
  const navigate = useNavigate();
  const labelVisualizacao = visualizacoes <= 1 ? "visualiza\u00E7\u00E3o" : "visualiza\u00E7\u00F5es";
  const categoriaLabel = formatarCategoriaLabel(oferta.categoria);

  return (
    <article className="overflow-hidden rounded-[17px] border border-border/30 bg-card shadow-[0_10px_26px_rgba(15,23,42,0.10)]">
      <div className="relative bg-black">
        <video
          src={oferta.video_url || ""}
          controls
          playsInline
          preload="metadata"
          className="h-[420px] max-h-[70vh] w-full bg-black object-contain"
        />
        <div className="pointer-events-none absolute right-3 top-3">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-medium text-white/85 shadow-sm backdrop-blur-sm">
            {categoriaLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{oferta.nome}</p>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Eye className="h-3 w-3" />
            {visualizacoes} {labelVisualizacao}
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            navigate(`/cidade/${slug}/servicos/${oferta.categoria}/${oferta.id}`, {
              state: { backTo: `/cidade/${slug}/ofertas` },
            })
          }
          className="flex-shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-neutral-100"
        >
          Ver oferta
        </button>
      </div>
    </article>
  );
};

const OfertasListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  useSwipeBack({ onBack: () => navigate(`/cidade/${slug}`) });

  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("todas");
  const [modoVisualizacao, setModoVisualizacao] = useState<"imagem" | "video">("imagem");
  const [visualizacoesById, setVisualizacoesById] = useState<Record<string, number>>({});
  const pendingIncrementRef = useRef<Set<string>>(new Set());

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

  const { data: ofertas, isLoading } = useQuery({
    queryKey: ["todas-ofertas", cidade?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome, categoria, banner_oferta_url, logomarca_url, video_url, descricao, visualizacoes")
        .eq("cidade_id", cidade!.id)
        .eq("status", "ativo");
      if (error) throw error;
      return (data || []) as Oferta[];
    },
    enabled: !!cidade?.id,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!ofertas?.length) return;
    setVisualizacoesById((prev) => {
      const next = { ...prev };
      for (const oferta of ofertas) {
        if (next[oferta.id] == null) {
          next[oferta.id] = Number(oferta.visualizacoes || 0);
        }
      }
      return next;
    });
  }, [ofertas]);

  const registrarImpressaoQualificada = useCallback(async (ofertaId: string) => {
    const now = Date.now();
    const impressaoMap = getImpressaoMap();
    const ultima = impressaoMap[ofertaId] || 0;

    if (now - ultima < IMPRESSAO_COOLDOWN_MS) return;
    if (pendingIncrementRef.current.has(ofertaId)) return;

    impressaoMap[ofertaId] = now;
    setImpressaoMap(impressaoMap);

    pendingIncrementRef.current.add(ofertaId);
    setVisualizacoesById((prev) => ({
      ...prev,
      [ofertaId]: Number(prev[ofertaId] || 0) + 1,
    }));

    const { data, error } = await supabase.rpc("incrementar_visualizacao_oferta", {
      p_empresa_id: ofertaId,
    });

    if (error) {
      const rollbackMap = getImpressaoMap();
      delete rollbackMap[ofertaId];
      setImpressaoMap(rollbackMap);
      setVisualizacoesById((prev) => ({
        ...prev,
        [ofertaId]: Math.max(0, Number(prev[ofertaId] || 0) - 1),
      }));
      pendingIncrementRef.current.delete(ofertaId);
      return;
    }

    if (typeof data === "number") {
      setVisualizacoesById((prev) => ({
        ...prev,
        [ofertaId]: data,
      }));
    }

    pendingIncrementRef.current.delete(ofertaId);
  }, []);

  const ofertasEmOrdemAleatoria = useMemo(() => shuffleArray(ofertas || []), [ofertas]);

  const ofertasFiltradas = useMemo(() => {
    return ofertasEmOrdemAleatoria.filter((oferta) => {
      const matchSearch = !searchTerm || oferta.nome.toLowerCase().includes(searchTerm.toLowerCase());
      if (categoriaAtiva === "todas") return matchSearch;
      const dbCats = CATEGORIA_MAP[categoriaAtiva] || [];
      return dbCats.includes(oferta.categoria) && matchSearch;
    });
  }, [ofertasEmOrdemAleatoria, categoriaAtiva, searchTerm]);

  const ofertasVisiveis = useMemo(
    () => (modoVisualizacao === "video" ? ofertasFiltradas.filter((oferta) => !!oferta.video_url) : ofertasFiltradas),
    [modoVisualizacao, ofertasFiltradas],
  );

  return (
    <div id="swipe-back-page" className="flex h-screen min-h-screen flex-col overflow-hidden bg-background">
      <header className="z-10 flex-shrink-0 p-4 pt-safe border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col leading-tight">
            <h1 className="text-lg font-semibold text-foreground">Mural de ofertas</h1>
            <p className="text-sm leading-tight text-muted-foreground">As melhores ofertas das melhoras empresas</p>
          </div>
        </div>
      </header>

      <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ofertas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <button
            type="button"
            onClick={() => setModoVisualizacao("imagem")}
            className={`flex h-10 flex-shrink-0 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition-colors ${
              modoVisualizacao === "imagem"
                ? "border-[#1f2937] bg-[#1f2937] text-white"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
            aria-label="Ver imagens"
          >
            Imagem
          </button>
          <button
            type="button"
            onClick={() => setModoVisualizacao("video")}
            className={`flex h-10 flex-shrink-0 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition-colors ${
              modoVisualizacao === "video"
                ? "border-[#1f2937] bg-[#1f2937] text-white"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
            aria-label="Ver vídeos"
          >
            Vídeo
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-border bg-card/30">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 px-4 py-3 w-max">
            {TODAS_CATEGORIAS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaAtiva(cat.id)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[62px] text-center"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-lg transition-colors ${
                    categoriaAtiva === cat.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  <cat.Icone className="h-4 w-4" />
                </span>
                <span
                  className={`text-[11px] font-medium leading-tight ${
                    categoriaAtiva === cat.id ? "text-primary" : "text-foreground"
                  }`}
                >
                  {cat.nome}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto overscroll-contain p-4 pb-32">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[2.85] rounded-[17px] bg-muted animate-pulse" />
            ))}
          </div>
        ) : ofertasVisiveis.length > 0 ? (
          <div className="space-y-3">
            {ofertasVisiveis.map((oferta) =>
              modoVisualizacao === "video" ? (
                <OfertaVideoCard
                  key={oferta.id}
                  oferta={oferta}
                  slug={slug || ""}
                  visualizacoes={Number(visualizacoesById[oferta.id] ?? oferta.visualizacoes ?? 0)}
                />
              ) : (
                <OfertaCard
                  key={oferta.id}
                  oferta={oferta}
                  slug={slug || ""}
                  visualizacoes={Number(visualizacoesById[oferta.id] ?? oferta.visualizacoes ?? 0)}
                  onImpressaoQualificada={registrarImpressaoQualificada}
                />
              ),
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BadgePercent className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-foreground mb-1">
              {modoVisualizacao === "video" ? "Nenhum vídeo nessa categoria" : "Nenhuma oferta nessa categoria"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {modoVisualizacao === "video" ? "Apenas empresas com vídeo aparecem aqui." : "Seja o primeiro a anunciar aqui!"}
            </p>
            <button
              onClick={() => navigate(`/cidade/${slug}/empresa/novo`)}
              className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Coloque sua empresa aqui
            </button>
          </div>
        )}
      </main>

      <BottomNavBar slug={slug} active="ofertas" />
    </div>
  );
};

export default OfertasListPage;
