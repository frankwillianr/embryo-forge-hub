import { useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CinemaCard from "./CinemaCard";
import type { Cinema } from "@/types/cinema";
import cinemaBanner from "@/assets/cinema-banner.jpg";

interface CinemaListProps {
  cidadeSlug?: string;
}

const CinemaList = ({ cidadeSlug }: CinemaListProps) => {
  const { data: filmes = [], isLoading } = useQuery({
    queryKey: ["cinema-list", cidadeSlug],
    queryFn: async () => {
      // Busca cidade pelo slug
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return [];

      // Busca filmes da cidade
      const { data, error } = await supabase
        .from("rel_cidade_cinema")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Cinema[];
    },
    enabled: !!cidadeSlug,
  });

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-28 h-40 bg-muted/50 animate-pulse rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-3/4 bg-muted/50 animate-pulse rounded" />
              <div className="h-3 w-1/2 bg-muted/50 animate-pulse rounded" />
              <div className="h-3 w-full bg-muted/50 animate-pulse rounded" />
              <div className="flex gap-1.5 mt-4">
                <div className="h-5 w-12 bg-muted/50 animate-pulse rounded-full" />
                <div className="h-5 w-12 bg-muted/50 animate-pulse rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (filmes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Film className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Nenhum filme em cartaz</p>
      </div>
    );
  }

  return (
    <div>
      {/* Banner Hero */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={cinemaBanner}
          alt="Cinema"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-xs text-muted-foreground">Em cartaz</p>
          <h2 className="text-lg font-bold text-foreground">Filmes da Semana</h2>
        </div>
      </div>

      {/* Lista de filmes */}
      <div className="px-4 py-4 space-y-5">
        {filmes.map((filme) => (
          <CinemaCard key={filme.id} cinema={filme} />
        ))}
      </div>
    </div>
  );
};

export default CinemaList;
