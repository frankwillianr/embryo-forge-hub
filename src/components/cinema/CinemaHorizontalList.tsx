import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Film, ChevronRight, Play, Clock, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Cinema } from "@/types/cinema";

interface CinemaHorizontalListProps {
  cidadeSlug?: string;
}

const CinemaHorizontalList = ({ cidadeSlug }: CinemaHorizontalListProps) => {
  const navigate = useNavigate();

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

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 mb-3">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-accent" />
          <h2 className="font-bold text-foreground text-base">Cinema</h2>
        </div>
        <button
          onClick={() => {
            navigate(`/cidade/${cidadeSlug}`, { state: { tab: "cinema" } });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex items-center gap-0.5 text-xs font-medium text-primary"
        >
          Ver todos
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Horizontal scroll */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-5 pb-2">
          {filmes.map((filme) => (
            <div
              key={filme.id}
              className="min-w-[140px] max-w-[140px] flex-shrink-0"
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
    </div>
  );
};

export default CinemaHorizontalList;
