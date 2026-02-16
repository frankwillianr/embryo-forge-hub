import { useState, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Volume2, VolumeX, MoreHorizontal, Play } from "lucide-react";
import { type Jornal, parseImagens } from "@/types/jornal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface JornalFeedCardProps {
  jornal: Jornal;
  cidadeSlug?: string;
}

// Fingerprint simples baseado no browser
const getFingerprint = () => {
  const nav = window.navigator;
  const screen = window.screen;
  const data = [nav.userAgent, nav.language, screen.width, screen.height].join("|");
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString();
};

const JornalFeedCard = ({ jornal, cidadeSlug }: JornalFeedCardProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const fingerprint = getFingerprint();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullText, setShowFullText] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [comentario, setComentario] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRead, setIsRead] = useState(() => {
    const read = JSON.parse(localStorage.getItem("jornal-lidos") || "[]");
    return read.includes(jornal.id);
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);

  const imagens = parseImagens(jornal.imagens);
  const hasMultipleImages = imagens.length > 1;

  // Busca reação do usuário
  const { data: userReaction } = useQuery({
    queryKey: ["jornal-reaction-feed", jornal.id, fingerprint],
    queryFn: async () => {
      const { data } = await supabase
        .from("rel_cidade_jornal_reacoes")
        .select("tipo")
        .eq("jornal_id", jornal.id)
        .eq("user_fingerprint", fingerprint)
        .maybeSingle();

      return data?.tipo as "like" | "dislike" | null;
    },
  });

  // Busca dados atualizados do jornal (likes, etc)
  const { data: jornalAtualizado } = useQuery({
    queryKey: ["jornal-feed", jornal.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("rel_cidade_jornal")
        .select("*")
        .eq("id", jornal.id)
        .maybeSingle();

      if (!data) return jornal;

      // Busca contagem de likes
      const { count: likesCount } = await supabase
        .from("rel_cidade_jornal_reacoes")
        .select("*", { count: "exact", head: true })
        .eq("jornal_id", jornal.id)
        .eq("tipo", "like");

      return { ...data, imagens: parseImagens(data.imagens), likes_count: likesCount || 0 };
    },
    initialData: jornal,
  });

  // Busca comentários
  const { data: comentarios = [] } = useQuery({
    queryKey: ["jornal-comentarios-feed", jornal.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_jornal_comentarios")
        .select(`
          id,
          comentario,
          created_at,
          profiles:user_id (nome, foto_url)
        `)
        .eq("jornal_id", jornal.id)
        .order("created_at", { ascending: false })
        .limit(2);

      if (error) throw error;

      return (data || []).map((c: any) => ({
        ...c,
        profile: c.profiles,
      }));
    },
  });

  // Mutation para reagir (like)
  const reactMutation = useMutation({
    mutationFn: async (tipo: "like" | "dislike") => {
      // Se já tem a mesma reação, remove
      if (userReaction === tipo) {
        const { error } = await supabase
          .from("rel_cidade_jornal_reacoes")
          .delete()
          .eq("jornal_id", jornal.id)
          .eq("user_fingerprint", fingerprint);
        if (error) throw error;
        return null;
      } else {
        // Upsert reação (adiciona ou troca)
        const { error } = await supabase
          .from("rel_cidade_jornal_reacoes")
          .upsert(
            { jornal_id: jornal.id, user_fingerprint: fingerprint, tipo },
            { onConflict: "jornal_id,user_fingerprint" }
          );
        if (error) throw error;
        return tipo;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jornal-feed", jornal.id] });
      queryClient.invalidateQueries({ queryKey: ["jornal-reaction-feed", jornal.id, fingerprint] });
    },
  });

  // Mutation para comentar
  const comentarMutation = useMutation({
    mutationFn: async (texto: string) => {
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("rel_cidade_jornal_comentarios")
        .insert({
          jornal_id: jornal.id,
          user_id: user.id,
          comentario: texto,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setComentario("");
      setShowCommentForm(false);
      toast.success("Comentário publicado!");
      // Redireciona para ver os comentários
      handleCardClick();
    },
    onError: () => {
      toast.error("Erro ao publicar comentário");
    },
  });
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultipleImages) return;
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !hasMultipleImages) return;
    const diff = e.touches[0].clientX - startX;
    setTranslateX(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging || !hasMultipleImages) return;
    setIsDragging(false);
    
    const threshold = 50;
    if (translateX > threshold && currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    } else if (translateX < -threshold && currentImageIndex < imagens.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    }
    setTranslateX(0);
  };

  const handleCardClick = () => {
    if (!isRead) {
      const read = JSON.parse(localStorage.getItem("jornal-lidos") || "[]");
      read.push(jornal.id);
      localStorage.setItem("jornal-lidos", JSON.stringify(read));
      setIsRead(true);
    }
    navigate(`/cidade/${cidadeSlug}/jornal/${jornal.id}`);
  };

  const handleDoubleTap = () => {
    // Duplo clique dá like
    reactMutation.mutate("like");
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    reactMutation.mutate("like");
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate(`/cidade/${cidadeSlug}/auth`);
      return;
    }
    setShowCommentForm(!showCommentForm);
  };

  const handleEnviarComentario = () => {
    if (!comentario.trim()) {
      toast.error("Digite um comentário");
      return;
    }
    comentarMutation.mutate(comentario.trim());
  };

  const handleSpeakClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Se está falando, para
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Inicia a fala
    const text = `${jornal.titulo}. ${descricao || ""}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1.0; // Velocidade normal
    utterance.pitch = 1.0;

    // Tenta usar uma voz em português
    const allVoices = window.speechSynthesis.getVoices();
    const ptVoices = allVoices.filter(v => v.lang.startsWith("pt"));
    if (ptVoices.length > 0) {
      utterance.voice = ptVoices[0];
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      if (e.error !== 'canceled') {
        setIsSpeaking(false);
      }
    };

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const descricao = (jornal.descricao || "").replace(/\\n/g, '\n');
  const shouldTruncate = descricao.length > 100;

  return (
    <article className="border-b border-border/50 relative">
      {/* Header - perfil estilo Instagram */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent p-[2px]">
            <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
              <span className="text-xs font-semibold text-foreground">
                J
              </span>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-foreground leading-tight">
                Jornal da Cidade
              </span>
              {isRead ? (
                <span className="text-[9px] bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5 rounded-full leading-none">
                  lida
                </span>
              ) : (
                <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full leading-none">
                  não lida
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(jornal.created_at), { addSuffix: true, locale: ptBR })}
              {jornal.categoria && (
                <>
                  {" · "}
                  <span className="text-primary">{jornal.categoria}</span>
                </>
              )}
            </span>
          </div>
        </div>
        <button className="p-2 -mr-2">
          <MoreHorizontal className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Imagem/Carrossel */}
      <div 
        ref={containerRef}
        className="relative aspect-square w-full overflow-hidden bg-muted/30"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleTap}
      >
        {imagens.length > 0 ? (
          <>
            <div 
              className={`flex h-full ${isDragging ? '' : 'transition-transform duration-300'}`}
              style={{
                transform: `translateX(calc(-${currentImageIndex * 100}% + ${translateX}px))`
              }}
            >
              {imagens.map((url, index) => (
                <div key={index} className="w-full h-full flex-shrink-0">
                  <img
                    src={url}
                    alt={`${jornal.titulo} - ${index + 1}`}
                    className="w-full h-full object-cover"
                    onClick={handleCardClick}
                  />
                </div>
              ))}
            </div>
            
            {/* Indicadores de imagem */}
            {hasMultipleImages && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
                {imagens.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      index === currentImageIndex
                        ? "w-1.5 bg-primary"
                        : "w-1.5 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : jornal.video_url ? (
          <div 
            className="w-full h-full flex items-center justify-center bg-muted/50 cursor-pointer"
            onClick={handleCardClick}
          >
            <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur flex items-center justify-center">
              <Play className="h-8 w-8 text-white ml-1" fill="white" />
            </div>
          </div>
        ) : (
          <div 
            className="w-full h-full bg-gradient-to-br from-muted/40 to-muted/80 cursor-pointer"
            onClick={handleCardClick}
          />
        )}
      </div>

      {/* Ações estilo Instagram */}
      <div className="px-3 pt-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLikeClick}
              className="active:scale-90 transition-transform"
              title="Curtir"
              disabled={reactMutation.isPending}
            >
              <Heart
                className={`h-6 w-6 ${userReaction === 'like' ? 'text-red-500 fill-red-500' : 'text-foreground'}`}
              />
            </button>
            <button
              onClick={handleCommentClick}
              className="active:scale-90 transition-transform"
              title="Comentar"
            >
              <MessageCircle className="h-6 w-6 text-foreground" />
            </button>
          </div>
          <button
            onClick={handleSpeakClick}
            className="active:scale-90 transition-transform"
            title={isSpeaking ? "Parar narração" : "Ouvir notícia"}
          >
            {isSpeaking ? (
              <VolumeX className="h-5 w-5 text-foreground" />
            ) : (
              <Volume2 className="h-5 w-5 text-foreground" />
            )}
          </button>
        </div>

        {/* Curtidas */}
        <div className="mt-2">
          <span className="text-[13px] font-semibold text-foreground">
            {jornalAtualizado?.likes_count || 0} curtidas
          </span>
        </div>

        {/* Título e descrição */}
        <div className="mt-1">
          <p className="text-[13px] text-foreground leading-relaxed">
            <span className="font-semibold mr-1.5">Jornal</span>
            <span className="font-medium">{jornal.titulo}</span>
          </p>
          {descricao && (
            <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">
              {shouldTruncate && !showFullText ? (
                <>
                  {descricao.slice(0, 100)}...
                  <button
                    onClick={() => setShowFullText(true)}
                    className="text-muted-foreground/70 ml-1 font-medium"
                  >
                    mais
                  </button>
                </>
              ) : (
                descricao
              )}
            </p>
          )}

          {/* Ver comentários */}
          {comentarios.length > 0 && (
            <button
              onClick={handleCardClick}
              className="text-[13px] text-muted-foreground/70 mt-2 block"
            >
              Ver {comentarios.length === 2 ? 'os 2 primeiros' : 'o'} comentário{comentarios.length > 1 ? 's' : ''}
            </button>
          )}

          {/* Últimos comentários */}
          {comentarios.slice(0, 2).map((comentario: any) => (
            <div key={comentario.id} className="flex gap-2 mt-2">
              <p className="text-[13px] text-foreground leading-relaxed">
                <span className="font-semibold mr-1">
                  {comentario.profile?.nome || "Usuário"}
                </span>
                <span className="text-muted-foreground">
                  {comentario.comentario}
                </span>
              </p>
            </div>
          ))}

          {/* Form de Comentário */}
          {showCommentForm && (
            <div className="mt-3 space-y-2 p-3 bg-muted/20 rounded-lg border border-border/50">
              <div className="flex items-start gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={profile?.foto_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {profile?.nome?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Textarea
                    placeholder="Escreva seu comentário..."
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCommentForm(false);
                    setComentario("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleEnviarComentario}
                  disabled={comentarMutation.isPending || !comentario.trim()}
                  className="bg-primary hover:bg-primary/90"
                >
                  {comentarMutation.isPending ? "Enviando..." : "Publicar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export default JornalFeedCard;
