import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BadgePercent,
  Eye,
  Heart,
  MessageCircle,
  Pause,
  Play,
  Trash2,
  Volume2,
  VolumeX,
  X,
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import BottomNavBar from "@/components/navigation/BottomNavBar";
import { toast } from "sonner";

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

const formatarVisualizacoes = (value: number) => Number(value || 0).toLocaleString("pt-BR");

const getFingerprint = () => {
  const nav = window.navigator;
  const screen = window.screen;
  const data = [nav.userAgent, nav.language, screen.width, screen.height].join("|");
  let hash = 0;
  for (let i = 0; i < data.length; i += 1) {
    hash = (hash << 5) - hash + data.charCodeAt(i);
    hash &= hash;
  }
  return hash.toString();
};

const shuffleArray = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const IMPRESSAO_THRESHOLD = 0.08;

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

type OfertaCardProps = {
  oferta: Oferta;
  slug: string;
  visualizacoes: number;
  onImpressaoQualificada: (ofertaId: string) => void;
};

type OfertaVideoCardProps = OfertaCardProps & {
  isVideoActive: boolean;
  globalMuted: boolean;
  onGlobalMutedChange: (muted: boolean) => void;
  globalAutoplay: boolean;
  onGlobalAutoplayChange: (enabled: boolean) => void;
};

const useRegistrarImpressaoAoAparecer = <T extends HTMLElement>(
  ofertaId: string,
  onImpressaoQualificada: (ofertaId: string) => void,
) => {
  const elementRef = useRef<T | null>(null);
  const disparouRef = useRef(false);

  useEffect(() => {
    disparouRef.current = false;
  }, [ofertaId]);

  useEffect(() => {
    const node = elementRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || disparouRef.current) return;

        if (entry.isIntersecting && entry.intersectionRatio >= IMPRESSAO_THRESHOLD) {
          disparouRef.current = true;
          onImpressaoQualificada(ofertaId);
          observer.unobserve(node);
        }
      },
      { threshold: [0, IMPRESSAO_THRESHOLD] },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [ofertaId, onImpressaoQualificada]);

  return elementRef;
};

const incrementarVisualizacaoOferta = async (ofertaId: string) => {
  const { data: rpcData, error: rpcError } = await supabase.rpc("incrementar_visualizacao_oferta", {
    p_empresa_id: ofertaId,
  });

  if (rpcError) throw rpcError;
  if (typeof rpcData === "number" && rpcData > 0) return rpcData;

  const { data: atual, error: fetchError } = await supabase
    .from("rel_cidade_servico_empresa")
    .select("visualizacoes")
    .eq("id", ofertaId)
    .eq("status", "ativo")
    .single();

  if (fetchError) throw fetchError;

  const proximoTotal = Number(atual?.visualizacoes || 0) + 1;
  const { data: updated, error: updateError } = await supabase
    .from("rel_cidade_servico_empresa")
    .update({ visualizacoes: proximoTotal })
    .eq("id", ofertaId)
    .eq("status", "ativo")
    .select("visualizacoes")
    .single();

  if (updateError) throw updateError;

  return Number(updated?.visualizacoes || proximoTotal);
};

const OfertaCard = ({ oferta, slug, visualizacoes, onImpressaoQualificada }: OfertaCardProps) => {
  const navigate = useNavigate();
  const cardRef = useRegistrarImpressaoAoAparecer<HTMLButtonElement>(oferta.id, onImpressaoQualificada);

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
      <div className="relative aspect-[2.18] w-full">
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
            {formatarVisualizacoes(visualizacoes)} {labelVisualizacao}
          </span>
        </div>
      </div>
    </button>
  );
};

