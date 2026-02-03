import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import JornalCard from "@/components/jornal/JornalCard";
import type { Jornal, JornalImagem } from "@/types/jornal";

const JornalSection = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: jornais = [], isLoading } = useQuery({
    queryKey: ["jornais-section", slug],
    queryFn: async () => {
      const { data: cidadeData } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", slug)
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
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />
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
    <div className="p-4 space-y-4">
      {jornais.map((jornal) => (
        <div key={jornal.id} className="w-full">
          <JornalCard jornal={jornal} cidadeSlug={slug} />
        </div>
      ))}
    </div>
  );
};

export default JornalSection;
