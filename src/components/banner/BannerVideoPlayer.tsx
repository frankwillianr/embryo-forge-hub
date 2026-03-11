import { Play } from "lucide-react";
import { useState } from "react";

interface BannerVideoPlayerProps {
  videoUrl?: string | null;
  youtubeUrl?: string | null;
  posterUrl?: string | null;
  title: string;
}

const BannerVideoPlayer = ({ videoUrl, youtubeUrl, posterUrl, title }: BannerVideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(true);

  // Extract YouTube embed URL
  const getYoutubeEmbedUrl = (url: string) => {
    const videoId = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    )?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0` : null;
  };

  const embedUrl = youtubeUrl ? getYoutubeEmbedUrl(youtubeUrl) : null;

  // No video available
  if (!videoUrl && !embedUrl) return null;

  // Uploaded video
  if (videoUrl) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Vídeo</h3>
        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
          <video
            src={videoUrl}
            controls
            className="w-full h-full object-contain"
            poster={posterUrl || undefined}
            autoPlay
            muted
            playsInline
            preload="metadata"
          >
            Seu navegador não suporta vídeos.
          </video>
        </div>
      </div>
    );
  }

  // YouTube video
  if (embedUrl) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Vídeo</h3>
        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
          {isPlaying ? (
            <iframe
              src={embedUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          ) : (
            <button
              onClick={() => setIsPlaying(true)}
              className="relative w-full h-full group"
            >
              {/* YouTube thumbnail */}
              <img
                src={`https://img.youtube.com/vi/${youtubeUrl?.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]}/maxresdefault.jpg`}
                alt={title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to hqdefault if maxresdefault doesn't exist
                  const target = e.target as HTMLImageElement;
                  if (target.src.includes('maxresdefault')) {
                    target.src = target.src.replace('maxresdefault', 'hqdefault');
                  }
                }}
              />
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="h-8 w-8 text-primary-foreground ml-1" fill="currentColor" />
                </div>
              </div>
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default BannerVideoPlayer;
