import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { useToast } from "@/hooks/use-toast";
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

  // Form state
  const [marcaId, setMarcaId] = useState("");
  const [modeloId, setModeloId] = useState("");
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

  // Buscar marcas
  const { data: marcas } = useQuery({
    queryKey: ["veiculos-marcas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_veiculos_marcas")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Buscar modelos da marca selecionada
  const { data: modelos } = useQuery({
    queryKey: ["veiculos-modelos", marcaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_veiculos_modelos")
        .select("*")
        .eq("marca_id", marcaId)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!marcaId,
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

      setUploading(true);

      // Criar o anúncio
      const { data: veiculo, error: veiculoError } = await supabase
        .from("rel_cidade_veiculos")
        .insert({
          cidade_id: cidade.id,
          marca_id: marcaId,
          modelo_id: modeloId,
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
    onError: (error) => {
      console.error("Erro ao criar anúncio:", error);
      toast({
        title: "Erro ao criar anúncio",
        description: "Tente novamente mais tarde.",
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
        !condicao || !telefone) {
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center gap-3 p-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
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

        {/* Marca e Modelo */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Marca *</Label>
            <Select value={marcaId} onValueChange={(v) => {
              setMarcaId(v);
              setModeloId("");
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {marcas?.map((marca) => (
                  <SelectItem key={marca.id} value={marca.id}>
                    {marca.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Modelo *</Label>
            <Select value={modeloId} onValueChange={setModeloId} disabled={!marcaId}>
              <SelectTrigger>
                <SelectValue placeholder={marcaId ? "Selecione" : "Escolha marca"} />
              </SelectTrigger>
              <SelectContent>
                {modelos?.map((modelo) => (
                  <SelectItem key={modelo.id} value={modelo.id}>
                    {modelo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        <FipePrice
          marcaNome={marcas?.find(m => m.id === marcaId)?.nome}
          modeloNome={modelos?.find(m => m.id === modeloId)?.nome}
          anoModelo={anoModelo}
          combustivel={combustivel}
        />

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
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
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
