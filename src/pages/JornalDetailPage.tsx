import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Jornal, JornalImagem } from "@/types/jornal";

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

interface Comentario {
  id: string;
  jornal_id: string;
  user_id: string;
  comentario: string;
  created_at: string;
  profile?: {
    nome: string;
    foto_url: string | null;
  };
}

const JornalDetailPage = () => {
  const { slug, jornalId } = useParams<{ slug: string; jornalId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [novoComentario, setNovoComentario] = useState("");
  const [mostrarFormComentario, setMostrarFormComentario] = useState(false);
  const fingerprint = getFingerprint();

  // Touch handling for swipe
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Busca dados do jornal
  const { data: jornal, isLoading } = useQuery({
    queryKey: ["jornal-detail", jornalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_jornal")
        .select("*")
        .eq("id", jornalId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Busca imagens
      const { data: imagensData } = await supabase
        .from("rel_cidade_jornal_imagens")
        .select("*")
        .eq("jornal_id", jornalId)
        .order("ordem");

      // Busca contagem de reações
      const { count: likesCount } = await supabase
        .from("rel_cidade_jornal_reacoes")
        .select("*", { count: "exact", head: true })
        .eq("jornal_id", jornalId)
        .eq("tipo", "like");

      const { count: dislikesCount } = await supabase
        .from("rel_cidade_jornal_reacoes")
        .select("*", { count: "exact", head: true })
        .eq("jornal_id", jornalId)
        .eq("tipo", "dislike");

      return {
        ...data,
        imagens: (imagensData || []) as JornalImagem[],
        likes_count: likesCount || 0,
        dislikes_count: dislikesCount || 0,
      } as Jornal;
    },
    enabled: !!jornalId,
  });

  // Busca reação do usuário
  const { data: userReaction } = useQuery({
    queryKey: ["jornal-reaction", jornalId, fingerprint],
    queryFn: async () => {
      const { data } = await supabase
        .from("rel_cidade_jornal_reacoes")
        .select("tipo")
        .eq("jornal_id", jornalId)
        .eq("user_fingerprint", fingerprint)
        .maybeSingle();

      return data?.tipo as "like" | "dislike" | null;
    },
    enabled: !!jornalId,
  });

  // Busca comentários
  const { data: comentarios = [] } = useQuery({
    queryKey: ["jornal-comentarios", jornalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_jornal_comentarios")
        .select(`
          id,
          jornal_id,
          user_id,
          comentario,
          created_at,
          profiles:user_id (nome, foto_url)
        `)
        .eq("jornal_id", jornalId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((c: any) => ({
        ...c,
        profile: c.profiles,
      })) as Comentario[];
    },
    enabled: !!jornalId,
  });

  // Verifica se usuário está bloqueado de comentar
  const { data: usuarioBloqueado } = useQuery({
    queryKey: ["usuario-bloqueado", jornal?.cidade_id, user?.id],
    queryFn: async () => {
      if (!jornal?.cidade_id || !user?.id) return false;
      
      const { data, error } = await supabase
        .from("rel_cidade_jornal_comentarios_bloqueados")
        .select("id")
        .eq("cidade_id", jornal.cidade_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return false;
      return !!data;
    },
    enabled: !!jornal?.cidade_id && !!user?.id,
  });

  // Mutation para reagir
  const reactMutation = useMutation({
    mutationFn: async ({ tipo, currentReaction }: { tipo: "like" | "dislike"; currentReaction: "like" | "dislike" | null | undefined }) => {
      // Se já tem a mesma reação, remove
      if (currentReaction === tipo) {
        const { error } = await supabase
          .from("rel_cidade_jornal_reacoes")
          .delete()
          .eq("jornal_id", jornalId)
          .eq("user_fingerprint", fingerprint);
        if (error) throw error;
        return null;
      } else {
        // Upsert reação (adiciona ou troca)
        const { error } = await supabase
          .from("rel_cidade_jornal_reacoes")
          .upsert(
            { jornal_id: jornalId, user_fingerprint: fingerprint, tipo },
            { onConflict: "jornal_id,user_fingerprint" }
          );
        if (error) throw error;
        return tipo;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jornal-detail", jornalId] });
      queryClient.invalidateQueries({ queryKey: ["jornal-reaction", jornalId, fingerprint] });
    },
  });

  const handleReaction = (tipo: "like" | "dislike") => {
    reactMutation.mutate({ tipo, currentReaction: userReaction });
  };

  // Mutation para comentar
  const comentarMutation = useMutation({
    mutationFn: async (comentario: string) => {
      if (!user) throw new Error("Não autenticado");
      
      const { error } = await supabase
        .from("rel_cidade_jornal_comentarios")
        .insert({
          jornal_id: jornalId,
          user_id: user.id,
          comentario,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jornal-comentarios", jornalId] });
      setNovoComentario("");
      setMostrarFormComentario(false);
      toast.success("Comentário publicado!");
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
      queryClient.invalidateQueries({ queryKey: ["jornal-comentarios", jornalId] });
      toast.success("Comentário excluído!");
    },
    onError: () => {
      toast.error("Erro ao excluir comentário");
    },
  });

  const handleComentarClick = () => {
    if (!user) {
      navigate(`/cidade/${slug}/auth`);
      return;
    }
    if (usuarioBloqueado) {
      toast.error("Você está bloqueado de comentar nesta cidade");
      return;
    }
    setMostrarFormComentario(true);
  };

  const handleEnviarComentario = () => {
    if (!novoComentario.trim()) {
      toast.error("Digite um comentário");
      return;
    }
    comentarMutation.mutate(novoComentario.trim());
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent, totalImages: number) => {
    if (touchStartX.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentImageIndex < totalImages - 1) {
        setCurrentImageIndex((prev) => prev + 1);
      } else if (diff < 0 && currentImageIndex > 0) {
        setCurrentImageIndex((prev) => prev - 1);
      }
    }
    
    touchStartX.current = null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!jornal) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Notícia não encontrada</p>
        <Button onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  const imagens = jornal.imagens || [];
  const embedUrl = jornal.video_url ? getYouTubeEmbedUrl(jornal.video_url) : null;
  // Se não for URL do YouTube, pode ser vídeo direto
  const isDirectVideo = jornal.video_url && !embedUrl;
  const hasVideo = embedUrl || isDirectVideo;
  
  // Total de itens na galeria (vídeo primeiro + imagens)
  const totalMediaItems = (hasVideo ? 1 : 0) + imagens.length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}/jornal`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">Notícia</span>
      </header>

      {/* Media Gallery - Vídeo primeiro + Imagens */}
      {totalMediaItems > 0 ? (
        <div>
          <div 
            ref={containerRef}
            className="relative overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={(e) => handleTouchEnd(e, totalMediaItems)}
          >
            <div 
              className="flex transition-transform duration-300 ease-out w-full"
              style={{ 
                transform: `translateX(-${currentImageIndex * 100}%)`
              }}
            >
              {/* Vídeo como primeiro item */}
              {embedUrl && (
                <div className="w-full flex-shrink-0">
                  <iframe
                    src={embedUrl}
                    className="w-full aspect-[16/10]"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              )}
              {isDirectVideo && (
                <div className="w-full flex-shrink-0">
                  <video
                    src={jornal.video_url!}
                    className="w-full aspect-[16/10] object-contain bg-black"
                    controls
                    preload="metadata"
                  />
                </div>
              )}
              
              {/* Imagens */}
              {imagens.map((img, idx) => (
                <div key={img.id} className="w-full flex-shrink-0 bg-muted/30">
                  <img
                    src={img.imagem_url}
                    alt={`${jornal.titulo} - Imagem ${idx + 1}`}
                    className="w-full aspect-[4/3] object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* Dots de navegação - abaixo da mídia */}
          {totalMediaItems > 1 && (
            <div className="flex justify-center gap-1.5 py-3">
              {Array.from({ length: totalMediaItems }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    idx === currentImageIndex 
                      ? "bg-primary w-4" 
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-2"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full aspect-video bg-muted flex items-center justify-center">
          <span className="text-muted-foreground">Sem mídia</span>
        </div>
      )}

      {/* Conteúdo */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {format(new Date(jornal.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </span>
          {jornal.fonte && (
            <span className="text-primary/80">
              via {jornal.fonte}
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold text-foreground">{jornal.titulo}</h1>

        <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {jornal.descricao}
        </p>

        {/* Ações */}
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button
            variant={userReaction === "like" ? "default" : "outline"}
            size="sm"
            onClick={() => handleReaction("like")}
            disabled={reactMutation.isPending}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            {jornal.likes_count}
          </Button>
          <Button
            variant={userReaction === "dislike" ? "destructive" : "outline"}
            size="sm"
            onClick={() => handleReaction("dislike")}
            disabled={reactMutation.isPending}
          >
            <ThumbsDown className="h-4 w-4 mr-1" />
            {jornal.dislikes_count}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleComentarClick}
            className="ml-auto"
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            Comentar
          </Button>
        </div>

        {/* Form de Comentário */}
        {mostrarFormComentario && (
          <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.foto_url || undefined} />
                <AvatarFallback className="text-xs">
                  {profile?.nome?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-2">
                  {profile?.nome?.split(" ")[0] || "Usuário"}
                </p>
                <Textarea
                  placeholder="Escreva seu comentário..."
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setMostrarFormComentario(false);
                  setNovoComentario("");
                }}
              >
                Cancelar
              </Button>
              <Button 
                size="sm"
                onClick={handleEnviarComentario}
                disabled={comentarMutation.isPending || !novoComentario.trim()}
                className="bg-[#331D4A] hover:bg-[#331D4A]/90"
              >
                {comentarMutation.isPending ? "Enviando..." : "Publicar"}
              </Button>
            </div>
          </div>
        )}

        {/* Lista de Comentários */}
        {comentarios.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Comentários ({comentarios.length})
            </h3>
            <div className="space-y-4">
              {comentarios.map((comentario) => (
                <div key={comentario.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={comentario.profile?.foto_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {comentario.profile?.nome?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {comentario.profile?.nome || "Usuário"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(comentario.created_at), "dd/MM 'às' HH:mm")}
                      </span>
                      {user?.id === comentario.user_id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              disabled={deletarComentarioMutation.isPending}
                              className="ml-auto text-muted-foreground hover:text-destructive transition-colors p-1"
                              title="Excluir comentário"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px]">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja apagar este comentário? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deletarComentarioMutation.mutate(comentario.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 mt-1 break-words">
                      {comentario.comentario}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JornalDetailPage;
