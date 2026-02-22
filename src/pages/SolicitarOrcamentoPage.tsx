import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, FileText, ChevronsUpDown, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const CATEGORIAS_ORCAMENTO_RAW: { id: string; nome: string; emoji: string }[] = [
  { id: "eletricista", nome: "Eletricista", emoji: "⚡" },
  { id: "encanador", nome: "Encanador", emoji: "🚿" },
  { id: "pintor", nome: "Pintor", emoji: "🎨" },
  { id: "reparos", nome: "Reparos em geral", emoji: "🔧" },
  { id: "obras", nome: "Obras / Reformas", emoji: "🏗️" },
  { id: "limpeza", nome: "Limpeza", emoji: "✨" },
  { id: "diarista", nome: "Diarista", emoji: "🏠" },
  { id: "dedetizacao", nome: "Dedetização", emoji: "🐛" },
  { id: "chaveiro", nome: "Chaveiro", emoji: "🔑" },
  { id: "marceneiro", nome: "Marceneiro", emoji: "🪑" },
  { id: "serralheria", nome: "Serralheria", emoji: "🔩" },
  { id: "vidraceiro", nome: "Vidraceiro", emoji: "🪟" },
  { id: "ar-condicionado", nome: "Ar condicionado", emoji: "❄️" },
  { id: "jardinagem", nome: "Jardinagem", emoji: "🌳" },
  { id: "mudancas", nome: "Mudanças", emoji: "🚚" },
  { id: "salao", nome: "Salão de beleza", emoji: "💇" },
  { id: "barbeiro", nome: "Barbeiro", emoji: "✂️" },
  { id: "manicure", nome: "Manicure", emoji: "💅" },
  { id: "dentista", nome: "Dentista", emoji: "🦷" },
  { id: "veterinario", nome: "Veterinário", emoji: "🐕" },
  { id: "mecanico", nome: "Mecânico", emoji: "🔧" },
  { id: "lava-jato", nome: "Lava jato", emoji: "🚿" },
  { id: "advogado", nome: "Advogado", emoji: "⚖️" },
  { id: "contador", nome: "Contador", emoji: "📊" },
  { id: "fotografo", nome: "Fotógrafo", emoji: "📸" },
  { id: "eventos", nome: "Eventos / Festas", emoji: "🎉" },
  { id: "outros", nome: "Outros", emoji: "📦" },
];

const CATEGORIAS_ORCAMENTO = [...CATEGORIAS_ORCAMENTO_RAW].sort((a, b) =>
  a.nome.localeCompare(b.nome, "pt-BR")
);

const SolicitarOrcamentoPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const nomeCensurado = (() => {
    const n = profile?.nome?.trim();
    if (!n) return "Anônimo";
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return `${parts[0].charAt(0).toUpperCase()}.`;
    return parts.map((p) => p.charAt(0).toUpperCase()).join(". ") + ".";
  })();
  const { toast } = useToast();
  const [categoria, setCategoria] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [localidade, setLocalidade] = useState("");
  const [uf, setUf] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);
  const [categoriaOpen, setCategoriaOpen] = useState(false);

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 8);
    if (numbers.length <= 5) return numbers.replace(/(\d{5})/, "$1");
    return numbers.replace(/(\d{5})(\d{0,3})/, "$1-$2");
  };

  const buscarCep = async (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 8);
    setCep(formatCep(value));
    if (numbers.length < 8) {
      setLogradouro("");
      setBairro("");
      setLocalidade("");
      setUf("");
      return;
    }
    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${numbers}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setLogradouro(data.logradouro || "");
        setBairro(data.bairro || "");
        setLocalidade(data.localidade || "");
        setUf(data.uf || "");
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    } finally {
      setLoadingCep(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/cidade/${slug}/auth?redirect=${encodeURIComponent(`/cidade/${slug}/solicitar-orcamento`)}`, { replace: true });
    }
  }, [user, authLoading, navigate, slug]);

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

  const enviarSolicitacao = useMutation({
    mutationFn: async () => {
      if (!user?.id || !cidade?.id) throw new Error("Dados incompletos");
      const { data, error } = await supabase
        .from("solicitacao_orcamento")
        .insert({
          cidade_id: cidade.id,
          user_id: user.id,
          categoria: categoria || "outros",
          descricao: descricao.trim(),
          status: "novo",
          cep: cep.replace(/\D/g, "").length === 8 ? cep.replace(/\D/g, "") : null,
          endereco_complemento: [
            logradouro.trim(),
            numero.trim() && `nº ${numero.trim()}`,
            complemento.trim(),
            bairro.trim(),
            localidade.trim() && uf.trim() && `${localidade.trim()} - ${uf.trim()}`,
          ]
            .filter(Boolean)
            .join(", ") || null,
          nome_solicitante_censurado: nomeCensurado,
          bairro: bairro.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Solicitação enviada",
        description: "Empresas da cidade poderão enviar orçamentos para você.",
      });
      navigate(`/cidade/${slug}`);
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao enviar",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      toast({
        title: "Descreva o que você precisa",
        variant: "destructive",
      });
      return;
    }
    enviarSolicitacao.mutate();
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/cidade/${slug}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Solicitar orçamento</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/cidade/${slug}/minhas-solicitacoes-orcamento`)}
        >
          <List className="h-4 w-4 mr-1" />
          Minhas
        </Button>
      </header>

      <div className="p-4 max-w-lg mx-auto">
        <p className="text-sm text-muted-foreground mb-6">
          Descreva o serviço que você precisa. Empresas de {cidade?.nome || "sua cidade"} poderão enviar propostas para você.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Tipo de serviço</Label>
            <Popover open={categoriaOpen} onOpenChange={setCategoriaOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={categoriaOpen}
                  className="w-full justify-between font-normal"
                >
                  {categoria
                    ? (() => {
                        const cat = CATEGORIAS_ORCAMENTO.find((c) => c.id === categoria);
                        return cat ? `${cat.emoji} ${cat.nome}` : "Selecione o serviço";
                      })()
                    : "Selecione ou busque o serviço..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Digite para procurar..." />
                  <CommandList>
                    <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                    <CommandGroup>
                      {CATEGORIAS_ORCAMENTO.map((cat) => (
                        <CommandItem
                          key={cat.id}
                          value={`${cat.nome} ${cat.emoji}`}
                          onSelect={() => {
                            setCategoria(cat.id);
                            setCategoriaOpen(false);
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <span>{cat.emoji}</span>
                            {cat.nome}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descreva o que você precisa</Label>
            <Textarea
              id="descricao"
              placeholder="Ex.: Preciso de um eletricista para instalar 3 pontos de luz na sala e no quarto..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={5}
              className="resize-none"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">{descricao.length}/2000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cep">Endereço (opcional)</Label>
            <p className="text-xs text-muted-foreground mb-1">Digite o CEP para preencher o restante automaticamente</p>
            <Input
              id="cep"
              placeholder="00000-000"
              value={cep}
              onChange={(e) => buscarCep(e.target.value)}
              maxLength={9}
            />
            {loadingCep && <p className="text-xs text-muted-foreground">Buscando endereço...</p>}
          </div>

          {(logradouro || bairro || localidade) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input
                  id="logradouro"
                  placeholder="Rua, avenida..."
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input
                    id="numero"
                    placeholder="Nº"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input
                    id="complemento"
                    placeholder="Apto, sala..."
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  placeholder="Bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="localidade">Cidade</Label>
                  <Input
                    id="localidade"
                    placeholder="Cidade"
                    value={localidade}
                    onChange={(e) => setLocalidade(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uf">UF</Label>
                  <Input
                    id="uf"
                    placeholder="UF"
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    maxLength={2}
                    className="uppercase"
                  />
                </div>
              </div>
            </>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={enviarSolicitacao.isPending || !descricao.trim()}
          >
            {enviarSolicitacao.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              "Enviar solicitação"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default SolicitarOrcamentoPage;
