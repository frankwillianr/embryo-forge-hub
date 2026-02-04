import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Briefcase, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/cidade/${slug}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">
              Vagas de Emprego
            </h1>
            <p className="text-xs text-muted-foreground">{cidade?.nome}</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar vagas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 pb-24 space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))
        ) : filteredVagas && filteredVagas.length > 0 ? (
          filteredVagas.map((vaga) => (
            <VagaCard
              key={vaga.id}
              vaga={vaga}
              onClick={() => navigate(`/cidade/${slug}/vagas/${vaga.id}`)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Briefcase className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">
              Nenhuma vaga encontrada
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm
                ? "Tente buscar por outro termo"
                : "Seja o primeiro a publicar uma vaga!"}
            </p>
          </div>
        )}
      </main>

      {/* FAB - Add new job */}
      <Button
        onClick={() => navigate(`/cidade/${slug}/vagas/nova`)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default VagasListPage;
