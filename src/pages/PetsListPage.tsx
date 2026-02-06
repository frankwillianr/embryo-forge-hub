import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PawPrint, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PetCard from "@/components/pets/PetCard";
import type { Pet, PetStatus } from "@/types/pets";
import petsBanner from "@/assets/pets-banner.jpg";

const PetsListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PetStatus | "todos">("todos");

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

  // Fetch pets
  const { data: pets, isLoading } = useQuery({
    queryKey: ["pets", cidade?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_pets")
        .select("*")
        .eq("cidade_id", cidade?.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Pet[];
    },
    enabled: !!cidade?.id,
  });

  const filteredPets = pets?.filter((pet) => {
    const matchesSearch =
      pet.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pet.local_visto.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todos" || pet.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background pb-4">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">Pets Perdidos</h1>
      </header>

      {/* Banner Hero */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={petsBanner}
          alt="Pets Perdidos"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-xs text-muted-foreground">Ajude a encontrar</p>
          <h2 className="text-lg font-bold text-foreground">Pets Perdidos</h2>
        </div>
      </div>

      {/* Search + Add Button */}
      <div className="px-4 py-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou local..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={() => navigate(`/cidade/${slug}/pets/novo`)}
          className="bg-primary hover:bg-primary/90"
        >
          Anunciar
        </Button>
      </div>

      {/* Filtros */}
      <div className="px-4 pb-3">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as PetStatus | "todos")}>
          <TabsList className="w-full">
            <TabsTrigger value="todos" className="flex-1">Todos</TabsTrigger>
            <TabsTrigger value="perdido" className="flex-1">Perdidos</TabsTrigger>
            <TabsTrigger value="encontrado" className="flex-1">Encontrados</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Lista */}
      <div className="px-4 py-2">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : filteredPets && filteredPets.length > 0 ? (
          <div className="space-y-3">
            {filteredPets.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                onClick={() => navigate(`/cidade/${slug}/pets/${pet.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <PawPrint className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">
              Nenhum pet encontrado
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm
                ? "Tente buscar por outro termo"
                : "Cadastre um pet perdido ou encontrado"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PetsListPage;
