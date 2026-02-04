import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VagaCard from "@/components/vagas/VagaCard";
import { Vaga } from "@/types/vagas";
import vagasBanner from "@/assets/vagas-banner.jpg";

const VagasListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch cidade
  const { data: cidade } = useQuery({
    queryKey: ["cidade", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch vagas
  const { data: vagas, isLoading } = useQuery({
    queryKey: ["vagas", cidade?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vagas")
        .select("*")
        .eq("cidade_id", cidade?.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Vaga[];
    },
    enabled: !!cidade?.id,
  });

  const filteredVagas = vagas?.filter(
    (vaga) =>
      vaga.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vaga.empresa.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8" 
          onClick={() => navigate(`/cidade/${slug}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">Vagas de Emprego</h1>
      </header>

      {/* Banner Hero */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={vagasBanner}
          alt="Vagas de Emprego"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-xs text-muted-foreground">Oportunidades</p>
          <h2 className="text-lg font-bold text-foreground">Vagas de Emprego</h2>
        </div>
      </div>

      {/* Search + Button */}
      <div className="px-4 py-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Buscar cargo ou empresa"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
        <Button
          onClick={() => navigate(`/cidade/${slug}/vagas/nova`)}
          className="rounded-xl"
        >
          Anunciar
        </Button>
      </div>

      {/* Content */}
      <div className="px-4 pb-8">
        {isLoading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted/30 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : filteredVagas && filteredVagas.length > 0 ? (
          <div>
            {filteredVagas.map((vaga) => (
              <VagaCard
                key={vaga.id}
                vaga={vaga}
                onClick={() => navigate(`/cidade/${slug}/vagas/${vaga.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[15px] text-muted-foreground">
              {searchTerm ? "Nenhum resultado" : "Nenhuma vaga disponível"}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate(`/cidade/${slug}/vagas/nova`)}
                className="mt-3 text-[15px] text-primary font-medium"
              >
                Publicar vaga
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VagasListPage;
