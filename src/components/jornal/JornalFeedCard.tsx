import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Volume2, VolumeX, MoreHorizontal, Play, Trash2 } from "lucide-react";
import { type Jornal, parseImagens } from "@/types/jornal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { audioManager } from "@/lib/audioManager";

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
  const [showCommentSheet, setShowCommentSheet] = useState(false);
  const [comentario, setComentario] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [comentarioToDelete, setComentarioToDelete] = useState<string | null>(null);
  const [isRead, setIsRead] = useState(() => {
    const read = JSON.parse(localStorage.getItem("jornal-lidos") || "[]");
    return read.includes(jornal.id);
  });

  // Ouvir mudanças no audioManager global
  useEffect(() => {
    const unsubscribe = audioManager.addListener((isPlaying, audioId) => {
      // Se não está tocando nada OU está tocando outro áudio
      if (!isPlaying || audioId !== jornal.id) {
        setIsSpeaking(false);
      } else if (audioId === jornal.id) {
        setIsSpeaking(true);
      }
    });

    return unsubscribe;
  }, [jornal.id]);

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

  // Busca contagem de comentários
  const { data: comentariosCount = 0 } = useQuery({
    queryKey: ["jornal-comentarios-count", jornal.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("rel_cidade_jornal_comentarios")
        .select("*", { count: "exact", head: true })
        .eq("jornal_id", jornal.id);

      return count || 0;
    },
  });

  // Busca todos comentários (usado no modal)
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
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((c: any) => ({
        ...c,
        profile: c.profiles,
      }));
    },
    enabled: showCommentSheet, // Só busca quando abre o modal
  });

  // Mutation para reagir (like)
  const reactMutation = useMutation({
    mutationFn: async (tipo: "like" | "dislike") => {
      // Buscar reação atual do banco para garantir estado correto
      const { data: currentReaction } = await supabase
        .from("rel_cidade_jornal_reacoes")
        .select("tipo")
        .eq("jornal_id", jornal.id)
        .eq("user_fingerprint", fingerprint)
        .maybeSingle();

      // Se já tem a mesma reação, remove
      if (currentReaction?.tipo === tipo) {
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
      toast.success("Comentário publicado!");
      queryClient.invalidateQueries({ queryKey: ["jornal-comentarios-feed", jornal.id] });
      queryClient.invalidateQueries({ queryKey: ["jornal-comentarios-count", jornal.id] });
    },
    onError: () => {
      toast.error("Erro ao publicar comentário");
    },
  });

  // Mutation para deletar comentário
  const deletarComentarioMutation = useMutation({
    mutationFn: async (comentarioId: string) => {
      const { error } = await supabase
        .from("rel_cidade_jornal_comentarios")
        .delete()
        .eq("id", comentarioId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comentário excluído!");
      queryClient.invalidateQueries({ queryKey: ["jornal-comentarios-feed", jornal.id] });
      queryClient.invalidateQueries({ queryKey: ["jornal-comentarios-count", jornal.id] });
      setComentarioToDelete(null);
    },
    onError: () => {
      toast.error("Erro ao excluir comentário");
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

    // Mostrar animação de coração
    setShowLikeAnimation(true);
    setTimeout(() => setShowLikeAnimation(false), 1000);
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
    setShowCommentSheet(true);
  };

  const handleEnviarComentario = () => {
    if (!comentario.trim()) {
      toast.error("Digite um comentário");
      return;
    }
    comentarMutation.mutate(comentario.trim());
  };

  const handleSpeakClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Se está tocando este áudio, para
    if (isSpeaking) {
      audioManager.stopAll();
      return;
    }

    try {
      // Se tem áudio pré-gerado, usa ele
      if (jornal.audio_url) {
        await audioManager.playAudio(jornal.audio_url, jornal.id);
      } else {
        // Fallback para Web Speech API
        const text = `${jornal.titulo}. ${descricao || ""}`;
        audioManager.playSpeech(text, jornal.id);
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      toast.error("Erro ao reproduzir áudio");
      setIsSpeaking(false);
    }
  };

  const descricao = (jornal.descricao || "").replace(/\\n/g, '\n');
  const shouldTruncate = descricao.length > 100;

  return (
    <article id={`jornal-${jornal.id}`} className="border-b border-border/50 relative mb-6 scroll-mt-16">
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
        {/* Animação de Like */}
        {showLikeAnimation && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 pointer-events-none">
            <Heart
              className="w-24 h-24 text-white fill-white animate-[ping_0.6s_ease-out]"
              style={{
                animation: 'likeHeart 0.8s ease-out',
              }}
            />
          </div>
        )}

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
          <div className="w-full h-full flex items-center justify-center bg-muted/50">
            <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur flex items-center justify-center">
              <Play className="h-8 w-8 text-white ml-1" fill="white" />
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted/40 to-muted/80" />
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
              className="active:scale-90 transition-transform flex items-center gap-1"
              title="Comentar"
            >
              <MessageCircle className="h-6 w-6 text-foreground" />
              {comentariosCount > 0 && (
                <span className="text-[13px] text-foreground font-medium">
                  {comentariosCount}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={handleSpeakClick}
            className="active:scale-90 transition-transform flex items-center gap-1.5"
            title={isSpeaking ? "Parar narração" : "Ouvir notícia"}
          >
            {isSpeaking ? (
              <>
                <VolumeX className="h-5 w-5 text-foreground" />
                <span className="text-[13px] text-foreground font-medium">Pausar</span>
              </>
            ) : (
              <>
                <Volume2 className="h-5 w-5 text-foreground" />
                <span className="text-[13px] text-foreground font-medium">Ouvir notícia</span>
              </>
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
        <div className="mt-1 mb-3">
          <p className="text-[13px] text-foreground leading-relaxed">
            <span className="font-semibold mr-1.5">Jornal</span>
            <span className="font-medium">{jornal.titulo}</span>
          </p>
          {descricao && (
            <div className="text-[13px] text-muted-foreground leading-relaxed mt-1 whitespace-pre-line">
              {shouldTruncate && !showFullText ? (
                <>
                  {descricao.slice(0, 100)}...
                  <button
                    onClick={() => setShowFullText(true)}
                    className="text-foreground ml-1.5 font-semibold hover:text-muted-foreground transition-colors"
                  >
                    mais
                  </button>
                </>
              ) : (
                descricao
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Comentários */}
      <Sheet open={showCommentSheet} onOpenChange={setShowCommentSheet}>
        <SheetContent
          side="bottom"
          className="h-[85vh] rounded-t-[20px] p-0 pb-safe"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="px-4 py-3 border-b border-border/50">
            <SheetTitle className="text-base font-semibold">
              Comentários {comentariosCount > 0 && `(${comentariosCount})`}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col h-[calc(100%-60px)]">
            {/* Lista de comentários */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {comentarios.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Nenhum comentário ainda. Seja o primeiro!
                </div>
              ) : (
                comentarios.map((comentario: any) => {
                  const isOwnComment = user && comentario.user_id === user.id;
                  return (
                    <div key={comentario.id} className="flex gap-3 group">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={comentario.profile?.foto_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {comentario.profile?.nome?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-foreground">
                            {comentario.profile?.nome || "Usuário"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(comentario.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                          {isOwnComment && (
                            <button
                              onClick={() => setComentarioToDelete(comentario.id)}
                              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Excluir comentário"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive hover:text-destructive/80" />
                            </button>
                          )}
                        </div>
                        <p className="text-[13px] text-foreground leading-relaxed">
                          {comentario.comentario}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Form de comentário fixo no fundo */}
            <div className="border-t border-border/50 p-3 bg-background">
              <div className="flex items-start gap-2">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={profile?.foto_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {profile?.nome?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <Textarea
                    placeholder="Adicione um comentário..."
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={1}
                    className="resize-none text-sm min-h-[36px]"
                  />
                  <Button
                    size="sm"
                    onClick={handleEnviarComentario}
                    disabled={comentarMutation.isPending || !comentario.trim()}
                    className="bg-primary hover:bg-primary/90 h-9"
                  >
                    {comentarMutation.isPending ? "..." : "Enviar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={!!comentarioToDelete} onOpenChange={(open) => !open && setComentarioToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O comentário será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => comentarioToDelete && deletarComentarioMutation.mutate(comentarioToDelete)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
};

export default JornalFeedCard;
