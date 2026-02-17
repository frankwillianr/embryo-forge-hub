import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import BannerImageCarousel from "@/components/banner/BannerImageCarousel";
import BannerVideoPlayer from "@/components/banner/BannerVideoPlayer";
import type { Banner, BannerImagem } from "@/types/banner";

const BannerDetailPage = () => {
  const { id, slug } = useParams<{ id: string; slug: string }>();
  const navigate = useNavigate();

  // Fetch banner data
  const { data: banner, isLoading: loadingBanner } = useQuery({
    queryKey: ["banner", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banner")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Banner;
    },
    enabled: !!id,
  });

  // Fetch additional images
  const { data: images = [] } = useQuery({
    queryKey: ["banner-images", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banner_imagens")
        .select("*")
        .eq("banner_id", id)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data as BannerImagem[];
    },
    enabled: !!id,
  });

  if (loadingBanner) {
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
        <Button variant="outline" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  // Combine all images for the carousel
  const carouselImages = images.map((img) => img.imagem_url);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 pt-safe border-b border-border bg-card sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground line-clamp-1">
          {banner.titulo}
        </h1>
      </header>

      {/* Content */}
      <div className="pb-8">
        {/* Banner Principal */}
        <div className="aspect-[16/9] w-full">
          <img
            src={banner.imagem_url}
            alt={banner.titulo}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="p-4 space-y-6">
          {/* Título */}
          <h2 className="text-2xl font-bold text-foreground">{banner.titulo}</h2>

          {/* Descrição */}
          {banner.descricao && (
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {banner.descricao}
            </p>
          )}

          {/* Carrossel de Imagens */}
          {carouselImages.length > 0 && (
            <BannerImageCarousel images={carouselImages} />
          )}

          {/* Vídeo */}
          <BannerVideoPlayer
            videoUrl={banner.video_upload_url}
            youtubeUrl={banner.video_youtube_url}
            title={banner.titulo}
          />
        </div>
      </div>
    </div>
  );
};

export default BannerDetailPage;
