import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import JornalCard from "./JornalCard";
import type { Jornal, JornalImagem } from "@/types/jornal";

interface JornalHorizontalListProps {
  cidadeSlug?: string;
}

const JornalHorizontalList = ({ cidadeSlug }: JornalHorizontalListProps) => {
  const navigate = useNavigate();

  const { data: jornais = [], isLoading } = useQuery({
    queryKey: ["jornais-home", cidadeSlug],
    queryFn: async () => {
      // Busca cidade pelo slug
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return [];

      // Busca notícias da cidade
      const { data: jornaisData, error: jornaisError } = await supabase
        .from("rel_cidade_jornal")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (jornaisError) throw jornaisError;
      if (!jornaisData || jornaisData.length === 0) return [];

      // Busca imagens para cada notícia
      const jornalIds = jornaisData.map((j) => j.id);
      const { data: imagensData, error: imagensError } = await supabase
        .from("rel_cidade_jornal_imagens")
        .select("*")
        .in("jornal_id", jornalIds)
        .order("ordem");

      if (imagensError) throw imagensError;

      // Agrupa imagens por jornal
      const imagensPorJornal = (imagensData || []).reduce((acc, img) => {
        if (!acc[img.jornal_id]) acc[img.jornal_id] = [];
        acc[img.jornal_id].push(img as JornalImagem);
        return acc;
      }, {} as Record<string, JornalImagem[]>);

      // Monta resultado final
      return jornaisData.map((j) => ({
        ...j,
        imagens: imagensPorJornal[j.id] || [],
      })) as Jornal[];
    },
    enabled: !!cidadeSlug,
  });

  if (isLoading) {
    return (
      <div className="px-5 py-6">
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
      <div className="flex items-center justify-between px-5 mb-3">
        <h2 className="text-base font-semibold text-foreground tracking-tight">Notícias</h2>
        <button
          onClick={() => navigate(`/cidade/${cidadeSlug}/jornal`)}
          className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
        >
          Ver todas
        </button>
      </div>

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
