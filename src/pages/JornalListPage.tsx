import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import JornalCard from "@/components/jornal/JornalCard";
import type { Jornal, JornalImagem } from "@/types/jornal";

const JornalListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: jornais = [], isLoading } = useQuery({
    queryKey: ["jornais-list", slug],
    queryFn: async () => {
      // Busca cidade
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return [];

      // Busca todas as notícias
      const { data: jornaisData, error: jornaisError } = await supabase
        .from("rel_cidade_jornal")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .order("created_at", { ascending: false });

      if (jornaisError) throw jornaisError;
      if (!jornaisData || jornaisData.length === 0) return [];

      // Busca imagens
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

  return (
    <div className="min-h-screen bg-background pb-4">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">📰 Jornal da Cidade</h1>
      </header>

      {/* Lista */}
      <div className="p-4">
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : jornais.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            Nenhuma notícia publicada ainda
          </div>
        ) : (
          <div className="grid gap-4">
            {jornais.map((jornal) => (
              <div key={jornal.id} className="w-full">
                <JornalCard jornal={jornal} cidadeSlug={slug} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JornalListPage;
