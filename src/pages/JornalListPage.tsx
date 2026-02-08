import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Jornal, JornalImagem } from "@/types/jornal";
import jornalBanner from "@/assets/jornal-banner.jpg";

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
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">Jornal da Cidade</h1>
      </header>

      {/* Banner Hero */}
      <div className="relative h-[175px] overflow-hidden">
        <img
          src={jornalBanner}
          alt="Jornal"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-xs text-muted-foreground">Fique por dentro</p>
          <h2 className="text-lg font-bold text-foreground">Últimas Notícias</h2>
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-24 h-20 bg-muted/50 animate-pulse rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-2 w-16 bg-muted/50 animate-pulse rounded" />
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
          <div className="space-y-4">
            {jornais.map((jornal) => {
              const primeiraImagem = jornal.imagens?.[0]?.imagem_url;
              const dataPublicacao = new Date(jornal.created_at);
              const hora = dataPublicacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              const data = dataPublicacao.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
              
              return (
                <div
                  key={jornal.id}
                  onClick={() => navigate(`/cidade/${slug}/jornal/${jornal.id}`)}
                  className="flex gap-3 cursor-pointer group"
                >
                  {/* Thumbnail */}
                  <div className="w-24 h-20 rounded-xl overflow-hidden bg-muted/30 flex-shrink-0">
                    {primeiraImagem ? (
                      <img
                        src={primeiraImagem}
                        alt={jornal.titulo}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted/20 to-muted/40" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">
                      {data} às {hora}
                      {jornal.fonte && <span className="ml-1.5">· {jornal.fonte}</span>}
                    </p>
                    <h3 className="text-[13px] font-medium text-foreground line-clamp-2 leading-tight tracking-tight">
                      {jornal.titulo}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default JornalListPage;
