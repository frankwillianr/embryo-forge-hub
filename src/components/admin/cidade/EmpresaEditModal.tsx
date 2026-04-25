import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ImageUpload from "@/components/shared/ImageUpload";

type EmpresaStatus = "aguardando_pagamento" | "pendente" | "ativo" | "recusado";
const MAX_CATEGORIAS = 3;

interface EmpresaEditModalProps {
  empresaId: string | null;
  cidadeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EmpresaEditModal = ({ empresaId, cidadeId, open, onOpenChange }: EmpresaEditModalProps) => {
  const queryClient = useQueryClient();

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);
  const [buscaCategoria, setBuscaCategoria] = useState("");
  const [status, setStatus] = useState<EmpresaStatus>("aguardando_pagamento");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [complemento, setComplemento] = useState("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [fotos, setFotos] = useState<string[]>([]);
  const [bannerPrincipal, setBannerPrincipal] = useState<string[]>([]);

  const fotosInicializadasRef = useRef(false);
  const categoriasInicializadasRef = useRef(false);
  const categoriasSelecionadasRef = useRef<string[]>([]);

  const { data: subcategoriasCatalogo = [] } = useQuery({
    queryKey: ["admin-servicos-subcategorias-form"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servico_subcategoria")
        .select("slug, nome, ativo")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{ slug: string; nome: string; ativo: boolean }>;
    },
  });

  const categoriasOrdenadas = useMemo(
    () => [...subcategoriasCatalogo].map((item) => ({ id: item.slug, nome: item.nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [subcategoriasCatalogo],
  );

  const categoriasNomePorId = useMemo(
    () => Object.fromEntries(categoriasOrdenadas.map((item) => [item.id, item.nome])),
    [categoriasOrdenadas],
  );

  const categoriasDisponiveisIds = useMemo(
    () => new Set(categoriasOrdenadas.map((item) => item.id)),
    [categoriasOrdenadas],
  );

  const { data: empresa, isLoading } = useQuery({
    queryKey: ["admin-empresa-detail", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("*")
        .eq("id", empresaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId && open,
  });

  const { data: empresaFotos } = useQuery({
    queryKey: ["admin-empresa-fotos", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa_foto")
        .select("url")
        .eq("empresa_id", empresaId)
        .order("ordem");
      if (error) throw error;
      return (data || []).map((item) => item.url);
    },
    enabled: !!empresaId && open,
  });

  useEffect(() => {
    if (!open) return;
    fotosInicializadasRef.current = false;
    categoriasInicializadasRef.current = false;
    setFotos([]);
    setCategoriasSelecionadas([]);
    setBuscaCategoria("");
  }, [empresaId, open]);

  useEffect(() => {
    if (!empresa) return;
    setNome(empresa.nome || "");
    setDescricao(empresa.descricao || "");

    const whatsappNumbers = (empresa.whatsapp || "").replace(/\D/g, "");
    if (whatsappNumbers.length === 11) {
      setWhatsapp(`(${whatsappNumbers.slice(0, 2)}) ${whatsappNumbers.slice(2, 7)}-${whatsappNumbers.slice(7)}`);
    } else {
      setWhatsapp(empresa.whatsapp || "");
    }

    if (!categoriasInicializadasRef.current) {
      categoriasInicializadasRef.current = true;
      const adicionais = (empresa.categorias_adicionais as string[] | null) || [];
      setCategoriasSelecionadas(
        empresa.categoria ? [empresa.categoria, ...adicionais].slice(0, MAX_CATEGORIAS) : adicionais.slice(0, MAX_CATEGORIAS),
      );
    }

    setInstagram(empresa.instagram || "");
    setStatus((empresa.status as EmpresaStatus) || "aguardando_pagamento");
    setCep(empresa.endereco_cep || "");
    setEndereco(empresa.endereco_rua || "");
    setNumero(empresa.endereco_numero || "");
    setBairro(empresa.endereco_bairro || "");
    setComplemento(empresa.endereco_complemento || "");
    setDataInicio(empresa.data_inicio ? new Date(`${empresa.data_inicio}T00:00:00`) : undefined);
    setDataFim(empresa.data_fim ? new Date(`${empresa.data_fim}T00:00:00`) : undefined);
    setBannerPrincipal(empresa.banner_oferta_url ? [empresa.banner_oferta_url] : []);
  }, [empresa]);

  useEffect(() => {
    if (!empresaFotos || fotosInicializadasRef.current) return;
    fotosInicializadasRef.current = true;
    setFotos(empresaFotos);
  }, [empresaFotos]);

  useEffect(() => {
    categoriasSelecionadasRef.current = categoriasSelecionadas;
  }, [categoriasSelecionadas]);

  const toggleCategoria = (id: string) => {
    setCategoriasSelecionadas((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= MAX_CATEGORIAS) return prev;
      return [...prev, id];
    });
    setBuscaCategoria("");
  };

  const removerCategoria = (id: string) => {
    setCategoriasSelecionadas((prev) => prev.filter((c) => c !== id));
  };

  const buscaNorm = buscaCategoria.trim().toLowerCase();
  const categoriasParaBusca =
    buscaNorm.length >= 1
      ? categoriasOrdenadas.filter(
          (item) =>
            !categoriasSelecionadas.includes(item.id) &&
            (item.nome.toLowerCase().includes(buscaNorm) || item.id.toLowerCase().includes(buscaNorm)),
        )
      : [];
  const mostrarSugestoes =
    buscaNorm.length >= 1 &&
    categoriasParaBusca.length > 0 &&
    categoriasSelecionadas.length < MAX_CATEGORIAS;

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("ID da empresa nao encontrado");

      let resolvedDataInicio = dataInicio;
      let resolvedDataFim = dataFim;

      if (status === "ativo") {
        if (!resolvedDataInicio) resolvedDataInicio = new Date();
        if (!resolvedDataFim) {
          const fim = new Date(resolvedDataInicio);
          fim.setFullYear(fim.getFullYear() + 1);
          resolvedDataFim = fim;
        }
      }

      const categoriasValidasSelecionadas = categoriasSelecionadas
        .filter((id) => categoriasDisponiveisIds.has(id))
        .slice(0, MAX_CATEGORIAS);
      const categoriaPrincipal = categoriasValidasSelecionadas[0] ?? null;
      if (!categoriaPrincipal) throw new Error("Selecione ao menos um servico");
      const adicionais = categoriasValidasSelecionadas.slice(1, MAX_CATEGORIAS);

      const updateData = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        whatsapp: whatsapp.replace(/\D/g, ""),
        instagram: instagram || null,
        categoria: categoriaPrincipal,
        categorias_adicionais: adicionais,
        status,
        endereco_cep: cep.replace(/\D/g, "") || null,
        endereco_rua: endereco || null,
        endereco_numero: numero || null,
        endereco_bairro: bairro || null,
        endereco_complemento: complemento || null,
        banner_oferta_url: bannerPrincipal[0] || null,
        data_inicio: resolvedDataInicio ? resolvedDataInicio.toISOString().split("T")[0] : null,
        data_fim: resolvedDataFim ? resolvedDataFim.toISOString().split("T")[0] : null,
      };

      const { error } = await supabase
        .from("rel_cidade_servico_empresa")
        .update(updateData)
        .eq("id", empresaId);
      if (error) throw error;

      const { error: deleteFotosError } = await supabase
        .from("rel_cidade_servico_empresa_foto")
        .delete()
        .eq("empresa_id", empresaId);
      if (deleteFotosError) throw deleteFotosError;

      const fotosNormalizadas = fotos.map((url) => url.trim()).filter(Boolean);
      const fotosUnicas = Array.from(new Set(fotosNormalizadas));
      if (fotosUnicas.length > 0) {
        const fotosData = fotosUnicas.map((url, index) => ({
          empresa_id: empresaId,
          url,
          ordem: index,
        }));
        const { error: fotosError } = await supabase
          .from("rel_cidade_servico_empresa_foto")
          .insert(fotosData);
        if (fotosError) throw fotosError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-empresas", cidadeId] });
      queryClient.invalidateQueries({ queryKey: ["admin-empresa-detail", empresaId] });
      queryClient.invalidateQueries({ queryKey: ["admin-empresa-fotos", empresaId] });
      toast.success("Empresa atualizada com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao atualizar empresa:", error);
      toast.error("Erro ao atualizar empresa: " + (error as Error).message);
    },
  });

  const handleWhatsappChange = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    let formatted = numbers;
    if (numbers.length > 2) {
      formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    }
    if (numbers.length > 7) {
      formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    setWhatsapp(formatted);
  };

  const isValid =
    nome.trim().length >= 3 &&
    categoriasSelecionadas.some((id) => categoriasDisponiveisIds.has(id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Empresa</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da empresa *</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Servicos selecionados (ate 3)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Digite para buscar servicos..."
                  value={buscaCategoria}
                  onChange={(e) => setBuscaCategoria(e.target.value)}
                  onBlur={() => {
                    window.setTimeout(() => {
                      if (categoriasSelecionadasRef.current.length === 0) {
                        setBuscaCategoria("");
                      }
                    }, 120);
                  }}
                  disabled={categoriasOrdenadas.length === 0}
                  className="pl-9"
                />
                {mostrarSugestoes && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 py-1 rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
                    {categoriasParaBusca.slice(0, 12).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleCategoria(item.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                      >
                        {item.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {categoriasSelecionadas.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    Selecionados ({categoriasSelecionadas.length}/{MAX_CATEGORIAS})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {categoriasSelecionadas.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground pl-3 pr-1.5 py-1 text-sm"
                      >
                        {categoriasNomePorId[id] || id}
                        <button
                          type="button"
                          onClick={() => removerCategoria(id)}
                          className="rounded-full p-0.5 hover:bg-primary-foreground/20"
                          aria-label="Remover"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descricao</Label>
              <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Fotos da empresa</Label>
              <ImageUpload
                images={fotos}
                onChange={setFotos}
                maxImages={6}
                bucket="servicos"
                folder="empresas"
              />
            </div>

            <div className="space-y-2">
              <Label>Banner principal</Label>
              <ImageUpload
                images={bannerPrincipal}
                onChange={setBannerPrincipal}
                maxImages={1}
                bucket="servicos"
                folder="banners"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" value={whatsapp} onChange={(e) => handleWhatsappChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                  <Input
                    id="instagram"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value.replace(/^@/, "").replace(/\s/g, ""))}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <h3 className="font-medium text-foreground">Status e Periodo de Ativacao</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as EmpresaStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aguardando_pagamento">Aguardando Pagamento</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="recusado">Recusado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data Inicio</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dataInicio && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataInicio ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataInicio}
                        onSelect={setDataInicio}
                        locale={ptBR}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dataFim && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataFim ? format(dataFim, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataFim}
                        onSelect={setDataFim}
                        locale={ptBR}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-foreground">Endereco</h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input id="cep" value={cep} onChange={(e) => setCep(e.target.value)} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="endereco">Rua</Label>
                  <Input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero">Numero</Label>
                  <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input id="complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => updateMutation.mutate()} disabled={!isValid || updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              "Salvar alteracoes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmpresaEditModal;
