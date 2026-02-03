import { useState } from "react";
import { Play, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Cinema } from "@/types/cinema";

interface CinemaCardProps {
  cinema: Cinema;
}

const CinemaCard = ({ cinema }: CinemaCardProps) => {
  const [trailerOpen, setTrailerOpen] = useState(false);

  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : null;
  };

  const embedUrl = cinema.trailer_url ? getYouTubeEmbedUrl(cinema.trailer_url) : null;

  return (
    <>
      <div className="flex gap-3 group">
        {/* Poster */}
        <div className="w-28 h-40 rounded-xl overflow-hidden bg-muted/30 flex-shrink-0 relative">
          {cinema.banner_url ? (
            <img
              src={cinema.banner_url}
              alt={cinema.nome_filme}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-muted/20 to-muted/40 flex items-center justify-center">
              <Play className="h-8 w-8 text-muted-foreground/40" />
            </div>
          )}
          {/* Trailer button overlay */}
          {embedUrl && (
            <button
              onClick={() => setTrailerOpen(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
              </div>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 py-1 flex flex-col">
          <h3 className="text-[14px] font-semibold text-foreground line-clamp-2 leading-tight tracking-tight">
            {cinema.nome_filme}
          </h3>
          
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/70">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{cinema.nome_cinema}</span>
          </div>

          {cinema.sinopse && (
            <p className="text-[11px] text-muted-foreground/60 line-clamp-2 mt-1.5 leading-relaxed">
              {cinema.sinopse}
            </p>
          )}

          {/* Horários */}
          {cinema.horarios && cinema.horarios.length > 0 && (
            <div className="mt-auto pt-2">
              <div className="flex items-center gap-1 mb-1.5">
                <Clock className="h-3 w-3 text-primary/70" />
                <span className="text-[10px] text-muted-foreground/70">Horários</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cinema.horarios.map((hora, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                  >
                    {hora}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Trailer button mobile */}
          {embedUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTrailerOpen(true)}
              className="mt-2 h-7 text-[11px] gap-1.5 w-fit"
            >
              <Play className="h-3 w-3" />
              Trailer
            </Button>
          )}
        </div>
      </div>

      {/* Trailer Modal */}
      <Dialog open={trailerOpen} onOpenChange={setTrailerOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg sm:max-w-xl p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-base">{cinema.nome_filme}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full px-4 pb-4">
            {embedUrl && (
              <iframe
                src={embedUrl}
                className="w-full h-full rounded-xl"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CinemaCard;
