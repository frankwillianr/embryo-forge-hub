import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bus, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OnibusHorizontalListProps {
  cidadeSlug?: string;
}

const OnibusHorizontalList = ({ cidadeSlug }: OnibusHorizontalListProps) => {
  const navigate = useNavigate();

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["onibus-home", cidadeSlug],
    queryFn: async () => {
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return [];

      const { data, error } = await supabase
        .from("rel_cidade_onibus")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .order("numero_linha", { ascending: true })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!cidadeSlug,
  });

  if (isLoading) {
    return (
      <div className="px-5 py-4 space-y-3">
        <div className="h-5 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[140px] h-[90px] bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (linhas.length === 0) return null;

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 mb-3">
        <div className="flex items-center gap-2">
          <Bus className="h-5 w-5 text-accent" />
          <h2 className="font-bold text-foreground text-base">Horários de Ônibus</h2>
        </div>
        <button
          onClick={() => {
            navigate(`/cidade/${cidadeSlug}/onibus`);
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
          {linhas.map((linha: any) => (
            <button
              key={linha.id}
              onClick={() => {
                navigate(`/cidade/${cidadeSlug}/onibus`);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="min-w-[150px] max-w-[150px] flex-shrink-0 bg-card border border-border rounded-2xl p-3 text-left hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {linha.numero_linha}
                </span>
              </div>
              <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">
                {linha.nome_linha}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OnibusHorizontalList;
