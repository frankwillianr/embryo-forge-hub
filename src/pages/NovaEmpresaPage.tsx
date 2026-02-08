import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ImageUpload from "@/components/shared/ImageUpload";
import VideoUpload from "@/components/shared/VideoUpload";
import EmpresaPricingInfo from "@/components/servicos/EmpresaPricingInfo";
import EmpresaPreviewModal from "@/components/servicos/EmpresaPreviewModal";

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

const NovaEmpresaPage = () => {
  const { slug, categoriaId } = useParams<{ slug: string; categoriaId: string }>();
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
  const [bannerOferta, setBannerOferta] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [horarios, setHorarios] = useState<HorarioFuncionamento[]>(
    diasSemana.map((dia) => ({
      dia,
      aberto: dia !== "Domingo",
      abertura: "08:00",
      fechamento: "18:00",
    }))
  );

  // Buscar cidade com preço
  const { data: cidade } = useQuery({
    queryKey: ["cidade", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome, valor_empresa_anual")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Buscar CEP
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
    // Remove @ se já existir e espaços
    const cleaned = value.replace(/^@/, "").replace(/\s/g, "").toLowerCase();
    setInstagram(cleaned);
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

  // Criar empresa
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!cidade?.id) throw new Error("Cidade não encontrada");
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data: empresa, error: empresaError } = await supabase
        .from("rel_cidade_servico_empresa")
        .insert({
          cidade_id: cidade.id,
          user_id: user.id,
          categoria: categoriaId,
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          whatsapp: whatsapp.replace(/\D/g, ""),
          instagram: instagram || null,
          endereco_cep: cep.replace(/\D/g, "") || null,
          endereco_rua: endereco || null,
          endereco_numero: numero || null,
          endereco_bairro: bairro || null,
          endereco_complemento: complemento || null,
          horario_funcionamento: horarios,
          banner_oferta_url: bannerOferta[0] || null,
          video_url: videoUrl || null,
          status: "aguardando_pagamento",
        })
        .select()
        .single();

      if (empresaError) throw empresaError;

      // Inserir fotos
      if (fotos.length > 0) {
        const fotosData = fotos.map((url, index) => ({
          empresa_id: empresa.id,
          url,
          ordem: index,
        }));

        const { error: fotosError } = await supabase
          .from("rel_cidade_servico_empresa_foto")
          .insert(fotosData);

        if (fotosError) throw fotosError;
      }

      // Enviar e-mail com link de pagamento
      try {
        const { error: emailError } = await supabase.functions.invoke(
          "send-empresa-payment-email",
          {
            body: { empresa_id: empresa.id },
          }
        );

        if (emailError) {
          console.error("Erro ao enviar e-mail de pagamento:", emailError);
          // Não bloqueia o cadastro se o e-mail falhar
        }
      } catch (emailErr) {
        console.error("Erro ao chamar função de e-mail:", emailErr);
      }

      return empresa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servico-empresas"] });
      toast({
        title: "Empresa cadastrada!",
        description: "Você receberá o link de pagamento por e-mail em instantes.",
      });
      navigate(`/cidade/${slug}/servicos/${categoriaId}`);
    },
    onError: (error) => {
      toast({
        title: "Erro ao cadastrar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isValid =
    nome.trim().length >= 3 &&
    whatsapp.replace(/\D/g, "").length === 11;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/cidade/${slug}/servicos/${categoriaId}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">
          Adicionar Empresa
        </h1>
      </header>

      <main className="flex-1 p-4 space-y-6 pb-24">
        {/* Fotos do negócio */}
        <div className="space-y-2">
          <Label>Fotos do negócio</Label>
          <ImageUpload
            images={fotos}
            onChange={setFotos}
            maxImages={6}
            bucket="servicos"
            folder="empresas"
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

        {/* Pricing Info Card */}
        {cidade?.valor_empresa_anual && cidade.valor_empresa_anual > 0 && (
          <EmpresaPricingInfo valorAnual={cidade.valor_empresa_anual} />
        )}

        {/* Botão de cadastro */}
        <div className="pt-4 pb-8">
          <Button
            className="w-full bg-[#331D4A] hover:bg-[#331D4A]/90 text-white rounded-xl"
            size="lg"
            disabled={!isValid}
            onClick={() => setShowPreviewModal(true)}
          >
            Cadastrar empresa
          </Button>
        </div>
      </main>

      {/* Preview Modal */}
      <EmpresaPreviewModal
        open={showPreviewModal}
        onOpenChange={setShowPreviewModal}
        onConfirm={() => createMutation.mutate()}
        isLoading={createMutation.isPending}
        empresa={{
          nome,
          descricao,
          whatsapp,
          instagram,
          endereco: {
            cep,
            rua: endereco,
            numero,
            bairro,
            complemento,
          },
          horarios,
          fotos,
        }}
      />
    </div>
  );
};

export default NovaEmpresaPage;
