import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Film, Play, Clock, Tag, Timer, MapPin } from "lucide-react";
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
        .eq("status", "em_cartaz")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as Cinema[];
    },
    enabled: !!cidadeSlug,
  });

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

  if (filmes.length === 0) return null;

  const embedUrl = selectedFilme?.trailer_url
    ? getYouTubeEmbedUrl(selectedFilme.trailer_url)
    : null;

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
            window.scrollTo({ top: 0, behavior: "smooth" });
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
          {filmes.map((filme) => (
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
                    alt={filme.nome_filme}
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
                {filme.nome_filme}
              </p>
              {/* Gênero */}
              {filme.genero && (
                <div className="flex items-center gap-1 mt-1">
                  <Tag className="h-2.5 w-2.5 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground truncate">
                    {filme.genero}
                  </p>
                </div>
              )}
              {/* Horários */}
              {filme.horarios && filme.horarios.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <Clock className="h-2.5 w-2.5 text-primary/70 flex-shrink-0" />
                  <div className="flex gap-1 flex-wrap">
                    {filme.horarios.slice(0, 3).map((hora, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
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
                    alt={selectedFilme.nome_filme}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-4 space-y-3">
                <DialogHeader>
                  <DialogTitle className="text-lg leading-tight">
                    {selectedFilme.nome_filme}
                  </DialogTitle>
                </DialogHeader>

                {/* Cinema */}
                {selectedFilme.nome_cinema && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {selectedFilme.nome_cinema}
                  </div>
                )}

                {/* Gênero e Duração */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedFilme.genero && (
                    <Badge variant="secondary" className="text-[11px] h-6 gap-1">
                      <Tag className="h-3 w-3" />
                      {selectedFilme.genero}
                    </Badge>
                  )}
                  {selectedFilme.duracao && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Timer className="h-3.5 w-3.5" />
                      {selectedFilme.duracao}
                    </span>
                  )}
                </div>

                {/* Sinopse */}
                {selectedFilme.sinopse && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedFilme.sinopse}
                  </p>
                )}

                {/* Horários */}
                {selectedFilme.horarios && selectedFilme.horarios.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium text-foreground">Horários</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedFilme.horarios.map((hora, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary"
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
