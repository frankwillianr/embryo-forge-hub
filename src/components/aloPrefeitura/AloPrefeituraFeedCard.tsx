import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Heart, MessageCircle, Pause, Volume2, VolumeX, Trash2, X } from "lucide-react";
import { type AloPrefeitura } from "@/types/aloPrefeitura";
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

interface AloPrefeituraFeedCardProps {
  item: AloPrefeitura;
  cidadeSlug?: string;
  isVideoActive?: boolean;
  globalMuted: boolean;
  onGlobalMutedChange: (muted: boolean) => void;
  globalAutoplay: boolean;
  onGlobalAutoplayChange: (enabled: boolean) => void;
}

const AloPrefeituraFeedCard = ({
  item,
  cidadeSlug,
  isVideoActive = false,
  globalMuted,
  onGlobalMutedChange,
  globalAutoplay,
  onGlobalAutoplayChange,
}: AloPrefeituraFeedCardProps) => {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const fingerprint = user?.id || getFingerprint();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showCommentSheet, setShowCommentSheet] = useState(false);
  const [comentario, setComentario] = useState("");
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [comentarioToDelete, setComentarioToDelete] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);

  const imagens = item.imagens || [];
  const hasMultipleImages = imagens.length > 1;
  const getYouTubeEmbedUrl = (url?: string | null) => {
    if (!url) return null;
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    return match?.[1] ? `https://www.youtube.com/embed/${match[1]}?rel=0` : null;
  };
  const embedUrl = getYouTubeEmbedUrl(item.video_url);

  // iOS keyboard detection
  useEffect(() => {
    if (!showCommentSheet) {
      setKeyboardHeight(0);
      return;
    }
    const viewport = window.visualViewport;
    if (!viewport) return;

    const onResize = () => {
      const diff = window.innerHeight - viewport.height;
      setKeyboardHeight(diff > 50 ? diff : 0);
    };

    viewport.addEventListener("resize", onResize);
    viewport.addEventListener("scroll", onResize);
    return () => {
      viewport.removeEventListener("resize", onResize);
      viewport.removeEventListener("scroll", onResize);
    };
  }, [showCommentSheet]);

  // Busca reaÃ§Ã£o do usuÃ¡rio
  const { data: userReaction } = useQuery({
    queryKey: ["alo-reaction-feed", item.id, fingerprint],
    queryFn: async () => {
      const { data } = await supabase
        .from("rel_cidade_alo_prefeitura_reacoes")
        .select("tipo")
        .eq("alo_prefeitura_id", item.id)
        .eq("user_fingerprint", fingerprint)
        .maybeSingle();

      return (data?.tipo as "like" | "dislike") || null;
    },
  });

  // Busca dados atualizados (likes count)
  const { data: itemAtualizado } = useQuery({
    queryKey: ["alo-feed", item.id],
    queryFn: async () => {
      const { count: likesCount } = await supabase
        .from("rel_cidade_alo_prefeitura_reacoes")
        .select("*", { count: "exact", head: true })
        .eq("alo_prefeitura_id", item.id)
        .eq("tipo", "like");

      return { likes_count: likesCount || 0 };
    },
  });

  // Busca contagem de comentÃ¡rios
  const { data: comentariosCount = 0 } = useQuery({
    queryKey: ["alo-comentarios-count", item.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("rel_cidade_alo_prefeitura_comentarios")
        .select("*", { count: "exact", head: true })
        .eq("alo_prefeitura_id", item.id);

      if (error) return 0;
      return count || 0;
    },
  });

  // Busca comentÃ¡rios
  const { data: comentarios = [] } = useQuery({
    queryKey: ["alo-comentarios-feed", item.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_alo_prefeitura_comentarios")
        .select(`
          id,
          user_id,
          comentario,
          created_at
        `)
        .eq("alo_prefeitura_id", item.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Buscar perfis separadamente
      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, foto_url")
        .in("id", userIds);

      const profileMap = (profiles || []).reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});

      return data.map((c: any) => ({
        ...c,
        profile: profileMap[c.user_id] || null,
      }));
    },
    enabled: showCommentSheet,
  });

  // Mutation para reagir (like)
  const reactMutation = useMutation({
    mutationFn: async (tipo: "like" | "dislike") => {
      const { data: currentReaction } = await supabase
        .from("rel_cidade_alo_prefeitura_reacoes")
        .select("id, tipo")
        .eq("alo_prefeitura_id", item.id)
        .eq("user_fingerprint", fingerprint)
        .maybeSingle();

      if (currentReaction?.tipo === tipo) {
        const { error } = await supabase
          .from("rel_cidade_alo_prefeitura_reacoes")
          .delete()
          .eq("id", currentReaction.id);
        if (error) throw error;
        return null;
      } else {
        const { error } = await supabase
          .from("rel_cidade_alo_prefeitura_reacoes")
          .upsert(
            { alo_prefeitura_id: item.id, user_fingerprint: fingerprint, tipo },
            { onConflict: "alo_prefeitura_id,user_fingerprint" }
          );
        if (error) throw error;
        return tipo;
      }
    },
    onMutate: async (tipo) => {
      await queryClient.cancelQueries({ queryKey: ["alo-reaction-feed", item.id, fingerprint] });
      const previousReaction = queryClient.getQueryData(["alo-reaction-feed", item.id, fingerprint]);
      queryClient.setQueryData(
        ["alo-reaction-feed", item.id, fingerprint],
        (old: string | null) => old === tipo ? null : tipo
      );
      return { previousReaction };
    },
    onError: (_err, _tipo, context) => {
      queryClient.setQueryData(
        ["alo-reaction-feed", item.id, fingerprint],
        context?.previousReaction
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["alo-feed", item.id] });
      queryClient.invalidateQueries({ queryKey: ["alo-reaction-feed", item.id, fingerprint] });
    },
  });

  // Mutation para comentar
  const comentarMutation = useMutation({
    mutationFn: async (texto: string) => {
      if (!user) throw new Error("NÃ£o autenticado");

      const { error } = await supabase
        .from("rel_cidade_alo_prefeitura_comentarios")
        .insert({
          alo_prefeitura_id: item.id,
          user_id: user.id,
          comentario: texto,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setComentario("");
      toast.success("ComentÃ¡rio publicado!");
      queryClient.invalidateQueries({ queryKey: ["alo-comentarios-feed", item.id] });
      queryClient.invalidateQueries({ queryKey: ["alo-comentarios-count", item.id] });
    },
    onError: () => {
      toast.error("Erro ao publicar comentÃ¡rio");
    },
  });

  // Mutation para deletar comentÃ¡rio
  const deletarComentarioMutation = useMutation({
    mutationFn: async (comentarioId: string) => {
      const { error } = await supabase
        .from("rel_cidade_alo_prefeitura_comentarios")
        .delete()
        .eq("id", comentarioId);

      if (error) throw error;
    },
    onSuccess: () => {
      setComentarioToDelete(null);
      toast.success("ComentÃ¡rio excluÃ­do!");
      queryClient.invalidateQueries({ queryKey: ["alo-comentarios-feed", item.id] });
      queryClient.invalidateQueries({ queryKey: ["alo-comentarios-count", item.id] });
    },
    onError: () => {
      toast.error("Erro ao excluir comentÃ¡rio");
    },
  });

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    reactMutation.mutate("like");
  };

  const handleDoubleTap = () => {
    reactMutation.mutate("like");
    setShowLikeAnimation(true);
    setTimeout(() => setShowLikeAnimation(false), 1000);
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("FaÃ§a login para comentar");
      return;
    }
    setShowCommentSheet(true);
  };

  const handleEnviarComentario = () => {
    if (!comentario.trim()) {
      toast.error("Digite um comentÃ¡rio");
      return;
    }
    comentarMutation.mutate(comentario.trim());
  };

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

  const descricao = item.descricao || "";

  useEffect(() => {
    const syncPlayback = (videoEl: HTMLVideoElement | null) => {
      if (!videoEl) return;
      videoEl.muted = globalMuted;

      if (isVideoActive && globalAutoplay) {
        videoEl.play().catch(() => {
          // Falha silenciosa de autoplay em alguns navegadores.
        });
      } else {
        videoEl.pause();
      }
    };

    syncPlayback(primaryVideoRef.current);
    syncPlayback(secondaryVideoRef.current);
  }, [globalAutoplay, globalMuted, isVideoActive]);

  return (
    <article
      id={`alo-${item.id}`}
      data-alo-id={item.id}
      className="border-b border-border/50 relative mb-6 scroll-mt-16"
    >
      {/* Header */}
      <div className="flex items-center px-3 py-2.5">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary p-[2px] flex-shrink-0">
            <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
              <span className="text-xs font-semibold text-foreground">M</span>
            </div>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[13px] font-semibold text-foreground leading-tight">
              Voz do Povo
            </span>
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </div>
      </div>

      {/* Imagem/Carrossel */}
      <div
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
              {imagens.map((img, index) => (
                <div key={img.id || index} className="w-full h-full flex-shrink-0">
                  <img
                    src={img.imagem_url}
                    alt={`${item.titulo} - ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            {/* Indicadores */}
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
        ) : item.video_url ? (
          <div className="relative w-full h-full bg-muted/50">
            {embedUrl ? (
              <iframe
                src={`${embedUrl}&autoplay=${isVideoActive && globalAutoplay ? "1" : "0"}&mute=${globalMuted ? "1" : "0"}&controls=1&playsinline=1`}
                title={item.titulo}
                className="w-full h-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : (
              <>
                <video
                  ref={primaryVideoRef}
                  src={item.video_url}
                  className="w-full h-full object-cover"
                  loop
                  playsInline
                  preload="metadata"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
              </>
            )}
            {!embedUrl && (
              <div className="absolute right-2 bottom-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGlobalAutoplayChange(!globalAutoplay);
                  }}
                  className="h-9 px-3 rounded-full bg-black/60 text-white text-xs font-medium flex items-center justify-center"
                  title={globalAutoplay ? "Pausar vídeos" : "Reproduzir vídeos"}
                >
                  {globalAutoplay ? <Pause className="h-4 w-4" /> : "Play"}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGlobalMutedChange(!globalMuted);
                  }}
                  className="h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center"
                  title={globalMuted ? "Ativar áudio" : "Silenciar vídeos"}
                >
                  {globalMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted/40 to-muted/80" />
        )}

        {/* AnimaÃ§Ã£o de like */}
        {showLikeAnimation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Heart
              className="h-20 w-20 text-white drop-shadow-lg"
              fill="white"
              style={{ animation: "likeHeart 0.8s ease-out forwards" }}
            />
          </div>
        )}
      </div>

      {/* VÃ­deo (quando tem imagens E vÃ­deo) */}
      {imagens.length > 0 && item.video_url && (
        <div className="px-3 pt-2">
          <video
            ref={secondaryVideoRef}
            src={item.video_url}
            className="w-full rounded-xl aspect-video object-contain bg-black"
            loop
            playsInline
            preload="metadata"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onGlobalAutoplayChange(!globalAutoplay)}
              className="h-8 px-3 rounded-full bg-muted text-foreground text-xs font-medium"
            >
              {globalAutoplay ? "Pausar vídeos" : "Reproduzir vídeos"}
            </button>
            <button
              type="button"
              onClick={() => onGlobalMutedChange(!globalMuted)}
              className="h-8 px-3 rounded-full bg-muted text-foreground text-xs font-medium"
            >
              {globalMuted ? "Ativar áudio" : "Silenciar vídeos"}
            </button>
          </div>
        </div>
      )}

      {/* AÃ§Ãµes */}
      <div className="px-3 pt-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLikeClick}
              className="active:scale-90 transition-transform"
              disabled={reactMutation.isPending}
            >
              <Heart
                className={`h-6 w-6 ${userReaction === 'like' ? 'text-red-500 fill-red-500' : 'text-foreground'}`}
              />
            </button>
            <button
              onClick={handleCommentClick}
              className="active:scale-90 transition-transform flex items-center gap-1"
            >
              <MessageCircle className="h-6 w-6 text-foreground" />
              {comentariosCount > 0 && (
                <span className="text-[13px] text-foreground font-medium">
                  {comentariosCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Contagem de likes */}
        <div className="mt-1.5">
          <span className="text-[13px] font-semibold text-foreground">
            {itemAtualizado?.likes_count || 0} curtidas
          </span>
        </div>

        {/* TÃ­tulo e descriÃ§Ã£o */}
        <div className="mt-1 mb-3">
          <p className="text-[14px] text-foreground leading-relaxed font-semibold">
            {item.titulo}
          </p>
          {descricao && (
            <div className="text-[13px] text-muted-foreground leading-relaxed mt-1">
              <p className="whitespace-pre-line">{descricao}</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de ComentÃ¡rios */}
      <Sheet open={showCommentSheet} onOpenChange={setShowCommentSheet}>
        <SheetContent
          side="bottom"
          className="rounded-t-[20px] p-0 [&>button]:hidden transition-[height] duration-150"
          style={{
            height: keyboardHeight > 0
              ? `calc(85dvh - ${keyboardHeight}px)`
              : "85dvh",
            paddingBottom: keyboardHeight > 0 ? 0 : "env(safe-area-inset-bottom, 0px)",
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="px-4 py-3 border-b border-border/50 flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-base font-semibold">
              ComentÃ¡rios {comentariosCount > 0 && `(${comentariosCount})`}
            </SheetTitle>
            <button
              onClick={() => setShowCommentSheet(false)}
              className="rounded-full p-1.5 hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </SheetHeader>

          <div className="flex flex-col h-[calc(100%-60px)]">
            {/* Lista de comentÃ¡rios */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {comentarios.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Nenhum comentÃ¡rio ainda. Seja o primeiro!
                </div>
              ) : (
                comentarios.map((c: any) => {
                  const isOwnComment = user && c.user_id === user.id;
                  return (
                    <div key={c.id} className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={c.profile?.foto_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {c.profile?.nome?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-foreground">
                            {c.profile?.nome || "UsuÃ¡rio"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                          {isOwnComment && (
                            <button
                              onClick={() => setComentarioToDelete(c.id)}
                              className="ml-auto p-1 hover:bg-destructive/10 rounded transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          )}
                        </div>
                        <p className="text-[13px] text-foreground leading-relaxed">
                          {c.comentario}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Form de comentÃ¡rio */}
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
                    placeholder="Adicione um comentÃ¡rio..."
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={1}
                    className="resize-none text-base min-h-[36px]"
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

      {/* Modal de confirmaÃ§Ã£o de exclusÃ£o */}
      <AlertDialog open={!!comentarioToDelete} onOpenChange={(open) => !open && setComentarioToDelete(null)}>
        <AlertDialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comentÃ¡rio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta aÃ§Ã£o nÃ£o pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => comentarioToDelete && deletarComentarioMutation.mutate(comentarioToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
};

export default AloPrefeituraFeedCard;

