import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ThumbsUp, ThumbsDown, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { AloPrefeitura, AloPrefeituraImagem } from "@/types/aloPrefeitura";

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

const AloPrefeituraDetailPage = () => {
  const { slug, itemId } = useParams<{ slug: string; itemId: string }>();
  const navigate = useNavigate();
  useSwipeBack({ onBack: () => navigate(`/cidade/${slug}`) });
  const queryClient = useQueryClient();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const fingerprint = getFingerprint();

  // Busca dados
  const { data: item, isLoading } = useQuery({
    queryKey: ["alo-prefeitura-detail", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .select("*")
        .eq("id", itemId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Busca imagens
      const { data: imagensData } = await supabase
        .from("rel_cidade_alo_prefeitura_imagens")
        .select("*")
        .eq("alo_prefeitura_id", itemId)
        .order("ordem");

      // Busca contagem de reações
      const { count: likesCount } = await supabase
        .from("rel_cidade_alo_prefeitura_reacoes")
        .select("*", { count: "exact", head: true })
        .eq("alo_prefeitura_id", itemId)
        .eq("tipo", "like");

      const { count: dislikesCount } = await supabase
        .from("rel_cidade_alo_prefeitura_reacoes")
        .select("*", { count: "exact", head: true })
        .eq("alo_prefeitura_id", itemId)
        .eq("tipo", "dislike");

      return {
        ...data,
        imagens: (imagensData || []) as AloPrefeituraImagem[],
        likes_count: likesCount || 0,
        dislikes_count: dislikesCount || 0,
      } as AloPrefeitura;
    },
    enabled: !!itemId,
  });

  // Busca reação do usuário
  const { data: userReaction } = useQuery({
    queryKey: ["alo-prefeitura-reaction", itemId, fingerprint],
    queryFn: async () => {
      const { data } = await supabase
        .from("rel_cidade_alo_prefeitura_reacoes")
        .select("tipo")
        .eq("alo_prefeitura_id", itemId)
        .eq("user_fingerprint", fingerprint)
        .maybeSingle();

      return data?.tipo as "like" | "dislike" | null;
    },
    enabled: !!itemId,
  });

  // Mutation para reagir
  const reactMutation = useMutation({
    mutationFn: async (tipo: "like" | "dislike") => {
      if (userReaction === tipo) {
        await supabase
          .from("rel_cidade_alo_prefeitura_reacoes")
          .delete()
          .eq("alo_prefeitura_id", itemId)
          .eq("user_fingerprint", fingerprint);
      } else {
        await supabase
          .from("rel_cidade_alo_prefeitura_reacoes")
          .upsert(
            { alo_prefeitura_id: itemId, user_fingerprint: fingerprint, tipo },
            { onConflict: "alo_prefeitura_id,user_fingerprint" }
          );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alo-prefeitura-detail", itemId] });
      queryClient.invalidateQueries({ queryKey: ["alo-prefeitura-reaction", itemId] });
    },
  });

  const handleShare = async () => {
    try {
      await navigator.share({
        title: item?.titulo,
        text: item?.descricao,
        url: window.location.href,
      });
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado!");
    }
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Publicação não encontrada</p>
        <Button onClick={() => navigate(`/cidade/${slug}/alo-prefeitura`)}>Voltar</Button>
      </div>
    );
  }

  const imagens = item.imagens || [];
  const embedUrl = item.video_url ? getYouTubeEmbedUrl(item.video_url) : null;

  return (
    <div id="swipe-back-page" className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}/alo-prefeitura`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">Voz do Povo</span>
      </header>

      {/* Media - Imagens ou Vídeo */}
      {imagens.length > 0 ? (
        <div className="relative">
          <img
            src={imagens[currentImageIndex]?.imagem_url}
            alt={item.titulo}
            className="w-full aspect-video object-cover"
          />
          {imagens.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
              {imagens.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentImageIndex ? "bg-primary" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : embedUrl ? (
        <iframe
          src={embedUrl}
          className="w-full aspect-video"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      ) : (
        <div className="w-full aspect-video bg-muted flex items-center justify-center">
          <span className="text-muted-foreground">Sem mídia</span>
        </div>
      )}

      {/* Conteúdo */}
      <div className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          {format(new Date(item.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
        </p>

        <h1 className="text-xl font-bold text-foreground">{item.titulo}</h1>

        <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {item.descricao}
        </p>

        {/* Ações */}
        <div className="flex items-center gap-4 pt-4 border-t border-border">
          <Button
            variant={userReaction === "like" ? "default" : "outline"}
            size="sm"
            onClick={() => reactMutation.mutate("like")}
            disabled={reactMutation.isPending}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            {item.likes_count}
          </Button>
          <Button
            variant={userReaction === "dislike" ? "destructive" : "outline"}
            size="sm"
            onClick={() => reactMutation.mutate("dislike")}
            disabled={reactMutation.isPending}
          >
            <ThumbsDown className="h-4 w-4 mr-1" />
            {item.dislikes_count}
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare} className="ml-auto">
            <Share2 className="h-4 w-4 mr-1" />
            Compartilhar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AloPrefeituraDetailPage;
