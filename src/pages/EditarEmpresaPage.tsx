import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Clock, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ImageUpload from "@/components/shared/ImageUpload";
import VideoUpload from "@/components/shared/VideoUpload";
import { CATEGORIAS_SERVICO } from "@/lib/categoriasServico";
import { geocodeEndereco } from "@/lib/geocode";

const categoriasOrdenadas = Object.entries(CATEGORIAS_SERVICO).sort((a, b) =>
  a[1].localeCompare(b[1], "pt-BR")
);
const MAX_CATEGORIAS = 3;

interface HorarioFuncionamento {
  dia: string;
  aberto: boolean;
  abertura: string;
  fechamento: string;
}

const diasSemana = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

const EditarEmpresaPage = () => {
  const { slug, empresaId } = useParams<{ slug: string; empresaId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Form state
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [complemento, setComplemento] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [logomarca, setLogomarca] = useState<string[]>([]);
  const [bannerOferta, setBannerOferta] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);
  const [buscaCategoria, setBuscaCategoria] = useState("");
  const categoriasInicializadasRef = useRef(false);
  const fotosInicializadasRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const [fotosAlteradas, setFotosAlteradas] = useState(false);
  const [cupomNome, setCupomNome] = useState("");
  const [cupomValor, setCupomValor] = useState("");
  const [cupomTipo, setCupomTipo] = useState<"real" | "porcentagem">("porcentagem");
  const [horarios, setHorarios] = useState<HorarioFuncionamento[]>(
    diasSemana.map((dia) => ({
      dia,
      aberto: dia !== "Domingo",
      abertura: "08:00",
      fechamento: "18:00",
    }))
  );

  // Fetch empresa
  const { data: empresa, isLoading } = useQuery({
    queryKey: ["empresa-editar", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("*")
        .eq("id", empresaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  // Nome da cidade para geocoding
  const { data: cidade } = useQuery({
    queryKey: ["cidade", empresa?.cidade_id],
    queryFn: async () => {
      if (!empresa?.cidade_id) return null;
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome")
        .eq("id", empresa.cidade_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!empresa?.cidade_id,
  });

  // Fetch fotos
  const { data: empresaFotos } = useQuery({
    queryKey: ["empresa-fotos", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa_foto")
        .select("url")
        .eq("empresa_id", empresaId)
        .order("ordem");
      if (error) throw error;
      return data?.map((f) => f.url) || [];
    },
    enabled: !!empresaId,
  });

  // Populate form only once when empresa loads (evita sobrescrever categorias ao refetch)
  useEffect(() => {
    if (!empresa || empresa.id !== empresaId) return;
    if (categoriasInicializadasRef.current) return;
    categoriasInicializadasRef.current = true;
    setNome(empresa.nome || "");
    setDescricao(empresa.descricao || "");
    setWhatsapp(formatWhatsapp(empresa.whatsapp || ""));
    setInstagram(empresa.instagram || "");
    setCep(empresa.endereco_cep || "");
    setEndereco(empresa.endereco_rua || "");
    setNumero(empresa.endereco_numero || "");
    setBairro(empresa.endereco_bairro || "");
    setComplemento(empresa.endereco_complemento || "");
    setLogomarca(empresa.logomarca_url ? [empresa.logomarca_url] : []);
    setBannerOferta(empresa.banner_oferta_url ? [empresa.banner_oferta_url] : []);
    setVideoUrl(empresa.video_url || null);
    const adicionais = (empresa.categorias_adicionais as string[] | null) || [];
    setCategoriasSelecionadas(
      empresa.categoria ? [empresa.categoria, ...adicionais].slice(0, MAX_CATEGORIAS) : adicionais.slice(0, MAX_CATEGORIAS)
    );
    if (empresa.horario_funcionamento) {
      setHorarios(empresa.horario_funcionamento as HorarioFuncionamento[]);
    }
    setCupomNome(empresa.cupom_nome || "");
    setCupomValor(empresa.cupom_valor != null ? String(empresa.cupom_valor) : "");
    setCupomTipo((empresa.cupom_tipo === "real" ? "real" : "porcentagem") as "real" | "porcentagem");
  }, [empresa, empresaId]);

  // Reset flags ao trocar de empresa
  useEffect(() => {
    categoriasInicializadasRef.current = false;
    fotosInicializadasRef.current = false;
    setFotosAlteradas(false);
  }, [empresaId]);

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
          ([id, nome]) =>
            !categoriasSelecionadas.includes(id) &&
            (nome.toLowerCase().includes(buscaNorm) || id.toLowerCase().includes(buscaNorm))
        )
      : [];
  const mostrarSugestoes =
    buscaNorm.length >= 1 &&
    categoriasParaBusca.length > 0 &&
    categoriasSelecionadas.length < MAX_CATEGORIAS;

  useEffect(() => {
    if (empresaFotos && !fotosInicializadasRef.current && !fotosAlteradas) {
      fotosInicializadasRef.current = true;
      setFotos(empresaFotos);
    }
  }, [empresaFotos, fotosAlteradas]);

  const formatWhatsapp = (phone: string) => {
    const numbers = phone.replace(/\D/g, "");
    if (numbers.length === 11) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    return phone;
  };

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

  const handleInstagramChange = (value: string) => {
    const cleaned = value.replace(/^@/, "").replace(/\s/g, "").toLowerCase();
    setInstagram(cleaned);
  };

  const handleCepChange = async (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 8);
    let formatted = numbers;
    if (numbers.length > 5) {
      formatted = `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
    }
    setCep(formatted);

    if (numbers.length === 8) {
      setLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${numbers}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setEndereco(data.logradouro || "");
          setBairro(data.bairro || "");
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const updateHorario = (
    index: number,
    field: keyof HorarioFuncionamento,
    value: string | boolean
  ) => {
    setHorarios((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h))
    );
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (saveInFlightRef.current) return;
      if (!empresaId || !user?.id) throw new Error("ID da empresa ou usuario nao encontrado");

      saveInFlightRef.current = true;
      try {
        const categoriaPrincipal = categoriasSelecionadas[0] ?? null;
      const adicionais: string[] = categoriasSelecionadas.slice(1, MAX_CATEGORIAS);

      const coords = await geocodeEndereco({
        cep: cep.replace(/\D/g, "") || undefined,
        rua: endereco || undefined,
        numero: numero || undefined,
        bairro: bairro || undefined,
        cidade: cidade?.nome,
      });

      const { data: updatedList, error: empresaError } = await supabase
        .from("rel_cidade_servico_empresa")
        .update({
          categoria: categoriaPrincipal,
          categorias_adicionais: adicionais,
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          whatsapp: whatsapp.replace(/\D/g, ""),
          instagram: instagram || null,
          endereco_cep: cep.replace(/\D/g, "") || null,
          endereco_rua: endereco || null,
          endereco_numero: numero || null,
          endereco_bairro: bairro || null,
          endereco_complemento: complemento || null,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          horario_funcionamento: horarios,
          logomarca_url: logomarca[0] || null,
          banner_oferta_url: bannerOferta[0] || null,
          video_url: videoUrl || null,
          cupom_nome: cupomNome.trim() || null,
          cupom_valor: cupomNome.trim() && cupomValor ? parseFloat(cupomValor.replace(",", ".")) : null,
          cupom_tipo: cupomNome.trim() && cupomValor ? cupomTipo : null,
        })
        .eq("id", empresaId)
        .select("id");

      if (empresaError) throw empresaError;
      if (!updatedList?.length) {
        throw new Error(
          "Nenhuma alteração foi salva. Verifique se você é o dono desta empresa e se a coluna 'categorias_adicionais' existe na tabela (rode a migração no Supabase)."
        );
      }

      // Update fotos - delete old and insert new
      const { error: deleteFotosError } = await supabase
        .from("rel_cidade_servico_empresa_foto")
        .delete()
        .eq("empresa_id", empresaId);

      if (deleteFotosError) throw deleteFotosError;

      const { count: fotosRestantes, error: checkDeleteError } = await supabase
        .from("rel_cidade_servico_empresa_foto")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId);

      if (checkDeleteError) throw checkDeleteError;
      if ((fotosRestantes ?? 0) > 0) {
        throw new Error("Nao foi possivel remover fotos antigas. Verifique a policy DELETE da tabela rel_cidade_servico_empresa_foto.");
      }

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
      } finally {
        saveInFlightRef.current = false;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["minhas-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["servico-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresa-editar", empresaId] });
      queryClient.invalidateQueries({ queryKey: ["empresa-fotos", empresaId] });
      queryClient.invalidateQueries({ queryKey: ["mapa-empresas"] });
      toast({
        title: "Empresa atualizada!",
        description: "As informações foram salvas com sucesso.",
      });
      navigate(`/cidade/${slug}/minhas-empresas`);
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isValid =
    nome.trim().length >= 3 &&
    whatsapp.replace(/\D/g, "").length === 11 &&
    categoriasSelecionadas.length >= 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/cidade/${slug}/minhas-empresas`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">
          Editar Empresa
        </h1>
      </header>

      <main className="flex-1 p-4 space-y-6 pb-24">
        {/* Tipos de serviço (até 3) */}
        <div className="space-y-2">
          <Label>Tipos de serviço (até 3) *</Label>
          <p className="text-xs text-muted-foreground">
            Busque e selecione em quais categorias sua empresa aparecerá. Máximo 3.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite para buscar (ex: eletricista, salão...)"
              value={buscaCategoria}
              onChange={(e) => setBuscaCategoria(e.target.value)}
              className="pl-9"
            />
            {mostrarSugestoes && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 py-1 rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
                {categoriasParaBusca.slice(0, 12).map(([id, nomeCat]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCategoria(id)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                  >
                    {nomeCat}
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
                    {CATEGORIAS_SERVICO[id] || id}
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

        {/* Fotos do negócio */}
        <div className="space-y-2">
          <Label>Fotos do negócio</Label>
          <ImageUpload
            images={fotos}
            onChange={(next) => {
              setFotos(next);
              setFotosAlteradas(true);
            }}
            maxImages={6}
            bucket="servicos"
            folder="empresas"
          />
        </div>

        {/* Logomarca */}
        <div className="space-y-2">
          <Label>Logomarca (opcional)</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Imagem da marca/logo da empresa (recomendado quadrado)
          </p>
          <ImageUpload
            images={logomarca}
            onChange={setLogomarca}
            maxImages={1}
            bucket="servicos"
            folder="logomarcas"
          />
        </div>

        {/* Banner de oferta */}
        <div className="space-y-2">
          <Label>Banner de oferta (opcional)</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Destaque uma promoção ou oferta especial
          </p>
          <ImageUpload
            images={bannerOferta}
            onChange={setBannerOferta}
            maxImages={1}
            bucket="servicos"
            folder="banners"
          />
        </div>

        {/* Vídeo da empresa */}
        <div className="space-y-2">
          <Label>Vídeo da empresa (opcional)</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Mostre seu trabalho em um vídeo curto
          </p>
          <VideoUpload
            videoUrl={videoUrl}
            onChange={setVideoUrl}
            bucket="servicos"
            folder="videos"
            maxSizeMB={50}
          />
        </div>

        {/* Nome */}
        <div className="space-y-2">
          <Label htmlFor="nome">Nome da empresa *</Label>
          <Input
            id="nome"
            placeholder="Ex: Salão da Maria"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* Descrição */}
        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea
            id="descricao"
            placeholder="Descreva seus serviços, diferenciais..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>

        {/* WhatsApp */}
        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp *</Label>
          <Input
            id="whatsapp"
            placeholder="(00) 00000-0000"
            value={whatsapp}
            onChange={(e) => handleWhatsappChange(e.target.value)}
            inputMode="tel"
          />
        </div>

        {/* Instagram */}
        <div className="space-y-2">
          <Label htmlFor="instagram">Instagram</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              @
            </span>
            <Input
              id="instagram"
              placeholder="seu.perfil"
              value={instagram}
              onChange={(e) => handleInstagramChange(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Cupom de desconto */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="font-medium text-foreground">Cupom de desconto (opcional)</h3>
          <div className="space-y-2">
            <Label htmlFor="cupom_nome">Nome do cupom</Label>
            <Input
              id="cupom_nome"
              placeholder="Ex: PRIMEIRACOMPRA"
              value={cupomNome}
              onChange={(e) => setCupomNome(e.target.value)}
              maxLength={50}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cupom_valor">Valor do desconto</Label>
              <Input
                id="cupom_valor"
                placeholder={cupomTipo === "porcentagem" ? "Ex: 10" : "Ex: 50"}
                value={cupomValor}
                onChange={(e) => setCupomValor(e.target.value.replace(/[^0-9,.]/g, ""))}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={cupomTipo} onValueChange={(v: "real" | "porcentagem") => setCupomTipo(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="real">Real (R$)</SelectItem>
                  <SelectItem value="porcentagem">Porcentagem (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {cupomTipo === "porcentagem"
              ? "Desconto em % sobre o valor do serviço (ex: 10 = 10%)."
              : "Desconto em reais (ex: 50 = R$ 50,00)."}
          </p>
        </div>

        {/* Endereço */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="font-medium text-foreground">Endereço</h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <div className="relative">
                <Input
                  id="cep"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  inputMode="numeric"
                />
                {loadingCep && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="endereco">Rua</Label>
              <Input
                id="endereco"
                placeholder="Rua, Avenida..."
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="numero">Número</Label>
              <Input
                id="numero"
                placeholder="123"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                placeholder="Bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="complemento">Complemento</Label>
            <Input
              id="complemento"
              placeholder="Sala, Bloco, Loja..."
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            O endereço é usado para exibir sua empresa no mapa da cidade (localização obtida automaticamente).
          </p>
        </div>

        {/* Horário de funcionamento */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium text-foreground">
              Horário de Funcionamento
            </h3>
          </div>

          <div className="space-y-3">
            {horarios.map((horario, index) => (
              <div
                key={horario.dia}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
              >
                <label className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={horario.aberto}
                    onChange={(e) =>
                      updateHorario(index, "aberto", e.target.checked)
                    }
                    className="w-4 h-4 rounded border-input"
                  />
                  <span className="text-sm font-medium truncate">
                    {horario.dia}
                  </span>
                </label>

                {horario.aberto ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={horario.abertura}
                      onChange={(e) =>
                        updateHorario(index, "abertura", e.target.value)
                      }
                      className="w-24 h-8 text-sm"
                    />
                    <span className="text-muted-foreground">às</span>
                    <Input
                      type="time"
                      value={horario.fechamento}
                      onChange={(e) =>
                        updateHorario(index, "fechamento", e.target.value)
                      }
                      className="w-24 h-8 text-sm"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Fechado</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <div className="sticky bottom-0 p-4 border-t border-border bg-card">
        <Button
          className="w-full bg-[#331D4A] hover:bg-[#331D4A]/90 text-white rounded-xl"
          size="lg"
          disabled={!isValid || updateMutation.isPending || saveInFlightRef.current}
          onClick={() => {
            if (saveInFlightRef.current || updateMutation.isPending) return;
            updateMutation.mutate();
          }}
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
      </div>
    </div>
  );
};

export default EditarEmpresaPage;

