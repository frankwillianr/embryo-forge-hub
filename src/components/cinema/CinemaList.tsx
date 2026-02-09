import { useState } from "react";
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
  const [activeTab, setActiveTab] = useState<"em_cartaz" | "em_breve">("em_cartaz");

  const { data: filmes = [], isLoading } = useQuery({
    queryKey: ["cinema-list", cidadeSlug],
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
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Cinema[];
    },
    enabled: !!cidadeSlug,
  });

  const filteredFilmes = filmes.filter((f) => f.status === activeTab);

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
          <p className="text-xs text-muted-foreground">Cinema</p>
          <h2 className="text-lg font-bold text-foreground">Filmes da Semana</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-4">
        <button
          onClick={() => setActiveTab("em_cartaz")}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
            activeTab === "em_cartaz"
              ? "text-primary"
              : "text-muted-foreground"
          }`}
        >
          Em Cartaz
          {activeTab === "em_cartaz" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("em_breve")}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
            activeTab === "em_breve"
              ? "text-primary"
              : "text-muted-foreground"
          }`}
        >
          Em Breve
          {activeTab === "em_breve" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {/* Lista de filmes */}
      {filteredFilmes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Film className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">
            {activeTab === "em_cartaz"
              ? "Nenhum filme em cartaz"
              : "Nenhum filme em breve"}
          </p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-5">
          {filteredFilmes.map((filme) => (
            <CinemaCard
              key={filme.id}
              cinema={filme}
              showHorarios={activeTab === "em_cartaz"}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CinemaList;
