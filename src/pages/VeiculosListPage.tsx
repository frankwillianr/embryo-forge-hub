import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fipeApi } from "@/services/fipeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import VeiculoCard from "@/components/veiculos/VeiculoCard";

const combustivelOptions = [
  { value: "gasolina", label: "Gasolina" },
  { value: "etanol", label: "Etanol" },
  { value: "flex", label: "Flex" },
  { value: "diesel", label: "Diesel" },
  { value: "eletrico", label: "Elétrico" },
  { value: "hibrido", label: "Híbrido" },
];

const condicaoOptions = [
  { value: "novo", label: "Novo" },
  { value: "seminovo", label: "Seminovo" },
  { value: "usado", label: "Usado" },
];

const quickFilterOptions = [
  { id: "todos", label: "Todos", field: "none" as const },
  { id: "novo", label: "Novo", field: "condicao" as const },
  { id: "seminovo", label: "Seminovo", field: "condicao" as const },
  { id: "usado", label: "Usado", field: "condicao" as const },
  { id: "flex", label: "Flex", field: "combustivel" as const },
  { id: "gasolina", label: "Gasolina", field: "combustivel" as const },
  { id: "diesel", label: "Diesel", field: "combustivel" as const },
  { id: "eletrico", label: "Elétrico", field: "combustivel" as const },
  { id: "hibrido", label: "Híbrido", field: "combustivel" as const },
];

const VeiculosListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filtros
  const [marcaId, setMarcaId] = useState<string>("");
  const [modeloId, setModeloId] = useState<string>("");
  const [versaoId, setVersaoId] = useState<string>("");
  const [combustivel, setCombustivel] = useState<string>("");
  const [condicao, setCondicao] = useState<string>("");
  const [precoRange, setPrecoRange] = useState<number[]>([0, 500000]);
  const [kmRange, setKmRange] = useState<number[]>([0, 200000]);

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

  // Buscar marcas da API FIPE
  const { data: marcas } = useQuery({
    queryKey: ["fipe-marcas"],
    queryFn: () => fipeApi.getMarcas(),
    staleTime: 1000 * 60 * 60 * 24, // 24 horas
  });

  // Buscar modelos da marca selecionada
  const { data: modelosData } = useQuery({
    queryKey: ["fipe-modelos", marcaId],
    queryFn: () => fipeApi.getModelos(marcaId),
    enabled: !!marcaId,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const modelos = modelosData?.modelos || [];

  // Buscar versões (anos) do modelo selecionado
  const { data: versoes } = useQuery({
    queryKey: ["fipe-versoes", marcaId, modeloId],
    queryFn: () => fipeApi.getAnos(marcaId, Number(modeloId)),
    enabled: !!marcaId && !!modeloId,
    staleTime: 1000 * 60 * 60 * 24,
  });

  // Buscar veículos
  const { data: veiculos, isLoading } = useQuery({
    queryKey: [
      "veiculos",
      cidade?.id,
      marcaId,
      modeloId,
      versaoId,
      combustivel,
      condicao,
      precoRange,
      kmRange,
      searchTerm,
    ],
    queryFn: async () => {
      let query = supabase
        .from("rel_cidade_veiculos")
        .select(`
          *,
          imagens:rel_cidade_veiculos_imagens(imagem_url, ordem)
        `)
        .eq("cidade_id", cidade!.id)
        .eq("status", "ativo")
        .gte("data_expiracao", new Date().toISOString())
        .gte("preco", precoRange[0])
        .lte("preco", precoRange[1])
        .gte("quilometragem", kmRange[0])
        .lte("quilometragem", kmRange[1]);

      if (marcaId) query = query.eq("fipe_marca_codigo", marcaId);
      if (modeloId) query = query.eq("fipe_modelo_codigo", modeloId);
      if (versaoId) query = query.eq("fipe_versao_codigo", versaoId);
      if (combustivel) query = query.eq("combustivel", combustivel);
      if (condicao) query = query.eq("condicao", condicao);
      if (searchTerm) query = query.ilike("titulo", `%${searchTerm}%`);

      const { data, error } = await query;
      if (error) throw error;

      // Embaralhar aleatoriamente
      return data?.sort(() => Math.random() - 0.5) || [];
    },
    enabled: !!cidade?.id,
  });

  const clearFilters = () => {
    setMarcaId("");
    setModeloId("");
    setVersaoId("");
    setCombustivel("");
    setCondicao("");
    setPrecoRange([0, 500000]);
    setKmRange([0, 200000]);
  };

  const applyQuickFilter = (filterId: string) => {
    if (filterId === "todos") {
      setCondicao("");
      setCombustivel("");
      return;
    }

    const option = quickFilterOptions.find((item) => item.id === filterId);
    if (!option) return;

    if (option.field === "condicao") {
      setCondicao(filterId);
      setCombustivel("");
      return;
    }

    if (option.field === "combustivel") {
      setCombustivel(filterId);
      setCondicao("");
    }
  };

  const activeQuickFilter =
    quickFilterOptions.some((item) => item.id === condicao)
      ? condicao
      : quickFilterOptions.some((item) => item.id === combustivel)
        ? combustivel
        : "todos";

  const activeFiltersCount = [
    marcaId,
    modeloId,
    versaoId,
    combustivel,
    condicao,
    precoRange[0] > 0 || precoRange[1] < 500000,
    kmRange[0] > 0 || kmRange[1] < 200000,
  ].filter(Boolean).length;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatKm = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value) + " km";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground flex-1">
          Veículos
        </h1>
        <Button
          variant="ghost"
          onClick={() => navigate(`/cidade/${slug}/veiculos/novo`)}
          size="sm"
          className="btn-solar-soft gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Anunciar
        </Button>
      </header>

      {/* Search & Filter Bar */}
      <div className="p-4 border-b border-border bg-card/50">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar veículo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh]">
              <SheetHeader className="flex-row items-center justify-between">
                <SheetTitle>Filtros</SheetTitle>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar
                </Button>
              </SheetHeader>

              <div className="mt-6 space-y-6 overflow-y-auto max-h-[calc(85vh-120px)]">
                {/* Marca */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Marca</label>
                  <Select value={marcaId} onValueChange={(v) => {
                    setMarcaId(v);
                    setModeloId("");
                    setVersaoId("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as marcas" />
                    </SelectTrigger>
                    <SelectContent>
                      {marcas?.map((marca) => (
                        <SelectItem key={marca.codigo} value={marca.codigo}>
                          {marca.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Modelo */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Modelo</label>
                  <Select
                    value={modeloId}
                    onValueChange={(v) => {
                      setModeloId(v);
                      setVersaoId("");
                    }}
                    disabled={!marcaId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={marcaId ? "Todos os modelos" : "Selecione uma marca"} />
                    </SelectTrigger>
                    <SelectContent>
                      {modelos?.map((modelo) => (
                        <SelectItem key={modelo.codigo} value={modelo.codigo.toString()}>
                          {modelo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Versão (Ano) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Versão / Ano</label>
                  <Select
                    value={versaoId}
                    onValueChange={setVersaoId}
                    disabled={!modeloId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={modeloId ? "Todas as versões" : "Selecione um modelo"} />
                    </SelectTrigger>
                    <SelectContent>
                      {versoes?.map((versao) => (
                        <SelectItem key={versao.codigo} value={versao.codigo}>
                          {versao.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Combustível */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Combustível</label>
                  <Select value={combustivel} onValueChange={setCombustivel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      {combustivelOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Condição */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Condição</label>
                  <Select value={condicao} onValueChange={setCondicao}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      {condicaoOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Faixa de Preço */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">Faixa de Preço</label>
                    <span className="text-xs text-muted-foreground">
                      {formatPrice(precoRange[0])} - {formatPrice(precoRange[1])}
                    </span>
                  </div>
                  <Slider
                    value={precoRange}
                    onValueChange={setPrecoRange}
                    min={0}
                    max={500000}
                    step={5000}
                    className="py-2"
                  />
                </div>

                {/* Quilometragem */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">Quilometragem</label>
                    <span className="text-xs text-muted-foreground">
                      {formatKm(kmRange[0])} - {formatKm(kmRange[1])}
                    </span>
                  </div>
                  <Slider
                    value={kmRange}
                    onValueChange={setKmRange}
                    min={0}
                    max={200000}
                    step={5000}
                    className="py-2"
                  />
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
                <Button
                  className="w-full"
                  onClick={() => setFiltersOpen(false)}
                >
                  Ver {veiculos?.length || 0} veículos
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mt-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 min-w-max pb-1">
            {quickFilterOptions.map((filter) => {
              const isActive = activeQuickFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => applyQuickFilter(filter.id)}
                  className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lista de Veículos */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 bg-muted animate-pulse rounded-xl"
              />
            ))}
          </div>
        ) : veiculos && veiculos.length > 0 ? (
          <div className="space-y-4">
            {veiculos.map((veiculo) => (
              <VeiculoCard
                key={veiculo.id}
                veiculo={veiculo}
                onClick={() => navigate(`/cidade/${slug}/veiculos/${veiculo.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum veículo encontrado</p>
            <Button
              variant="ghost"
              className="btn-solar-soft mt-4"
              onClick={() => navigate(`/cidade/${slug}/veiculos/novo`)}
            >
              Seja o primeiro a anunciar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VeiculosListPage;
