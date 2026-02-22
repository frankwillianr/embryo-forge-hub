import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, FileText, ChevronsUpDown } from "lucide-react";
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

const formatCep = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 8);
  if (numbers.length <= 5) return numbers.replace(/(\d{5})/, "$1");
  return numbers.replace(/(\d{5})(\d{0,3})/, "$1-$2");
};

const EditarSolicitacaoOrcamentoPage = () => {
  const { slug, id } = useParams<{ slug: string; id: string }>();
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
  const queryClient = useQueryClient();
  const [categoria, setCategoria] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [cep, setCep] = useState("");
  const [enderecoComplemento, setEnderecoComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [categoriaOpen, setCategoriaOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/cidade/${slug}/auth?redirect=${encodeURIComponent(`/cidade/${slug}/editar-solicitacao-orcamento/${id}`)}`, { replace: true });
    }
  }, [user, authLoading, navigate, slug, id]);

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

  const { data: solicitacao, isLoading: loadingSolicitacao } = useQuery({
    queryKey: ["solicitacao-orcamento-edit", id, user?.id],
    queryFn: async () => {
      if (!id || !user?.id) return null;
      const { data, error } = await supabase
        .from("solicitacao_orcamento")
        .select("id, categoria, descricao, cep, endereco_complemento, bairro")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user?.id,
  });

  useEffect(() => {
    if (solicitacao) {
      setCategoria(solicitacao.categoria || "");
      setDescricao(solicitacao.descricao || "");
      const cepVal = solicitacao.cep ? String(solicitacao.cep) : "";
      setCep(cepVal.length === 8 ? formatCep(cepVal) : cepVal);
      setEnderecoComplemento(solicitacao.endereco_complemento || "");
      setBairro(solicitacao.bairro || "");
    }
  }, [solicitacao]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!id || !user?.id) throw new Error("Dados incompletos");
      const { error } = await supabase
        .from("solicitacao_orcamento")
        .update({
          categoria: categoria || "outros",
          descricao: descricao.trim(),
          cep: cep.replace(/\D/g, "").length === 8 ? cep.replace(/\D/g, "") : null,
          endereco_complemento: enderecoComplemento.trim() || null,
          nome_solicitante_censurado: nomeCensurado,
          bairro: bairro.trim() || null,
        })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["minhas-solicitacoes-orcamento"] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos-home"] });
      toast({ title: "Solicitação atualizada." });
      navigate(`/cidade/${slug}/minhas-solicitacoes-orcamento`);
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao salvar",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      toast({ title: "Descreva o que você precisa", variant: "destructive" });
      return;
    }
    salvar.mutate();
  };

  useEffect(() => {
    if (!loadingSolicitacao && user && id && solicitacao === null) {
      toast({ title: "Solicitação não encontrada.", variant: "destructive" });
      navigate(`/cidade/${slug}/minhas-solicitacoes-orcamento`);
    }
  }, [loadingSolicitacao, user, id, solicitacao, navigate, slug]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadingSolicitacao || !solicitacao) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}/minhas-solicitacoes-orcamento`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Editar solicitação</h1>
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto">
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
              placeholder="Ex.: Preciso de um eletricista..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={5}
              className="resize-none"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">{descricao.length}/2000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cep">CEP (onde o serviço será feito)</Label>
            <Input
              id="cep"
              placeholder="00000-000"
              value={cep}
              onChange={(e) => setCep(formatCep(e.target.value))}
              maxLength={9}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço ou referência (opcional)</Label>
            <Input
              id="endereco"
              placeholder="Número, bairro, ponto de referência..."
              value={enderecoComplemento}
              onChange={(e) => setEnderecoComplemento(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bairro">Bairro (opcional, aparece no card)</Label>
            <Input
              id="bairro"
              placeholder="Bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={salvar.isPending || !descricao.trim()}
          >
            {salvar.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              "Salvar alterações"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default EditarSolicitacaoOrcamentoPage;
