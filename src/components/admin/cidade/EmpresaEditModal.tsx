import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
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

type EmpresaStatus = "aguardando_pagamento" | "pendente" | "ativo" | "recusado";

interface EmpresaEditModalProps {
  empresaId: string | null;
  cidadeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EmpresaEditModal = ({ empresaId, cidadeId, open, onOpenChange }: EmpresaEditModalProps) => {
  const queryClient = useQueryClient();
  
  // Form state
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [categoria, setCategoria] = useState("");
  const [status, setStatus] = useState<EmpresaStatus>("aguardando_pagamento");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [complemento, setComplemento] = useState("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  // Fetch empresa details
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

  // Populate form when data loads
  useEffect(() => {
    if (empresa) {
      console.log("Empresa data loaded:", empresa);
      setNome(empresa.nome || "");
      setDescricao(empresa.descricao || "");
      // Format whatsapp for display
      const whatsappNumbers = (empresa.whatsapp || "").replace(/\D/g, "");
      if (whatsappNumbers.length === 11) {
        setWhatsapp(`(${whatsappNumbers.slice(0, 2)}) ${whatsappNumbers.slice(2, 7)}-${whatsappNumbers.slice(7)}`);
      } else {
        setWhatsapp(empresa.whatsapp || "");
      }
      setInstagram(empresa.instagram || "");
      setCategoria(empresa.categoria || "");
      setStatus((empresa.status as EmpresaStatus) || "aguardando_pagamento");
      setCep(empresa.endereco_cep || "");
      setEndereco(empresa.endereco_rua || "");
      setNumero(empresa.endereco_numero || "");
      setBairro(empresa.endereco_bairro || "");
      setComplemento(empresa.endereco_complemento || "");
      setDataInicio(empresa.data_inicio ? new Date(empresa.data_inicio + "T00:00:00") : undefined);
      setDataFim(empresa.data_fim ? new Date(empresa.data_fim + "T00:00:00") : undefined);
    }
  }, [empresa]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("ID da empresa não encontrado");

      const updateData = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        whatsapp: whatsapp.replace(/\D/g, ""),
        instagram: instagram || null,
        categoria,
        status,
        endereco_cep: cep.replace(/\D/g, "") || null,
        endereco_rua: endereco || null,
        endereco_numero: numero || null,
        endereco_bairro: bairro || null,
        endereco_complemento: complemento || null,
        data_inicio: dataInicio ? dataInicio.toISOString().split("T")[0] : null,
        data_fim: dataFim ? dataFim.toISOString().split("T")[0] : null,
      };

      console.log("Updating empresa with:", updateData);

      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .update(updateData)
        .eq("id", empresaId)
        .select();

      console.log("Update result:", { data, error });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log("Update successful:", data);
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-empresas", cidadeId] });
      queryClient.invalidateQueries({ queryKey: ["admin-empresa-detail", empresaId] });
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

  const isValid = nome.trim().length >= 3;

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
            {/* Info básica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da empresa *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Input
                  id="categoria"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
              />
            </div>

            {/* Contato */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(e) => handleWhatsappChange(e.target.value)}
                />
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

            {/* Status e Datas */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <h3 className="font-medium text-foreground">Status e Período de Ativação</h3>
              
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
                  <Label>Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dataInicio && "text-muted-foreground"
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
                          !dataFim && "text-muted-foreground"
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

            {/* Endereço */}
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">Endereço</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="endereco">Rua</Label>
                  <Input
                    id="endereco"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input
                    id="numero"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input
                    id="complemento"
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={!isValid || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              "Salvar alterações"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmpresaEditModal;
