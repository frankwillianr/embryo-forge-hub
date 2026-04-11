import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Film, Play, Clock, Tag, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Cinema } from "@/types/cinema";

interface CinemaHorizontalListProps {
  cidadeSlug?: string;
}

const cleanText = (value?: string | null): string =>
  (value || "")
    .replace(/`r`n/gi, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getClassificacaoClasses = (classificacao?: string | null): string => {
  const value = cleanText(classificacao).toUpperCase();
  if (!value) return "bg-zinc-100 text-zinc-700 border-zinc-300";
  if (value === "L") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (value.includes("10")) return "bg-blue-100 text-blue-800 border-blue-300";
  if (value.includes("12")) return "bg-amber-100 text-amber-800 border-amber-300";
  if (value.includes("14")) return "bg-orange-100 text-orange-800 border-orange-300";
  if (value.includes("16")) return "bg-red-100 text-red-800 border-red-300";
  if (value.includes("18")) return "bg-zinc-900 text-white border-zinc-900";
  return "bg-zinc-100 text-zinc-700 border-zinc-300";
};

const toLocalTodayIso = () => {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
};

const normalizeIsoDate = (value: string): string | null => {
  const v = value.trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
};

const getSortedDias = (filme: Cinema): string[] =>
  (filme.dias_exibicao || [])
    .map(normalizeIsoDate)
    .filter((d): d is string => !!d)
    .sort();

const toBrDate = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const CinemaHorizontalList = ({ cidadeSlug }: CinemaHorizontalListProps) => {
  const navigate = useNavigate();
  const [selectedFilme, setSelectedFilme] = useState<Cinema | null>(null);

  const { data: filmes = [], isLoading } = useQuery({
    queryKey: ["cinema-home", cidadeSlug],
    queryFn: async () => {
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return [];

      const { data, error } = await supabase
        .from("rel_cidade_cinema")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as Cinema[];
    },
    enabled: !!cidadeSlug,
  });

  const todayIso = toLocalTodayIso();
  const filmesEmCartazHoje = filmes
    .filter((f) => getSortedDias(f).includes(todayIso))
    .slice(0, 10);

  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : null;
  };

  if (isLoading) {
    return (
      <div className="px-5 py-4 space-y-3">
        <div className="h-5 w-40 bg-muted animate-pulse rounded-lg" />
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[120px] h-[180px] bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (filmesEmCartazHoje.length === 0) return null;

  const embedUrl = selectedFilme?.trailer_url
    ? getYouTubeEmbedUrl(selectedFilme.trailer_url)
    : null;
  const getEstreiaBr = (filme: Cinema): string | null => {
    if (filme.data_estreia) return toBrDate(filme.data_estreia);
    const dias = getSortedDias(filme);
    if (dias.length === 0) return null;
    return toBrDate(dias[0]);
  };

  return (
    <div className="py-6">
      {/* Header minimalista */}
      <div className="flex items-center justify-between px-5 mb-1">
        <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <Film className="h-4 w-4 text-primary" />
          Cinema
        </h2>
        <button
          onClick={() => {
            console.log(`[NAV] Cinema "Ver todos" clicado, scrollY atual: ${window.scrollY}`);
            window.scrollTo({ top: 0, behavior: "auto" });
            navigate(`/cidade/${cidadeSlug}`, { state: { tab: "cinema" } });
          }}
          className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
        >
          Ver todos
        </button>
      </div>
      <p className="text-[12px] text-muted-foreground/70 px-5 mb-3">
        Confira os filmes em cartaz na sua cidade
      </p>

      {/* Horizontal scroll */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-5 pb-2">
          {filmesEmCartazHoje.map((filme) => (
            <div
              key={filme.id}
              className="min-w-[140px] max-w-[140px] flex-shrink-0 cursor-pointer active:scale-[0.97] transition-transform"
              onClick={() => setSelectedFilme(filme)}
            >
              {/* Poster */}
              <div className="w-full aspect-[2/3] rounded-xl overflow-hidden bg-muted/30 relative group">
                {filme.banner_url ? (
                  <img
                    src={filme.banner_url}
                    alt={cleanText(filme.nome_filme)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-muted/20 to-muted/40 flex items-center justify-center">
                    <Play className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              {/* Title */}
              <p className="text-xs font-medium text-foreground mt-1.5 line-clamp-2 leading-tight">
                {cleanText(filme.nome_filme)}
              </p>
              {/* GÃªnero */}
              {filme.genero && (
                <div className="flex items-center gap-1 mt-1">
                  <Tag className="h-2.5 w-2.5 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground truncate">
                    {cleanText(filme.genero)}
                  </p>
                </div>
              )}
              {(filme.classificacao || getEstreiaBr(filme)) && (
                <div className="mt-1 flex items-center gap-1 flex-wrap">
                  {filme.classificacao ? (
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${getClassificacaoClasses(filme.classificacao)}`}>
                      {filme.classificacao}
                    </span>
                  ) : (
                    <span className="text-[9px] text-muted-foreground">Classificacao: n/i</span>
                  )}
                  {getEstreiaBr(filme) && (
                    <span className="text-[9px] text-muted-foreground">
                      Estreia: {getEstreiaBr(filme)}
                    </span>
                  )}
                </div>
              )}
              {/* Horarios */}
              {filme.horarios && filme.horarios.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <Clock className="h-2.5 w-2.5 text-primary/70 flex-shrink-0" />
                  <div className="flex gap-1 flex-wrap">
                    {filme.horarios.slice(0, 3).map((hora, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-600 text-white"
                      >
                        {hora}
                      </span>
                    ))}
                    {filme.horarios.length > 3 && (
                      <span className="text-[9px] text-muted-foreground">+{filme.horarios.length - 3}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal de detalhes do filme */}
      <Dialog open={!!selectedFilme} onOpenChange={(open) => !open && setSelectedFilme(null)}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg p-0 overflow-hidden rounded-[10px] max-h-[85vh] flex flex-col">
          {selectedFilme && (
            <div className="overflow-y-auto flex-1">
              {/* Banner do filme */}
              {selectedFilme.banner_url && (
                <div className="aspect-[2/3] max-h-[280px] w-full overflow-hidden">
                  <img
                    src={selectedFilme.banner_url}
                    alt={cleanText(selectedFilme.nome_filme)}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-4 space-y-3">
                <DialogHeader>
                  <DialogTitle className="text-lg leading-tight">
                    {cleanText(selectedFilme.nome_filme)}
                  </DialogTitle>
                </DialogHeader>

                {(selectedFilme.classificacao || getEstreiaBr(selectedFilme)) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedFilme.classificacao && (
                      <Badge variant="outline" className={`text-[11px] h-6 ${getClassificacaoClasses(selectedFilme.classificacao)}`}>
                        Classificacao: {selectedFilme.classificacao}
                      </Badge>
                    )}
                    {getEstreiaBr(selectedFilme) && (
                      <span className="text-xs text-muted-foreground">
                        Estreia: {getEstreiaBr(selectedFilme)}
                      </span>
                    )}
                  </div>
                )}

                {/* Genero e Duracao */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedFilme.genero && (
                    <Badge variant="outline" className="text-[11px] h-6 gap-1 bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700">
                      <Tag className="h-3 w-3" />
                      {cleanText(selectedFilme.genero)}
                    </Badge>
                  )}
                  {selectedFilme.duracao && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Timer className="h-3.5 w-3.5" />
                      {cleanText(selectedFilme.duracao)}
                    </span>
                  )}
                </div>

                {/* Sinopse */}
                {selectedFilme.sinopse && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cleanText(selectedFilme.sinopse)}
                  </p>
                )}

                {/* Horarios */}
                {selectedFilme.horarios && selectedFilme.horarios.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium text-foreground">Horarios</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedFilme.horarios.map((hora, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-medium px-3 py-1 rounded-full bg-red-600 text-white"
                        >
                          {hora}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trailer */}
                {embedUrl && (
                  <div className="pt-1">
                    <div className="aspect-video w-full rounded-xl overflow-hidden">
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CinemaHorizontalList;

