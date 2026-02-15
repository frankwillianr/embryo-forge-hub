import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import ofertasBanner from "@/assets/ofertas-banner.jpg";

const categoriasMeta: Record<string, { nome: string; icone: string }> = {
  entregador: { nome: "Entregador", icone: "🚴" },
  motorista: { nome: "Motorista", icone: "🚗" },
  mudancas: { nome: "Mudanças", icone: "🚚" },
  salao: { nome: "Salão", icone: "💇" },
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
  personal: { nome: "Personal", icone: "💪" },
  nutricionista: { nome: "Nutrição", icone: "🍎" },
  massagista: { nome: "Massagem", icone: "💆" },
  aulas: { nome: "Aulas", icone: "📚" },
  fotografo: { nome: "Fotógrafo", icone: "📸" },
  eventos: { nome: "Eventos", icone: "🎉" },
  costura: { nome: "Costura", icone: "🧵" },
};

const OfertasListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);

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

  // Buscar todas as ofertas
  const { data: ofertas, isLoading } = useQuery({
    queryKey: ["todas-ofertas", cidade?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome, categoria, banner_oferta_url, descricao")
        .eq("cidade_id", cidade!.id)
        .eq("status", "ativo")
        .not("banner_oferta_url", "is", null)
        .order("nome", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!cidade?.id,
  });

  // Categorias disponíveis (que têm ofertas)
  const categoriasDisponiveis = useMemo(() => {
    if (!ofertas) return [];
    const cats = [...new Set(ofertas.map((o) => o.categoria))];
    return cats.sort();
  }, [ofertas]);

  // Filtrar ofertas
  const ofertasFiltradas = useMemo(() => {
    if (!ofertas) return [];
    
    return ofertas.filter((oferta) => {
      const matchCategoria = !categoriaFiltro || oferta.categoria === categoriaFiltro;
      const matchSearch = !searchTerm || 
        oferta.nome.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCategoria && matchSearch;
    });
  }, [ofertas, categoriaFiltro, searchTerm]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/cidade/${slug}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">
          Ofertas da Cidade
        </h1>
      </header>

      {/* Banner Hero */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={ofertasBanner}
          alt="Ofertas"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-xs text-muted-foreground">Economize</p>
          <h2 className="text-lg font-bold text-foreground">Ofertas Imperdíveis</h2>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border bg-card/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ofertas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filtro de categorias */}
      <ScrollArea className="w-full border-b border-border">
        <div className="flex gap-2 p-4">
          <button
            onClick={() => setCategoriaFiltro(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              categoriaFiltro === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Todas
          </button>

          {categoriasDisponiveis.map((cat) => {
            const meta = categoriasMeta[cat] || { nome: cat, icone: "📦" };
            return (
              <button
                key={cat}
                onClick={() => setCategoriaFiltro(cat)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  categoriaFiltro === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <span>{meta.icone}</span>
                <span>{meta.nome}</span>
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Lista de ofertas */}
      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 rounded-2xl bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : ofertasFiltradas.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {ofertasFiltradas.map((oferta) => {
              const meta = categoriasMeta[oferta.categoria] || {
                nome: oferta.categoria,
                icone: "📦",
              };

              return (
                <button
                  key={oferta.id}
                  onClick={() =>
                    navigate(
                      `/cidade/${slug}/servicos/${oferta.categoria}/${oferta.id}`
                    )
                  }
                  className="flex flex-col rounded-2xl overflow-hidden bg-card border border-border/50 shadow-sm hover:shadow-lg transition-all active:scale-[0.97] text-left"
                >
                  {/* Imagem */}
                  <div className="relative aspect-[4/3] w-full">
                    <img
                      src={oferta.banner_oferta_url!}
                      alt={oferta.nome}
                      className="w-full h-full object-cover"
                    />
                    {/* Badge categoria */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-background/85 backdrop-blur-sm px-2 py-0.5 rounded-full">
                      <span className="text-xs">{meta.icone}</span>
                      <span className="text-[10px] font-medium text-foreground">{meta.nome}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2.5 flex-1">
                    <h3 className="text-[13px] font-semibold text-foreground line-clamp-2 leading-tight">
                      {oferta.nome}
                    </h3>
                    {oferta.descricao && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {oferta.descricao}
                      </p>
                    )}
                    <span className="inline-block mt-1.5 text-[10px] font-semibold text-primary">
                      Ver oferta →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-6xl mb-4">🔍</span>
            <h3 className="font-medium text-foreground mb-1">
              Nenhuma oferta encontrada
            </h3>
            <p className="text-sm text-muted-foreground">
              Tente buscar por outro termo ou categoria
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default OfertasListPage;
