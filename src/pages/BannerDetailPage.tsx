import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Banner } from "@/types/banner";

const BannerDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: banner, isLoading } = useQuery({
    queryKey: ["banner", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banner")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Banner;
    },
    enabled: !!id,
  });

  const getYoutubeEmbedUrl = (url: string) => {
    const videoId = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    )?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!banner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        <p className="text-muted-foreground">Banner não encontrado</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const embedUrl = banner.video_youtube_url
    ? getYoutubeEmbedUrl(banner.video_youtube_url)
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-border bg-card sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground line-clamp-1">
          {banner.titulo}
        </h1>
      </header>

      {/* Content */}
      <div className="pb-8">
        {/* Banner Image */}
        <div className="aspect-[16/9] w-full">
          <img
            src={banner.imagem_url}
            alt={banner.titulo}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="p-4 space-y-6">
          <h2 className="text-2xl font-bold text-foreground">{banner.titulo}</h2>

          {banner.descricao && (
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {banner.descricao}
            </p>
          )}

          {/* YouTube Video */}
          {embedUrl && (
            <div className="aspect-video w-full rounded-lg overflow-hidden">
              <iframe
                src={embedUrl}
                title={banner.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BannerDetailPage;
