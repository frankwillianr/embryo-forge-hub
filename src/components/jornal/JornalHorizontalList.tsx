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
      <div className="px-4 py-4">
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-72 h-48 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (jornais.length === 0) {
    return null;
  }

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-lg font-bold text-foreground">📰 Jornal da Cidade</h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary"
          onClick={() => navigate(`/cidade/${cidadeSlug}/jornal`)}
        >
          Ver tudo
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Scroll horizontal */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-4 pb-2">
          {jornais.map((jornal) => (
            <JornalCard key={jornal.id} jornal={jornal} cidadeSlug={cidadeSlug} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default JornalHorizontalList;
