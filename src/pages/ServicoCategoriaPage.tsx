import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Search, MapPin, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
const categoriasMeta: Record<string, { nome: string; icone: string }> = {
  entregador: { nome: "Entregador", icone: "🚴" },
  motorista: { nome: "Motorista", icone: "🚗" },
  mudancas: { nome: "Mudanças", icone: "🚚" },
  salao: { nome: "Salão de Beleza", icone: "💇" },
  manicure: { nome: "Manicure", icone: "💅" },
  barbeiro: { nome: "Barbeiro", icone: "✂️" },
  reparos: { nome: "Reparos", icone: "🔧" },
  eletricista: { nome: "Eletricista", icone: "⚡" },
  encanador: { nome: "Encanador", icone: "🔧" },
  pintor: { nome: "Pintor", icone: "🎨" },
  chaveiro: { nome: "Chaveiro", icone: "🔑" },
  vidraceiro: { nome: "Vidraceiro", icone: "🪟" },
  limpeza: { nome: "Limpeza", icone: "✨" },
  diarista: { nome: "Diarista", icone: "🏠" },
  dedetizacao: { nome: "Dedetização", icone: "🐛" },
  obras: { nome: "Obras", icone: "🏗️" },
  serralheria: { nome: "Serralheria", icone: "🔩" },
  marceneiro: { nome: "Marceneiro", icone: "🪑" },
  jardinagem: { nome: "Jardinagem", icone: "🌳" },
  pet: { nome: "Pet", icone: "🐕" },
  informatica: { nome: "Informática", icone: "💻" },
  "ar-condicionado": { nome: "Ar Condicionado", icone: "❄️" },
  personal: { nome: "Personal Trainer", icone: "💪" },
  nutricionista: { nome: "Nutricionista", icone: "🍎" },
  massagista: { nome: "Massagista", icone: "💆" },
  aulas: { nome: "Aulas Particulares", icone: "📚" },
  fotografo: { nome: "Fotógrafo", icone: "📸" },
  eventos: { nome: "Eventos", icone: "🎉" },
  costura: { nome: "Costura", icone: "🧵" },
};

const ServicoCategoriaPage = () => {
  const { slug, categoriaId } = useParams<{ slug: string; categoriaId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const handleAddEmpresa = () => {
    if (!user) {
      navigate(`/cidade/${slug}/auth?redirect=/cidade/${slug}/servicos/${categoriaId}/novo`);
      return;
    }
    navigate(`/cidade/${slug}/servicos/${categoriaId}/novo`);
  };

  const categoriaMeta = categoriasMeta[categoriaId || ""] || {
    nome: categoriaId,
    icone: "📦",
  };

  // Buscar cidade
  const { data: cidade } = useQuery({
    queryKey: ["cidade", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Buscar empresas da categoria
  const { data: empresas, isLoading } = useQuery({
    queryKey: ["servico-empresas", cidade?.id, categoriaId, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("rel_cidade_servico_empresa")
        .select(`
          *,
          fotos:rel_cidade_servico_empresa_foto(id, url, ordem)
        `)
        .eq("cidade_id", cidade!.id)
        .eq("categoria", categoriaId)
        .eq("status", "ativo")
        .order("nome", { ascending: true });

      if (searchTerm) {
        query = query.ilike("nome", `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!cidade?.id && !!categoriaId,
  });

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/cidade/${slug}/servicos`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">
            {categoriaMeta.icone} {categoriaMeta.nome}
          </h1>
        </div>
        <Button
          size="sm"
          onClick={handleAddEmpresa}
          className="gap-1.5 bg-[#331D4A] hover:bg-[#331D4A]/90 text-white rounded-xl"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </header>

      {/* Search */}
      <div className="p-4 border-b border-border bg-card/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Buscar em ${categoriaMeta.nome}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Lista */}
      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-xl bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : empresas && empresas.length > 0 ? (
          <div className="space-y-4">
            {empresas.map((empresa) => {
              const primeiraFoto = empresa.fotos?.sort(
                (a, b) => a.ordem - b.ordem
              )[0];

              return (
                <button
                  key={empresa.id}
                  onClick={() =>
                    navigate(`/cidade/${slug}/servicos/${categoriaId}/${empresa.id}`)
                  }
                  className="w-full bg-card rounded-xl border border-border overflow-hidden text-left transition-shadow hover:shadow-md"
                >
                  <div className="flex">
                    {/* Foto */}
                    <div className="w-28 h-28 flex-shrink-0 bg-muted">
                      {primeiraFoto ? (
                        <img
                          src={primeiraFoto.url}
                          alt={empresa.nome}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">
                          {categoriaMeta.icone}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-3 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {empresa.nome}
                      </h3>

                      {empresa.endereco_bairro && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {empresa.endereco_bairro}
                        </p>
                      )}

                      {empresa.descricao && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {empresa.descricao}
                        </p>
                      )}

                      <div className="flex items-center gap-1 mt-2">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">5.0</span>
                        <span className="text-xs text-muted-foreground">(novo)</span>
                      </div>
                    </div>
                  </div>

                  {/* Banner de oferta */}
                  {empresa.banner_oferta_url && (
                    <div className="border-t border-border">
                      <img
                        src={empresa.banner_oferta_url}
                        alt="Oferta"
                        className="w-full h-16 object-cover"
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-6xl mb-4">{categoriaMeta.icone}</div>
            <h3 className="font-medium text-foreground mb-1">
              Nenhuma empresa cadastrada
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Seja o primeiro a anunciar!
            </p>
            <Button
              onClick={handleAddEmpresa}
              className="gap-2 bg-[#331D4A] hover:bg-[#331D4A]/90 text-white rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Adicionar minha empresa
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default ServicoCategoriaPage;
