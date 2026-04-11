import { useState } from "react";
import { Play, Clock, Timer, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Cinema } from "@/types/cinema";

interface CinemaCardProps {
  cinema: Cinema;
  showHorarios?: boolean;
  onOpenDetails?: () => void;
}

const cleanText = (value?: string | null): string =>
  (value || "")
    .replace(/`r`n/gi, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getClassificacaoClasses = (classificacao?: string | null): string => {
  const value = cleanText(classificacao).toUpperCase();
  if (!value) return "bg-zinc-100 text-zinc-700 border border-zinc-300";
  if (value === "L") return "bg-emerald-100 text-emerald-800 border border-emerald-300";
  if (value.includes("10")) return "bg-blue-100 text-blue-800 border border-blue-300";
  if (value.includes("12")) return "bg-amber-100 text-amber-800 border border-amber-300";
  if (value.includes("14")) return "bg-orange-100 text-orange-800 border border-orange-300";
  if (value.includes("16")) return "bg-red-100 text-red-800 border border-red-300";
  if (value.includes("18")) return "bg-zinc-900 text-white border border-zinc-900";
  return "bg-zinc-100 text-zinc-700 border border-zinc-300";
};

const toBrDate = (value: string): string => {
  const onlyDate = value.slice(0, 10);
  const m = onlyDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const toEstreiaBr = (cinema: Cinema): string | null => {
  if (cinema.data_estreia) return toBrDate(cinema.data_estreia);
  const dias = (cinema.dias_exibicao || [])
    .filter((d): d is string => typeof d === "string" && !!d)
    .slice()
    .sort();
  const first = dias[0];
  if (!first) return null;
  return toBrDate(first);
};

const toEstreiaIso = (cinema: Cinema): string | null => {
  if (cinema.data_estreia) return cinema.data_estreia.slice(0, 10);
  const dias = (cinema.dias_exibicao || [])
    .filter((d): d is string => typeof d === "string" && !!d)
    .slice()
    .sort();
  return dias[0] || null;
};

const toLocalTodayIso = (): string => {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
};

const getDiasParaEstreia = (cinema: Cinema): number | null => {
  const estreiaIso = toEstreiaIso(cinema);
  if (!estreiaIso) return null;
  const todayIso = toLocalTodayIso();
  const estreiaDate = new Date(`${estreiaIso}T00:00:00`);
  const todayDate = new Date(`${todayIso}T00:00:00`);
  const diffMs = estreiaDate.getTime() - todayDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const CinemaCard = ({ cinema, showHorarios = true, onOpenDetails }: CinemaCardProps) => {
  const [trailerOpen, setTrailerOpen] = useState(false);
  const estreiaBr = toEstreiaBr(cinema);
  const diasParaEstreia = getDiasParaEstreia(cinema);
  const nomeFilme = cleanText(cinema.nome_filme);
  const genero = cleanText(cinema.genero);
  const duracao = cleanText(cinema.duracao);
  const sinopse = cleanText(cinema.sinopse);

  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : null;
  };

  const embedUrl = cinema.trailer_url ? getYouTubeEmbedUrl(cinema.trailer_url) : null;
  const handleTrailerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenDetails) {
      onOpenDetails();
      return;
    }
    setTrailerOpen(true);
  };

  return (
    <>
      <div className="flex gap-3 group">
        <div className="w-28 h-40 rounded-xl overflow-hidden bg-muted/30 flex-shrink-0 relative">
          {cinema.banner_url ? (
            <img
              src={cinema.banner_url}
              alt={nomeFilme}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-muted/20 to-muted/40 flex items-center justify-center">
              <Play className="h-8 w-8 text-muted-foreground/40" />
            </div>
          )}
          {embedUrl && (
            <button
              onClick={handleTrailerClick}
              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
              </div>
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 py-1 flex flex-col">
          <h3 className="text-[14px] font-semibold text-foreground line-clamp-2 leading-tight tracking-tight">
            {nomeFilme}
          </h3>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {genero && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700">
                <Tag className="h-2.5 w-2.5" />
                {genero}
              </Badge>
            )}
            {duracao && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                <Timer className="h-3 w-3" />
                {duracao}
              </span>
            )}
          </div>

          {(cinema.classificacao || estreiaBr) && (
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/70 flex-wrap">
              {cinema.classificacao && (
                <span className={`px-1.5 py-0.5 rounded ${getClassificacaoClasses(cinema.classificacao)}`}>
                  Classificacao: {cinema.classificacao}
                </span>
              )}
              {estreiaBr && <span>Estreia: {estreiaBr}</span>}
            </div>
          )}

          {sinopse && (
            <p className="text-[11px] text-muted-foreground/60 line-clamp-2 mt-1.5 leading-relaxed">
              {sinopse}
            </p>
          )}

          {showHorarios && cinema.horarios && cinema.horarios.length > 0 && (
            <div className="mt-auto pt-2">
              <div className="flex items-center gap-1 mb-1.5">
                <Clock className="h-3 w-3 text-primary/70" />
                <span className="text-[10px] text-muted-foreground/70">Horarios</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cinema.horarios.map((hora, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-600 text-white"
                  >
                    {hora}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!showHorarios && (
            <div className="mt-auto pt-2">
              {typeof diasParaEstreia === "number" && diasParaEstreia > 0 ? (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Faltam {diasParaEstreia} {diasParaEstreia === 1 ? "dia" : "dias"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Em breve
                </Badge>
              )}
            </div>
          )}

          {embedUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleTrailerClick}
              className="mt-2 h-7 text-[11px] gap-1.5 w-fit"
            >
              <Play className="h-3 w-3" />
              Trailer
            </Button>
          )}
        </div>
      </div>

      <Dialog open={trailerOpen} onOpenChange={setTrailerOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg sm:max-w-xl p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-base">{nomeFilme}</DialogTitle>
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
