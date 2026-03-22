import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import JornalCard from "./JornalCard";
import { type Jornal, parseImagens } from "@/types/jornal";

interface JornalHorizontalListProps {
  cidadeSlug?: string;
}

const JornalHorizontalList = ({ cidadeSlug }: JornalHorizontalListProps) => {
  const navigate = useNavigate();

  const { data: jornais = [], isLoading } = useQuery({
    queryKey: ["jornais-home", cidadeSlug],
    queryFn: async () => {
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return [];

      const { data: jornaisData, error: jornaisError } = await supabase
        .from("rel_cidade_jornal")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .eq("ativo", true)
        .not("titulo", "like", "%{{%")
        .order("data_noticia", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(15);

      if (jornaisError) throw jornaisError;
      if (!jornaisData || jornaisData.length === 0) return [];

      return jornaisData.map((j) => ({
        ...j,
        imagens: parseImagens(j.imagens),
      })) as Jornal[];
    },
    enabled: !!cidadeSlug,
  });

  if (isLoading) {
    return (
      <div className="py-6 px-5">
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-64 space-y-3">
              <div className="aspect-[4/3] bg-muted/50 animate-pulse rounded-2xl" />
              <div className="space-y-2">
                <div className="h-2 w-16 bg-muted/50 animate-pulse rounded" />
                <div className="h-4 w-full bg-muted/50 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (jornais.length === 0) {
    return null;
  }

  return (
    <div className="py-6">
      {/* Header minimalista */}
      <div className="flex items-center justify-between px-5 mb-1">
        <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <Newspaper className="h-4 w-4 text-primary" />
          Jornal da cidade
        </h2>
        <button
          onClick={() => {
            console.log(`[NAV] Jornal "Ver todas" clicado, scrollY atual: ${window.scrollY}`);
            window.scrollTo({ top: 0, behavior: "auto" });
            navigate(`/cidade/${cidadeSlug}/jornal`, { state: { scrollToTop: true } });
          }}
          className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
        >
          Ver todas
        </button>
      </div>
      <p className="text-[12px] text-muted-foreground/70 px-5 mb-3">
        Fique por dentro das últimas notícias da cidade
      </p>

      {/* Scroll horizontal */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-4 px-5 pb-2">
          {jornais.map((jornal) => (
            <JornalCard key={jornal.id} jornal={jornal} cidadeSlug={cidadeSlug} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default JornalHorizontalList;
