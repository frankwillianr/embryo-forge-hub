import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  MessageCircle,
  ChevronDown,
  Clock,
  MapPin,
  Instagram,
  Phone,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface HorarioFuncionamento {
  dia: string;
  aberto: boolean;
  abertura: string;
  fechamento: string;
}

const diasOrdem = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const ServicoEmpresaDetailPage = () => {
  const { slug, categoriaId, empresaId } = useParams<{
    slug: string;
    categoriaId: string;
    empresaId: string;
  }>();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAllHours, setShowAllHours] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: empresa, isLoading } = useQuery({
    queryKey: ["servico-empresa", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select(`
          *,
          fotos:rel_cidade_servico_empresa_foto(id, url, ordem)
        `)
        .eq("id", empresaId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const handleWhatsApp = () => {
    if (!empresa) return;
    const message = encodeURIComponent(
      `Olá! Vi seu perfil no app e gostaria de mais informações.`
    );
    window.open(`https://wa.me/55${empresa.whatsapp}?text=${message}`, "_blank");
  };

  const handleInstagram = () => {
    if (!empresa?.instagram) return;
    window.open(`https://instagram.com/${empresa.instagram}`, "_blank");
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: empresa?.nome,
        text: `Confira ${empresa?.nome}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyPhone = () => {
    if (!empresa) return;
    navigator.clipboard.writeText(empresa.whatsapp);
    toast.success("Número copiado!");
  };

  const images = empresa?.fotos ? [...empresa.fotos].sort((a, b) => a.ordem - b.ordem) : [];
  const horarios = (empresa?.horario_funcionamento as HorarioFuncionamento[]) || [];
  const horariosOrdenados = [...horarios].sort(
    (a, b) => diasOrdem.indexOf(a.dia) - diasOrdem.indexOf(b.dia)
  );

  const getStatusHoje = () => {
    const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const hoje = dias[new Date().getDay()];
    const horarioHoje = horarios.find((h) => h.dia === hoje);

    if (!horarioHoje || !horarioHoje.aberto) {
      return { aberto: false, texto: "Fechado hoje", horario: null };
    }

    const agora = new Date();
    const horaAtual = agora.getHours() * 60 + agora.getMinutes();
    const [aberturaH, aberturaM] = horarioHoje.abertura.split(":").map(Number);
    const [fechamentoH, fechamentoM] = horarioHoje.fechamento.split(":").map(Number);
    const abertura = aberturaH * 60 + aberturaM;
    const fechamento = fechamentoH * 60 + fechamentoM;

    if (horaAtual >= abertura && horaAtual < fechamento) {
      return {
        aberto: true,
        texto: "Aberto agora",
        horario: `Fecha às ${horarioHoje.fechamento}`,
      };
    } else if (horaAtual < abertura) {
      return {
        aberto: false,
        texto: "Fechado",
        horario: `Abre às ${horarioHoje.abertura}`,
      };
    } else {
      return { aberto: false, texto: "Fechado", horario: null };
    }
  };

  const statusHoje = getStatusHoje();

  const formatEndereco = () => {
    if (!empresa) return null;
    const parts = [
      empresa.endereco_rua,
      empresa.endereco_numero,
      empresa.endereco_bairro,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const formatWhatsApp = (num: string) => {
    if (!num) return "";
    return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="aspect-square bg-muted animate-pulse" />
        <div className="p-6 space-y-4">
          <div className="h-8 w-2/3 bg-muted animate-pulse rounded-lg" />
          <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center gap-4 p-4 pt-safe">
          <button
            onClick={() => navigate(`/cidade/${slug}/servicos/${categoriaId}`)}
            className="p-2 -m-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Empresa não encontrada</p>
            <Button 
              variant="outline" 
              onClick={() => navigate(`/cidade/${slug}/servicos/${categoriaId}`)}
            >
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header flutuante */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center p-4 pt-safe">
        <button
          onClick={() => navigate(`/cidade/${slug}/servicos/${categoriaId}`)}
          className="p-2.5 bg-background/80 backdrop-blur-md rounded-full shadow-sm border border-border/50 hover:bg-background transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </header>

      {/* Galeria de imagens */}
      <div className="relative aspect-square bg-muted">
        {images.length > 0 ? (
          <>
            <img
              src={images[currentImageIndex].url}
              alt={empresa.nome}
              className="w-full h-full object-cover"
            />
            {/* Indicadores */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      index === currentImageIndex
                        ? "w-6 bg-white"
                        : "w-1.5 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <div className="text-center space-y-2">
              <span className="text-6xl">🏢</span>
              <p className="text-sm text-muted-foreground">Sem fotos</p>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 p-4 overflow-x-auto">
          {images.map((img, index) => (
            <button
              key={img.id}
              onClick={() => setCurrentImageIndex(index)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all ${
                index === currentImageIndex
                  ? "ring-2 ring-foreground ring-offset-2"
                  : "opacity-60"
              }`}
            >
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Conteúdo */}
      <div className="px-5 py-6 space-y-6">
        {/* Cabeçalho */}
        <div className="space-y-3">
          <div className="flex items-start gap-4">
            {empresa.logomarca_url && (
              <img
                src={empresa.logomarca_url}
                alt=""
                className="w-14 h-14 rounded-2xl object-cover border border-border"
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground leading-tight">
                {empresa.nome}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center gap-1.5 text-sm ${
                    statusHoje.aberto ? "text-green-600" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      statusHoje.aberto ? "bg-green-500" : "bg-muted-foreground"
                    }`}
                  />
                  {statusHoje.texto}
                </span>
                {statusHoje.horario && (
                  <span className="text-sm text-muted-foreground">
                    · {statusHoje.horario}
                  </span>
                )}
              </div>
            </div>
          </div>

          {empresa.descricao && (
            <p className="text-muted-foreground leading-relaxed">
              {empresa.descricao}
            </p>
          )}
        </div>

        {/* Ações principais */}
        <div className="flex gap-3">
          <button
            onClick={handleWhatsApp}
            className="flex-1 h-11 flex items-center justify-center gap-2 text-sm font-medium rounded-xl border border-border hover:bg-muted/50 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </button>
          {empresa.instagram && (
            <button
              onClick={handleInstagram}
              className="h-11 px-5 flex items-center justify-center rounded-xl border border-border hover:bg-muted/50 transition-colors"
            >
              <Instagram className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Banner promocional */}
        {empresa.banner_oferta_url && (
          <div className="rounded-2xl overflow-hidden">
            <img
              src={empresa.banner_oferta_url}
              alt="Oferta"
              className="w-full h-auto"
            />
          </div>
        )}

        {/* Vídeo */}
        {empresa.video_url && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Vídeo
            </h2>
            <div className="rounded-2xl overflow-hidden bg-black">
              <video
                src={empresa.video_url}
                controls
                playsInline
                preload="metadata"
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Informações */}
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Informações
          </h2>

          {/* Contato */}
          <button
            onClick={handleCopyPhone}
            className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Telefone</p>
              <p className="font-medium">{formatWhatsApp(empresa.whatsapp)}</p>
            </div>
            <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Endereço */}
          {formatEndereco() && (
            <div className="flex items-start gap-4 p-4 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Endereço</p>
                <p className="font-medium">
                  {formatEndereco()}
                  {empresa.endereco_complemento && ` - ${empresa.endereco_complemento}`}
                </p>
                {empresa.endereco_cep && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    CEP {empresa.endereco_cep}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Instagram */}
          {empresa.instagram && (
            <button
              onClick={handleInstagram}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Instagram className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Instagram</p>
                <p className="font-medium">@{empresa.instagram}</p>
              </div>
            </button>
          )}

          {/* Horários */}
          {horariosOrdenados.length > 0 && (
            <div className="rounded-xl">
              <button
                onClick={() => setShowAllHours(!showAllHours)}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm text-muted-foreground">Horários</p>
                  <p className="font-medium">Ver todos os horários</p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    showAllHours ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showAllHours && (
                <div className="px-4 pb-4 pt-1 space-y-2">
                  {horariosOrdenados.map((h) => {
                    const isHoje =
                      diasOrdem.indexOf(h.dia) ===
                      (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
                    return (
                      <div
                        key={h.dia}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                          isHoje ? "bg-muted/70" : ""
                        }`}
                      >
                        <span
                          className={`text-sm ${
                            isHoje ? "font-medium" : "text-muted-foreground"
                          }`}
                        >
                          {h.dia}
                          {isHoje && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (hoje)
                            </span>
                          )}
                        </span>
                        <span
                          className={`text-sm ${
                            h.aberto ? "" : "text-muted-foreground"
                          }`}
                        >
                          {h.aberto ? `${h.abertura} - ${h.fechamento}` : "Fechado"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mapa */}
        {formatEndereco() && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Localização
            </h2>
            <div className="rounded-2xl overflow-hidden border border-border h-48">
              <iframe
                title="Mapa"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(
                  formatEndereco() || ""
                )}`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-8">
        <button
          onClick={handleWhatsApp}
          className="w-full flex items-center justify-center gap-2 h-12 bg-muted/80 backdrop-blur-sm text-foreground rounded-full text-sm font-medium border border-border/50 hover:bg-muted transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          Chamar no WhatsApp
        </button>
      </div>
    </div>
  );
};

export default ServicoEmpresaDetailPage;
