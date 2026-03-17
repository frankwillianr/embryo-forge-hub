import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AloPrefeitura } from "@/types/aloPrefeitura";

interface AloPrefeituraCardProps {
  item: AloPrefeitura;
  cidadeSlug?: string;
  isActive?: boolean;
}

const getYouTubeThumb = (url?: string | null) => {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match?.[1] ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
};

const AloPrefeituraCard = ({ item, cidadeSlug, isActive = false }: AloPrefeituraCardProps) => {
  const navigate = useNavigate();
  const primeiraImagem = item.imagens?.[0]?.imagem_url;
  const videoThumb = getYouTubeThumb(item.video_url);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !item.video_url || videoThumb) return;

    if (isActive) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isActive, item.video_url, videoThumb]);

  const handleClick = () => {
    navigate(`/cidade/${cidadeSlug}/alo-prefeitura#${item.id}`, { state: { fromAloCard: true } });
  };

  return (
    <div onClick={handleClick} className="flex-shrink-0 w-56 cursor-pointer group">
      <div className="h-[245px] max-w-full overflow-hidden rounded-2xl bg-muted/50">
        {primeiraImagem ? (
          <img
            src={primeiraImagem}
            alt={item.titulo}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : item.video_url ? (
          <div className="relative w-full h-full bg-muted/30">
            {videoThumb ? (
              <img
                src={videoThumb}
                alt={item.titulo}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <video
                ref={videoRef}
                src={item.video_url}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loop
                muted
                playsInline
                preload="metadata"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/45 backdrop-blur-[1px] flex items-center justify-center">
                <Play className="h-5 w-5 text-white ml-0.5" />
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted/30 to-muted/60" />
        )}
      </div>

      <div className="pt-2.5 space-y-0.5">
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
          {format(new Date(item.created_at), "dd MMM · HH:mm", { locale: ptBR })}
        </p>
        <h3 className="font-medium text-foreground line-clamp-2 text-[13px] leading-tight tracking-tight">
          {item.titulo}
        </h3>
        {item.descricao && (
          <p className="text-[11px] text-muted-foreground/70 line-clamp-1 leading-snug mt-0.5">
            {item.descricao}
          </p>
        )}
      </div>
    </div>
  );
};

export default AloPrefeituraCard;
