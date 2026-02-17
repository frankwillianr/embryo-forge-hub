import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Upload, X, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fipeApi } from "@/services/fipeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import FipePrice from "@/components/veiculos/FipePrice";

const combustivelOptions = [
  { value: "gasolina", label: "Gasolina" },
  { value: "etanol", label: "Etanol" },
  { value: "flex", label: "Flex" },
  { value: "diesel", label: "Diesel" },
  { value: "eletrico", label: "Elétrico" },
  { value: "hibrido", label: "Híbrido" },
  { value: "gnv", label: "GNV" },
];

const cambioOptions = [
  { value: "manual", label: "Manual" },
  { value: "automatico", label: "Automático" },
  { value: "cvt", label: "CVT" },
  { value: "automatizado", label: "Automatizado" },
];

const condicaoOptions = [
  { value: "novo", label: "Novo (0km)" },
  { value: "seminovo", label: "Seminovo" },
  { value: "usado", label: "Usado" },
];

const coresOptions = [
  "Branco", "Preto", "Prata", "Cinza", "Vermelho", "Azul", 
  "Verde", "Amarelo", "Laranja", "Marrom", "Bege", "Dourado"
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 30 }, (_, i) => currentYear - i + 1);

const NovoVeiculoPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Form state
  const [marcaId, setMarcaId] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [versaoId, setVersaoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [anoFabricacao, setAnoFabricacao] = useState("");
  const [anoModelo, setAnoModelo] = useState("");
  const [cor, setCor] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [cambio, setCambio] = useState("");
  const [quilometragem, setQuilometragem] = useState("");
  const [condicao, setCondicao] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  
  // Opcionais
  const [aceitaTroca, setAceitaTroca] = useState(false);
  const [ipvaPago, setIpvaPago] = useState(false);
  const [licenciado, setLicenciado] = useState(false);
  const [unicoDono, setUnicoDono] = useState(false);
  const [comManual, setComManual] = useState(false);
  const [chaveReserva, setChaveReserva] = useState(false);

  // Combobox open states
  const [marcaOpen, setMarcaOpen] = useState(false);
  const [modeloOpen, setModeloOpen] = useState(false);
  const [versaoOpen, setVersaoOpen] = useState(false);

  // Imagens
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

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
    staleTime: 1000 * 60 * 60 * 24,
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

  // Buscar dados completos do veículo FIPE quando versão for selecionada
  const { data: dadosFipe } = useQuery({
    queryKey: ["fipe-veiculo", marcaId, modeloId, versaoId],
    queryFn: () => fipeApi.getVeiculo(marcaId, Number(modeloId), versaoId),
    enabled: !!marcaId && !!modeloId && !!versaoId,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imageFiles.length > 10) {
      toast({
        title: "Limite de imagens",
        description: "Você pode adicionar no máximo 10 imagens",
        variant: "destructive",
      });
      return;
    }

    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    setImageFiles((prev) => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!cidade?.id) throw new Error("Cidade não encontrada");
      if (!user?.id) throw new Error("Você precisa estar logado para anunciar");

      setUploading(true);

      // Criar o anúncio
      const marcaNome = marcas?.find(m => m.codigo === marcaId)?.nome || "";
      const modeloNome = modelos?.find(m => m.codigo.toString() === modeloId)?.nome || "";
      const versaoNome = versoes?.find(v => v.codigo === versaoId)?.nome || null;

      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 30);

      const { data: veiculo, error: veiculoError } = await supabase
        .from("rel_cidade_veiculos")
        .insert({
          cidade_id: cidade.id,
          user_id: user.id,
          fipe_marca_codigo: marcaId,
          fipe_marca_nome: marcaNome,
          fipe_modelo_codigo: modeloId,
          fipe_modelo_nome: modeloNome,
          fipe_versao_codigo: versaoId || null,
          fipe_versao_nome: versaoNome,
          titulo,
          descricao: descricao || null,
          preco: parseFloat(preco.replace(/\D/g, "")) / 100,
          ano_fabricacao: parseInt(anoFabricacao),
          ano_modelo: parseInt(anoModelo),
          cor,
          combustivel,
          cambio,
          quilometragem: parseInt(quilometragem.replace(/\D/g, "")),
          condicao,
          telefone,
          whatsapp: whatsapp || null,
          aceita_troca: aceitaTroca,
          ipva_pago: ipvaPago,
          licenciado,
          unico_dono: unicoDono,
          com_manual: comManual,
          chave_reserva: chaveReserva,
          status: "ativo",
          data_expiracao: dataExpiracao.toISOString(),
        })
        .select()
        .single();

      if (veiculoError) throw veiculoError;

      // Upload das imagens
      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const fileExt = file.name.split(".").pop();
          const fileName = `${veiculo.id}/${Date.now()}_${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("veiculos")
            .upload(fileName, file);

          if (uploadError) {
            console.error("Erro ao fazer upload:", uploadError);
            continue;
          }

          const { data: publicUrl } = supabase.storage
            .from("veiculos")
            .getPublicUrl(fileName);

          await supabase.from("rel_cidade_veiculos_imagens").insert({
            veiculo_id: veiculo.id,
            imagem_url: publicUrl.publicUrl,
            ordem: i,
          });
        }
      }

      return veiculo;
    },
    onSuccess: () => {
      toast({
        title: "Anúncio criado!",
        description: "Seu veículo foi anunciado com sucesso.",
      });
      navigate(`/cidade/${slug}/veiculos`);
    },
    onError: (error: unknown) => {
      console.error("Erro ao criar anúncio:", JSON.stringify(error, null, 2));
      const msg = error instanceof Error ? error.message
        : (error as { message?: string })?.message || "Tente novamente mais tarde.";
      toast({
        title: "Erro ao criar anúncio",
        description: msg,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações básicas
    if (!marcaId || !modeloId || !titulo || !preco || !anoFabricacao ||
        !anoModelo || !cor || !combustivel || !cambio || !quilometragem ||
        !condicao || telefone.replace(/\D/g, "").length < 10) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate();
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const amount = parseInt(numbers || "0") / 100;
    return amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const formatNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return parseInt(numbers || "0").toLocaleString("pt-BR");
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 2) return numbers.length ? `(${numbers}` : "";
    if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}/veiculos`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">
          Anunciar Veículo
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-6 pb-24">
        {/* Imagens */}
        <div className="space-y-3">
          <Label>Fotos do veículo (máx. 10)</Label>
          <div className="grid grid-cols-4 gap-2">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={preview} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
            {imagePreviews.length < 10 && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground mt-1">Adicionar</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Marca, Modelo e Versão */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Marca *</Label>
            <Popover open={marcaOpen} onOpenChange={setMarcaOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={marcaOpen}
                  className="w-full justify-between font-normal"
                >
                  {marcaId
                    ? marcas?.find((m) => m.codigo === marcaId)?.nome
                    : "Selecione a marca"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar marca..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma marca encontrada.</CommandEmpty>
                    <CommandGroup>
                      {marcas?.map((marca) => (
                        <CommandItem
                          key={marca.codigo}
                          value={marca.nome}
                          onSelect={() => {
                            setMarcaId(marca.codigo);
                            setModeloId("");
                            setVersaoId("");
                            setMarcaOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              marcaId === marca.codigo ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {marca.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Modelo *</Label>
            <Popover open={modeloOpen} onOpenChange={setModeloOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={modeloOpen}
                  className="w-full justify-between font-normal"
                  disabled={!marcaId}
                >
                  {modeloId
                    ? modelos?.find((m) => m.codigo.toString() === modeloId)?.nome
                    : marcaId ? "Selecione o modelo" : "Escolha a marca primeiro"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar modelo..." />
                  <CommandList>
                    <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                    <CommandGroup>
                      {modelos?.map((modelo) => (
                        <CommandItem
                          key={modelo.codigo}
                          value={modelo.nome}
                          onSelect={() => {
                            setModeloId(modelo.codigo.toString());
                            setVersaoId("");
                            setModeloOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              modeloId === modelo.codigo.toString() ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {modelo.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Versão / Ano *</Label>
            <Popover open={versaoOpen} onOpenChange={setVersaoOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={versaoOpen}
                  className="w-full justify-between font-normal"
                  disabled={!modeloId}
                >
                  {versaoId
                    ? versoes?.find((v) => v.codigo === versaoId)?.nome
                    : modeloId ? "Selecione a versão" : "Escolha o modelo primeiro"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar versão..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma versão encontrada.</CommandEmpty>
                    <CommandGroup>
                      {versoes?.map((versao) => (
                        <CommandItem
                          key={versao.codigo}
                          value={versao.nome}
                          onSelect={() => {
                            setVersaoId(versao.codigo);
                            setVersaoOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              versaoId === versao.codigo ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {versao.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Título */}
        <div className="space-y-2">
          <Label>Título do anúncio *</Label>
          <Input
            placeholder="Ex: Honda Civic EXL 2020 impecável"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>

        {/* Preço FIPE - Referência */}
        {dadosFipe && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Preço FIPE de referência</p>
            <p className="text-2xl font-bold text-primary">{dadosFipe.Valor}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {dadosFipe.Marca} {dadosFipe.Modelo} - {dadosFipe.Combustivel}
            </p>
            <p className="text-xs text-muted-foreground">
              Referência: {dadosFipe.MesReferencia}
            </p>
          </div>
        )}

        {/* Preço */}
        <div className="space-y-2">
          <Label>Preço *</Label>
          <Input
            placeholder="R$ 0,00"
            value={preco ? formatCurrency(preco) : ""}
            onChange={(e) => setPreco(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        {/* Anos */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Ano Fab. *</Label>
            <Select value={anoFabricacao} onValueChange={setAnoFabricacao}>
              <SelectTrigger>
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ano Modelo *</Label>
            <Select value={anoModelo} onValueChange={setAnoModelo}>
              <SelectTrigger>
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quilometragem e Condição */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Quilometragem *</Label>
            <Input
              placeholder="0 km"
              value={quilometragem ? formatNumber(quilometragem) + " km" : ""}
              onChange={(e) => setQuilometragem(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-2">
            <Label>Condição *</Label>
            <Select value={condicao} onValueChange={setCondicao}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
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
        </div>

        {/* Combustível e Câmbio */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Combustível *</Label>
            <Select value={combustivel} onValueChange={setCombustivel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
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
          <div className="space-y-2">
            <Label>Câmbio *</Label>
            <Select value={cambio} onValueChange={setCambio}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {cambioOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cor */}
        <div className="space-y-2">
          <Label>Cor *</Label>
          <Select value={cor} onValueChange={setCor}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a cor" />
            </SelectTrigger>
            <SelectContent>
              {coresOptions.map((c) => (
                <SelectItem key={c} value={c.toLowerCase()}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Descrição */}
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea
            placeholder="Descreva detalhes do veículo, opcionais, estado de conservação..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={4}
          />
        </div>

        {/* Contato */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Contato</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={telefone}
                inputMode="numeric"
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={whatsapp}
                inputMode="numeric"
                onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Opcionais */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Informações adicionais</Label>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="aceita-troca">Aceita troca</Label>
              <Switch id="aceita-troca" checked={aceitaTroca} onCheckedChange={setAceitaTroca} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ipva-pago">IPVA pago</Label>
              <Switch id="ipva-pago" checked={ipvaPago} onCheckedChange={setIpvaPago} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="licenciado">Licenciado</Label>
              <Switch id="licenciado" checked={licenciado} onCheckedChange={setLicenciado} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="unico-dono">Único dono</Label>
              <Switch id="unico-dono" checked={unicoDono} onCheckedChange={setUnicoDono} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="com-manual">Com manual</Label>
              <Switch id="com-manual" checked={comManual} onCheckedChange={setComManual} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="chave-reserva">Chave reserva</Label>
              <Switch id="chave-reserva" checked={chaveReserva} onCheckedChange={setChaveReserva} />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">
            📅 Seu anúncio ficará ativo por <strong>30 dias</strong> após a publicação.
          </p>
        </div>
      </form>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <Button
          type="submit"
          className="w-full"
          disabled={createMutation.isPending || uploading}
          onClick={handleSubmit}
        >
          {createMutation.isPending || uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Publicando...
            </>
          ) : (
            "Publicar Anúncio"
          )}
        </Button>
      </div>
    </div>
  );
};

export default NovoVeiculoPage;
