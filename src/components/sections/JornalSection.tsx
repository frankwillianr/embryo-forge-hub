import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import JornalFeedCard from "@/components/jornal/JornalFeedCard";
import type { Jornal, JornalImagem } from "@/types/jornal";

interface JornalSectionProps {
  cidadeSlug?: string;
}

const JornalSection = ({ cidadeSlug }: JornalSectionProps) => {
  const { data: jornais = [], isLoading } = useQuery({
    queryKey: ["jornais-section", cidadeSlug],
    queryFn: async () => {
      const { data: cidadeData } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();

      if (!cidadeData) return [];

      const { data: jornaisData } = await supabase
        .from("rel_cidade_jornal")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .order("created_at", { ascending: false });

      if (!jornaisData || jornaisData.length === 0) return [];

      const jornalIds = jornaisData.map((j) => j.id);
      const { data: imagensData } = await supabase
        .from("rel_cidade_jornal_imagens")
        .select("*")
        .in("jornal_id", jornalIds)
        .order("ordem");

      const imagensPorJornal = (imagensData || []).reduce((acc, img) => {
        if (!acc[img.jornal_id]) acc[img.jornal_id] = [];
        acc[img.jornal_id].push(img as JornalImagem);
        return acc;
      }, {} as Record<string, JornalImagem[]>);

      return jornaisData.map((j) => ({
        ...j,
        imagens: imagensPorJornal[j.id] || [],
      })) as Jornal[];
    },
    enabled: !!cidadeSlug,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="aspect-square bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (jornais.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground py-12">
        Nenhuma notícia publicada ainda
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {jornais.map((jornal) => (
        <JornalFeedCard key={jornal.id} jornal={jornal} cidadeSlug={cidadeSlug} />
      ))}
    </div>
  );
};

export default JornalSection;
