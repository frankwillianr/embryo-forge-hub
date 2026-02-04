import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VagaCard from "@/components/vagas/VagaCard";
import { Vaga } from "@/types/vagas";

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
      {/* Header minimalista */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center justify-between px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-full"
            onClick={() => navigate(`/cidade/${slug}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-[17px] font-semibold tracking-tight">Vagas</h1>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-full"
            onClick={() => navigate(`/cidade/${slug}/vagas/nova`)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Buscar cargo ou empresa"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-2 pb-8">
        {isLoading ? (
          <div className="space-y-3 pt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted/30 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : filteredVagas && filteredVagas.length > 0 ? (
          <div className="space-y-2">
            {filteredVagas.map((vaga) => (
              <VagaCard
                key={vaga.id}
                vaga={vaga}
                onClick={() => navigate(`/cidade/${slug}/vagas/${vaga.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
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
