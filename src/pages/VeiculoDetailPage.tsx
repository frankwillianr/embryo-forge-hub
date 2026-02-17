import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Car,
  Fuel,
  Gauge,
  Calendar,
  MapPin,
  Phone,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import FipePriceCompact from "@/components/veiculos/FipePriceCompact";

const combustivelLabels: Record<string, string> = {
  gasolina: "Gasolina",
  etanol: "Etanol",
  flex: "Flex",
  diesel: "Diesel",
  eletrico: "Elétrico",
  hibrido: "Híbrido",
  gnv: "GNV",
};

const condicaoLabels: Record<string, string> = {
  novo: "Novo",
  seminovo: "Seminovo",
  usado: "Usado",
};

const cambioLabels: Record<string, string> = {
  manual: "Manual",
  automatico: "Automático",
  automatizado: "Automatizado",
  cvt: "CVT",
};

const VeiculoDetailPage = () => {
  const { slug, veiculoId } = useParams<{ slug: string; veiculoId: string }>();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Buscar veículo
  const { data: veiculo, isLoading } = useQuery({
    queryKey: ["veiculo", veiculoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_veiculos")
        .select(`
          *,
          imagens:rel_cidade_veiculos_imagens(imagem_url, ordem)
        `)
        .eq("id", veiculoId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!veiculoId,
  });

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatKm = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `Olá! Vi seu anúncio de ${veiculo?.fipe_marca_nome} ${veiculo?.fipe_modelo_nome} no app e gostaria de mais informações.`
    );
    const phone = (veiculo?.whatsapp || veiculo?.telefone)?.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
  };

  const handleCall = () => {
    const phone = veiculo?.telefone;
    window.open(`tel:${phone}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Car className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (!veiculo) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Car className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Veículo não encontrado</p>
        <Button onClick={() => navigate(`/cidade/${slug}/veiculos`)}>
          Ver outros veículos
        </Button>
      </div>
    );
  }

  const imagens = veiculo.imagens?.sort((a, b) => a.ordem - b.ordem) || [];

  return (
    <div className="min-h-screen bg-background pb-36">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center px-4 py-3 pt-safe bg-background/95 backdrop-blur-sm border-b border-border/50">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(`/cidade/${slug}/veiculos`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </header>

      {/* Galeria de Imagens */}
      <div className="relative aspect-[4/3] bg-muted">
        {imagens.length > 0 ? (
          <>
            <img
              src={imagens[currentImageIndex].imagem_url}
              alt={veiculo.titulo}
              className="w-full h-full object-cover"
            />
            {imagens.length > 1 && (
              <>
                {currentImageIndex > 0 && (
                  <button
                    onClick={() => setCurrentImageIndex((i) => i - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                )}
                {currentImageIndex < imagens.length - 1 && (
                  <button
                    onClick={() => setCurrentImageIndex((i) => i + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                )}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                  {imagens.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1.5 rounded-full transition-all ${
                        index === currentImageIndex
                          ? "w-6 bg-white"
                          : "w-1.5 bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Car className="h-20 w-20 text-muted-foreground/30" />
          </div>
        )}
        {veiculo.condicao === "novo" && (
          <div className="absolute top-4 right-4 bg-green-500 text-white text-xs px-3 py-1 rounded-full font-medium">
            Novo
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-4 space-y-6">
        {/* Título e Preço */}
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wide">
            {veiculo.fipe_marca_nome} {veiculo.fipe_modelo_nome}
          </p>
          <h1 className="text-2xl font-bold text-foreground mt-1">
            {veiculo.titulo}
          </h1>
          <div className="mt-3 space-y-1">
            <p className="text-3xl font-bold text-primary">
              {formatPrice(veiculo.preco)}
            </p>
            <FipePriceCompact
              fipeMarcaCodigo={veiculo.fipe_marca_codigo}
              fipeModeloCodigo={veiculo.fipe_modelo_codigo}
              fipeVersaoCodigo={veiculo.fipe_versao_codigo}
              marcaNome={veiculo.fipe_marca_nome}
              modeloNome={veiculo.fipe_modelo_nome}
              anoModelo={veiculo.ano_modelo.toString()}
              combustivel={veiculo.combustivel}
              precoAnunciado={veiculo.preco}
            />
          </div>
        </div>

        {/* Especificações */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Ano</p>
              <p className="text-sm font-medium">
                {veiculo.ano_fabricacao}/{veiculo.ano_modelo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Gauge className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Quilometragem</p>
              <p className="text-sm font-medium">{formatKm(veiculo.quilometragem)} km</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Fuel className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Combustível</p>
              <p className="text-sm font-medium">
                {combustivelLabels[veiculo.combustivel] || veiculo.combustivel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Car className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Condição</p>
              <p className="text-sm font-medium">
                {condicaoLabels[veiculo.condicao] || veiculo.condicao}
              </p>
            </div>
          </div>
          {veiculo.cambio && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Settings2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Câmbio</p>
                <p className="text-sm font-medium">
                  {cambioLabels[veiculo.cambio] || veiculo.cambio}
                </p>
              </div>
            </div>
          )}
          {veiculo.cor && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <div className="h-5 w-5 flex-shrink-0 flex items-center justify-center">
                <div className="h-4 w-4 rounded-full border border-border bg-muted" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cor</p>
                <p className="text-sm font-medium capitalize">{veiculo.cor}</p>
              </div>
            </div>
          )}
        </div>

        {/* Diferenciais */}
        {(veiculo.aceita_troca || veiculo.ipva_pago || veiculo.licenciado ||
          veiculo.unico_dono || veiculo.com_manual || veiculo.chave_reserva) && (
          <div>
            <h2 className="text-base font-semibold mb-3">Diferenciais</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Aceita troca", value: veiculo.aceita_troca },
                { label: "IPVA pago", value: veiculo.ipva_pago },
                { label: "Licenciado", value: veiculo.licenciado },
                { label: "Único dono", value: veiculo.unico_dono },
                { label: "Com manual", value: veiculo.com_manual },
                { label: "Chave reserva", value: veiculo.chave_reserva },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2">
                  {value ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${value ? "text-foreground" : "text-muted-foreground/50 line-through"}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Descrição */}
        {veiculo.descricao && (
          <div>
            <h2 className="text-base font-semibold mb-2">Descrição</h2>
            <p className="text-muted-foreground whitespace-pre-line text-sm leading-relaxed">
              {veiculo.descricao}
            </p>
          </div>
        )}

        {/* Localização */}
        {veiculo.localizacao && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span>{veiculo.localizacao}</span>
          </div>
        )}
      </div>

      {/* Footer Fixo - Botões de Contato */}
      {veiculo.telefone && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-safe">
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={handleCall}
              className="flex-1"
            >
              <Phone className="h-5 w-5 mr-2" />
              Ligar
            </Button>
            <Button size="lg" onClick={handleWhatsApp} className="flex-1 gap-2">
              <MessageCircle className="h-5 w-5" />
              WhatsApp
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VeiculoDetailPage;