const OfertaVideoCard = ({
  oferta,
  slug,
  visualizacoes,
  onImpressaoQualificada,
  isVideoActive,
  globalMuted,
  onGlobalMutedChange,
  globalAutoplay,
  onGlobalAutoplayChange,
}: OfertaVideoCardProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const fingerprint = user?.id || getFingerprint();
  const cardRef = useRegistrarImpressaoAoAparecer<HTMLElement>(oferta.id, onImpressaoQualificada);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showCommentSheet, setShowCommentSheet] = useState(false);
  const [comentario, setComentario] = useState("");
  const labelVisualizacao = visualizacoes <= 1 ? "visualiza\u00E7\u00E3o" : "visualiza\u00E7\u00F5es";
  const categoriaLabel = formatarCategoriaLabel(oferta.categoria);

  const { data: userReaction } = useQuery({
    queryKey: ["oferta-reaction", oferta.id, fingerprint],
    queryFn: async () => {
      const { data } = await supabase
        .from("rel_cidade_servico_empresa_reacoes")
        .select("tipo")
        .eq("empresa_id", oferta.id)
        .eq("user_fingerprint", fingerprint)
        .maybeSingle();

      return (data?.tipo as "like" | "dislike") || null;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
  });

  const { data: likesCount = 0 } = useQuery({
    queryKey: ["oferta-likes-count", oferta.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("rel_cidade_servico_empresa_reacoes")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", oferta.id)
        .eq("tipo", "like");

      return count || 0;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
  });

  const { data: comentariosCount = 0 } = useQuery({
    queryKey: ["oferta-comentarios-count", oferta.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("rel_cidade_servico_empresa_comentarios")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", oferta.id);

      return count || 0;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
  });

  const { data: comentarios = [] } = useQuery({
    queryKey: ["oferta-comentarios", oferta.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_oferta_comentarios_public", {
        p_empresa_id: oferta.id,
      });

      if (error) throw error;

      return (data || []).map((item: any) => ({
        ...item,
        profile: {
          nome: item.profile_nome,
          foto_url: item.profile_foto_url,
        },
      }));
    },
    enabled: showCommentSheet,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
  });

  const reactMutation = useMutation({
    mutationFn: async () => {
      const { data: currentReaction } = await supabase
        .from("rel_cidade_servico_empresa_reacoes")
        .select("id, tipo")
        .eq("empresa_id", oferta.id)
        .eq("user_fingerprint", fingerprint)
        .maybeSingle();

      if (currentReaction?.tipo === "like") {
        const { error } = await supabase
          .from("rel_cidade_servico_empresa_reacoes")
          .delete()
          .eq("id", currentReaction.id);
        if (error) throw error;
        return null;
      }

      const { error } = await supabase
        .from("rel_cidade_servico_empresa_reacoes")
        .upsert(
          { empresa_id: oferta.id, user_fingerprint: fingerprint, tipo: "like" },
          { onConflict: "empresa_id,user_fingerprint" },
        );

      if (error) throw error;
      return "like";
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oferta-reaction", oferta.id, fingerprint] });
      queryClient.invalidateQueries({ queryKey: ["oferta-likes-count", oferta.id] });
    },
    onError: () => {
      toast.error("Nao foi possivel registrar a curtida.");
    },
  });

  const comentarMutation = useMutation({
    mutationFn: async (texto: string) => {
      if (!user) throw new Error("auth");

      const { error } = await supabase
        .from("rel_cidade_servico_empresa_comentarios")
        .insert({ empresa_id: oferta.id, user_id: user.id, comentario: texto });

      if (error) throw error;
    },
    onSuccess: () => {
      setComentario("");
      queryClient.invalidateQueries({ queryKey: ["oferta-comentarios", oferta.id] });
      queryClient.invalidateQueries({ queryKey: ["oferta-comentarios-count", oferta.id] });
      toast.success("Comentário publicado!");
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "auth") {
        navigate(`/cidade/${slug}/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      toast.error("Erro ao publicar comentário.");
    },
  });

  const deletarComentarioMutation = useMutation({
    mutationFn: async (comentarioId: string) => {
      const { error } = await supabase
        .from("rel_cidade_servico_empresa_comentarios")
        .delete()
        .eq("id", comentarioId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oferta-comentarios", oferta.id] });
      queryClient.invalidateQueries({ queryKey: ["oferta-comentarios-count", oferta.id] });
      toast.success("Comentário excluído!");
    },
    onError: () => {
      toast.error("Erro ao excluir comentário.");
    },
  });

  const handleCommentClick = () => {
    if (!user) {
      navigate(`/cidade/${slug}/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setShowCommentSheet(true);
  };

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    videoEl.muted = globalMuted;

    if (isVideoActive && globalAutoplay) {
      videoEl.play().catch(() => {
        // Alguns navegadores bloqueiam autoplay com audio; mantemos falha silenciosa.
      });
      return;
    }

    videoEl.pause();
  }, [globalAutoplay, globalMuted, isVideoActive]);

  return (
    <article
      ref={cardRef}
      data-oferta-video-id={oferta.id}
      className="flex h-full min-h-full snap-start snap-always flex-col overflow-hidden bg-card shadow-[0_10px_26px_rgba(15,23,42,0.10)] sm:rounded-[17px] sm:border sm:border-border/30"
    >
      <div className="relative min-h-0 flex-1 bg-black">
        <video
          ref={videoRef}
          src={oferta.video_url || ""}
          loop
          playsInline
          preload={isVideoActive ? "metadata" : "none"}
          className="h-full w-full bg-transparent object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        <div className="pointer-events-none absolute right-3 top-3">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-medium text-white/85 shadow-sm backdrop-blur-sm">
            {categoriaLabel}
          </span>
        </div>
        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onGlobalAutoplayChange(!globalAutoplay);
            }}
            className="h-9 px-3 rounded-full bg-black/60 text-white text-xs font-medium flex items-center justify-center"
            title={globalAutoplay ? "Pausar v\u00EDdeos" : "Reproduzir v\u00EDdeos"}
          >
            {globalAutoplay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onGlobalMutedChange(!globalMuted);
            }}
            className="h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center"
            title={globalMuted ? "Ativar \u00E1udio" : "Silenciar v\u00EDdeos"}
          >
            {globalMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="px-3 pt-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => reactMutation.mutate()}
              className="active:scale-90 transition-transform"
              disabled={reactMutation.isPending}
              title="Curtir"
            >
              <Heart className={`h-6 w-6 ${userReaction === "like" ? "text-red-500 fill-red-500" : "text-foreground"}`} />
            </button>
            <button
              type="button"
              onClick={handleCommentClick}
              className="active:scale-90 transition-transform flex items-center gap-1"
              title="Comentar"
            >
              <MessageCircle className="h-6 w-6 text-foreground" />
              {comentariosCount > 0 && (
                <span className="text-[13px] text-foreground font-medium">{comentariosCount}</span>
              )}
            </button>
          </div>
          <span className="text-[13px] font-semibold text-foreground">
            {formatarVisualizacoes(likesCount)} curtidas
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 p-3 pt-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{oferta.nome}</p>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Eye className="h-3 w-3" />
            {formatarVisualizacoes(visualizacoes)} {labelVisualizacao}
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

      <Sheet open={showCommentSheet} onOpenChange={setShowCommentSheet}>
        <SheetContent
          side="bottom"
          className="rounded-t-[20px] p-0 [&>button]:hidden"
          style={{ height: "85dvh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="px-4 py-3 border-b border-border/50 flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-base font-semibold">
              Comentários {comentariosCount > 0 && `(${comentariosCount})`}
            </SheetTitle>
            <button
              type="button"
              onClick={() => setShowCommentSheet(false)}
              className="rounded-full p-1.5 hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </SheetHeader>

          <div className="flex h-[calc(100%-60px)] flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {comentarios.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Nenhum comentário ainda. Seja o primeiro!
                </div>
              ) : (
                comentarios.map((item: any) => {
                  const isOwnComment = user && item.user_id === user.id;
                  return (
                    <div key={item.id} className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={item.profile?.foto_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {item.profile?.nome?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-foreground">
                            {item.profile?.nome || "Usuário"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString("pt-BR")}
                          </span>
                          {isOwnComment && (
                            <button
                              type="button"
                              onClick={() => deletarComentarioMutation.mutate(item.id)}
                              className="ml-auto p-1 hover:bg-destructive/10 rounded transition-colors"
                              title="Excluir comentário"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          )}
                        </div>
                        <p className="text-[13px] text-foreground leading-relaxed">{item.comentario}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-border/50 bg-background p-3">
              <div className="flex items-start gap-2">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={profile?.foto_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {profile?.nome?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 gap-2">
                  <Textarea
                    placeholder="Adicione um comentário..."
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={1}
                    className="min-h-[36px] resize-none text-base"
                    maxLength={1000}
                  />
                  <Button
                    size="sm"
                    onClick={() => comentarMutation.mutate(comentario.trim())}
                    disabled={comentarMutation.isPending || !comentario.trim()}
                    className="h-9"
                  >
                    {comentarMutation.isPending ? "..." : "Enviar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </article>
  );
};

const OfertasListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isGuiaPage = location.pathname.endsWith("/guia");
  const slugParts = String(slug || "cidade").split(/[-\s]+/).filter(Boolean);
  const apelidoCidade = slugParts.length > 1
    ? slugParts.map((part) => part.charAt(0)).join("").toUpperCase()
    : (slugParts[0] || "cidade").toUpperCase();
  useSwipeBack({ onBack: () => navigate(`/cidade/${slug}`) });

  const [categoriaAtiva, setCategoriaAtiva] = useState("todas");
  const [modoVisualizacao, setModoVisualizacao] = useState<"imagem" | "video">(isGuiaPage ? "video" : "imagem");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [globalMuted, setGlobalMuted] = useState(false);
  const [globalAutoplay, setGlobalAutoplay] = useState(true);
  const [visualizacoesById, setVisualizacoesById] = useState<Record<string, number>>({});
  const visualizacoesRegistradasNaTelaRef = useRef<Set<string>>(new Set());
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
    setModoVisualizacao(isGuiaPage ? "video" : "imagem");
  }, [isGuiaPage]);

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
    if (visualizacoesRegistradasNaTelaRef.current.has(ofertaId)) return;
    if (pendingIncrementRef.current.has(ofertaId)) return;

    visualizacoesRegistradasNaTelaRef.current.add(ofertaId);
    pendingIncrementRef.current.add(ofertaId);
    setVisualizacoesById((prev) => ({
      ...prev,
      [ofertaId]: Number(prev[ofertaId] || 0) + 1,
    }));

    try {
      const totalAtualizado = await incrementarVisualizacaoOferta(ofertaId);
      setVisualizacoesById((prev) => ({
        ...prev,
        [ofertaId]: totalAtualizado,
      }));
    } catch {
      visualizacoesRegistradasNaTelaRef.current.delete(ofertaId);
      setVisualizacoesById((prev) => ({
        ...prev,
        [ofertaId]: Math.max(0, Number(prev[ofertaId] || 0) - 1),
      }));
      pendingIncrementRef.current.delete(ofertaId);
      return;
    }

    pendingIncrementRef.current.delete(ofertaId);
  }, []);

  const ofertasEmOrdemAleatoria = useMemo(() => shuffleArray(ofertas || []), [ofertas]);

  const ofertasFiltradas = useMemo(() => {
    return ofertasEmOrdemAleatoria.filter((oferta) => {
      if (categoriaAtiva === "todas") return true;
      const dbCats = CATEGORIA_MAP[categoriaAtiva] || [];
      return dbCats.includes(oferta.categoria);
    });
  }, [ofertasEmOrdemAleatoria, categoriaAtiva]);

  const ofertasVisiveis = useMemo(
    () => (modoVisualizacao === "video" ? ofertasFiltradas.filter((oferta) => !!oferta.video_url) : ofertasFiltradas),
    [modoVisualizacao, ofertasFiltradas],
  );

  useEffect(() => {
    if (modoVisualizacao !== "video" || !ofertasVisiveis.length) {
      setActiveVideoId(null);
      return;
    }

    const visibleRatios = new Map<string, number>();
    let currentActiveId: string | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-oferta-video-id");
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
          setActiveVideoId(computedActiveId);
        }
      },
      { threshold: [0, 0.5] },
    );

    const elements = ofertasVisiveis
      .map((oferta) => document.querySelector(`[data-oferta-video-id="${oferta.id}"]`))
      .filter((el): el is Element => !!el);

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [modoVisualizacao, ofertasVisiveis]);

  return (
    <div id="swipe-back-page" className="flex h-screen min-h-screen flex-col overflow-hidden bg-background">
      <header className="z-10 flex-shrink-0 p-4 pt-safe border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col leading-tight">
            <h1 className="text-lg font-semibold text-foreground">
              {isGuiaPage ? `Guia ${apelidoCidade}` : "Mural de ofertas"}
            </h1>
            <p className="text-sm leading-tight text-muted-foreground">
              {isGuiaPage ? "Empresas e ofertas em video na cidade" : "As melhores ofertas das melhoras empresas"}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-shrink-0 border-b border-border bg-card/30">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 px-4 py-2.5 w-max">
            {TODAS_CATEGORIAS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaAtiva(cat.id)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[56px] text-center"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                    categoriaAtiva === cat.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  <cat.Icone className="h-3.5 w-3.5" />
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

      <main className={`flex-1 overflow-y-auto overscroll-contain ${modoVisualizacao === "video" ? "mb-[86px] snap-y snap-mandatory scroll-smooth px-0 py-0" : "p-4 pb-32"}`}>
        {isLoading ? (
          <div className={modoVisualizacao === "video" ? "h-full" : "space-y-3"}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={modoVisualizacao === "video" ? "h-full bg-muted animate-pulse" : "aspect-[2.18] rounded-[17px] bg-muted animate-pulse"} />
            ))}
          </div>
        ) : ofertasVisiveis.length > 0 ? (
          <div className={modoVisualizacao === "video" ? "h-full" : "space-y-3"}>
            {ofertasVisiveis.map((oferta) =>
              modoVisualizacao === "video" ? (
                <OfertaVideoCard
                  key={oferta.id}
                  oferta={oferta}
                  slug={slug || ""}
                  visualizacoes={Number(visualizacoesById[oferta.id] ?? oferta.visualizacoes ?? 0)}
                  onImpressaoQualificada={registrarImpressaoQualificada}
                  isVideoActive={activeVideoId === oferta.id}
                  globalMuted={globalMuted}
                  onGlobalMutedChange={setGlobalMuted}
                  globalAutoplay={globalAutoplay}
                  onGlobalAutoplayChange={setGlobalAutoplay}
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

      <BottomNavBar slug={slug} active={isGuiaPage ? "guia" : "ofertas"} />
    </div>
  );
};

export default OfertasListPage;
