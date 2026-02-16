import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { type Jornal, parseImagens } from "@/types/jornal";
import JornalFeedCard from "@/components/jornal/JornalFeedCard";

const JornalListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: jornais = [], isLoading } = useQuery({
    queryKey: ["jornais-list", slug],
    queryFn: async () => {
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return [];

      const { data: jornaisData, error: jornaisError } = await supabase
        .from("rel_cidade_jornal")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .not("titulo", "like", "%{{%")
        .order("created_at", { ascending: false });

      if (jornaisError) throw jornaisError;
      if (!jornaisData || jornaisData.length === 0) return [];

      return jornaisData.map((j) => ({
        ...j,
        imagens: parseImagens(j.imagens),
      })) as Jornal[];
    },
    enabled: !!slug,
  });

  // Scroll automático até a notícia quando há hash na URL
  useEffect(() => {
    if (!isLoading && location.hash) {
      const jornalId = location.hash.substring(1); // Remove o #
      const element = document.getElementById(`jornal-${jornalId}`);

      if (element) {
        // Aguarda um momento para garantir que o DOM está pronto
        setTimeout(() => {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          // Remove o hash da URL sem recarregar a página
          window.history.replaceState(null, '', location.pathname);
        }, 100);
      }
    }
  }, [isLoading, location.hash, location.pathname]);

  return (
    <div className="min-h-screen bg-background pb-4">
      {/* Header estilo Instagram */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">Jornal da cidade</h1>
      </header>

      {/* Feed estilo Instagram */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-b border-border/50">
              <div className="px-3 py-2.5 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-muted/50 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 bg-muted/50 animate-pulse rounded" />
                  <div className="h-2 w-20 bg-muted/50 animate-pulse rounded" />
                </div>
              </div>
              <div className="aspect-square w-full bg-muted/50 animate-pulse" />
              <div className="px-3 py-3 space-y-2">
                <div className="h-3 w-full bg-muted/50 animate-pulse rounded" />
                <div className="h-3 w-3/4 bg-muted/50 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : jornais.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm">
          Nenhuma notícia publicada ainda
        </div>
      ) : (
        <div>
          {jornais.map((jornal) => (
            <JornalFeedCard key={jornal.id} jornal={jornal} cidadeSlug={slug} />
          ))}
        </div>
      )}
    </div>
  );
};

export default JornalListPage;
