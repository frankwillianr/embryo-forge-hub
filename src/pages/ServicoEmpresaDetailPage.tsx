import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Share2,
  Heart,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Instagram,
  Phone,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HorarioFuncionamento {
  dia: string;
  aberto: boolean;
  abertura: string;
  fechamento: string;
}

const diasAbreviados: Record<string, string> = {
  Segunda: "Seg",
  Terça: "Ter",
  Quarta: "Qua",
  Quinta: "Qui",
  Sexta: "Sex",
  Sábado: "Sáb",
  Domingo: "Dom",
};

const ServicoEmpresaDetailPage = () => {
  const { slug, categoriaId, empresaId } = useParams<{
    slug: string;
    categoriaId: string;
    empresaId: string;
  }>();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAllHours, setShowAllHours] = useState(false);

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
    }
  };

  const images = empresa?.fotos?.sort((a, b) => a.ordem - b.ordem) || [];
  const horarios = (empresa?.horario_funcionamento as HorarioFuncionamento[]) || [];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Verificar se está aberto agora
  const getStatusHoje = () => {
    const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const hoje = dias[new Date().getDay()];
    const horarioHoje = horarios.find((h) => h.dia === hoje);

    if (!horarioHoje || !horarioHoje.aberto) {
      return { aberto: false, texto: "Fechado hoje" };
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
        texto: `Aberto · Fecha às ${horarioHoje.fechamento}`,
      };
    } else if (horaAtual < abertura) {
      return {
        aberto: false,
        texto: `Fechado · Abre às ${horarioHoje.abertura}`,
      };
    } else {
      return { aberto: false, texto: "Fechado" };
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

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="aspect-[4/3] bg-muted animate-pulse" />
        <div className="p-5 space-y-4">
          <div className="h-8 w-3/4 bg-muted animate-pulse rounded-lg" />
          <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/cidade/${slug}/servicos/${categoriaId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Não encontrado</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Esta empresa não existe ou foi removida.
            </p>
            <Button onClick={() => navigate(`/cidade/${slug}/servicos/${categoriaId}`)}>
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header flutuante sobre a imagem */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 pt-safe">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full bg-background/80 backdrop-blur-sm shadow-lg"
          onClick={() => navigate(`/cidade/${slug}/servicos/${categoriaId}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full bg-background/80 backdrop-blur-sm shadow-lg"
            onClick={handleShare}
          >
            <Share2 className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full bg-background/80 backdrop-blur-sm shadow-lg"
          >
            <Heart className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Carrossel de fotos */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/20 to-primary/5">
        {images.length > 0 ? (
          <>
            <img
              src={images[currentImageIndex].url}
              alt={empresa.nome}
              className="w-full h-full object-cover"
            />

            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-lg transition-transform active:scale-95"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-lg transition-transform active:scale-95"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>

                {/* Indicadores */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-background/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentImageIndex
                          ? "bg-primary w-4"
                          : "bg-foreground/40"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <span className="text-8xl block mb-2">🏢</span>
              <span className="text-muted-foreground text-sm">Sem fotos</span>
            </div>
          </div>
        )}
      </div>

      {/* Conteúdo principal */}
      <main className="flex-1 -mt-6 relative">
        <div className="bg-background rounded-t-3xl pt-6 pb-28">
          {/* Banner de oferta */}
          {empresa.banner_oferta_url && (
            <div className="px-5 mb-5">
              <div className="rounded-2xl overflow-hidden shadow-lg">
                <img
                  src={empresa.banner_oferta_url}
                  alt="Oferta especial"
                  className="w-full h-24 object-cover"
                />
              </div>
            </div>
          )}

          {/* Nome e status */}
          <div className="px-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold text-foreground leading-tight">
                {empresa.nome}
              </h1>
              <Badge
                variant={statusHoje.aberto ? "default" : "secondary"}
                className={`flex-shrink-0 ${
                  statusHoje.aberto ? "bg-green-500 hover:bg-green-500" : ""
                }`}
              >
                {statusHoje.aberto ? "Aberto" : "Fechado"}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {statusHoje.texto}
            </p>

            {/* Descrição */}
            {empresa.descricao && (
              <p className="text-foreground/80 leading-relaxed">
                {empresa.descricao}
              </p>
            )}
          </div>

          {/* Ações rápidas */}
          <div className="px-5 mt-6">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleWhatsApp}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-green-500/10 text-green-600 transition-transform active:scale-95"
              >
                <MessageCircle className="h-6 w-6" />
                <span className="text-xs font-medium">WhatsApp</span>
              </button>

              {empresa.instagram ? (
                <button
                  onClick={handleInstagram}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-pink-500/10 text-pink-600 transition-transform active:scale-95"
                >
                  <Instagram className="h-6 w-6" />
                  <span className="text-xs font-medium">Instagram</span>
                </button>
              ) : (
                <button
                  onClick={handleShare}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted text-muted-foreground transition-transform active:scale-95"
                >
                  <Share2 className="h-6 w-6" />
                  <span className="text-xs font-medium">Compartilhar</span>
                </button>
              )}
            </div>
          </div>

          {/* Informações */}
          <div className="px-5 mt-6 space-y-4">
            {/* Endereço */}
            {formatEndereco() && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/50">
                <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Endereço</p>
                  <p className="text-sm text-muted-foreground">
                    {formatEndereco()}
                    {empresa.endereco_complemento && (
                      <span> - {empresa.endereco_complemento}</span>
                    )}
                  </p>
                  {empresa.endereco_cep && (
                    <p className="text-xs text-muted-foreground mt-1">
                      CEP: {empresa.endereco_cep}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Telefone */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/50">
              <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  ({empresa.whatsapp.slice(0, 2)}) {empresa.whatsapp.slice(2, 7)}-
                  {empresa.whatsapp.slice(7)}
                </p>
              </div>
            </div>

            {/* Instagram */}
            {empresa.instagram && (
              <button
                onClick={handleInstagram}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-muted/50 text-left"
              >
                <Instagram className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">Instagram</p>
                  <p className="text-sm text-muted-foreground">
                    @{empresa.instagram}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            {/* Horários */}
            {horarios.length > 0 && (
              <div className="p-4 rounded-2xl bg-muted/50">
                <button
                  onClick={() => setShowAllHours(!showAllHours)}
                  className="w-full flex items-center gap-3"
                >
                  <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-foreground">
                      Horário de funcionamento
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {showAllHours ? "Toque para fechar" : "Toque para ver todos"}
                    </p>
                  </div>
                  <ChevronRight
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      showAllHours ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {showAllHours && (
                  <div className="mt-4 space-y-2 border-t border-border pt-4">
                    {horarios.map((h) => (
                      <div
                        key={h.dia}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {diasAbreviados[h.dia] || h.dia}
                        </span>
                        <span
                          className={
                            h.aberto ? "text-foreground" : "text-muted-foreground"
                          }
                        >
                          {h.aberto
                            ? `${h.abertura} - ${h.fechamento}`
                            : "Fechado"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mapa */}
            {formatEndereco() && (
              <div className="mt-6">
                <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  Localização
                </h3>
                <div className="rounded-2xl overflow-hidden border border-border">
                  <iframe
                    title="Localização"
                    width="100%"
                    height="200"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(
                      formatEndereco() || ""
                    )}`}
                  />
                </div>
                <button
                  onClick={() => {
                    window.open(
                      `https://maps.google.com/?q=${encodeURIComponent(formatEndereco() || "")}`,
                      "_blank"
                    );
                  }}
                  className="w-full mt-3 text-sm text-primary font-medium"
                >
                  Abrir no Google Maps →
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
        <Button
          className="w-full gap-2 h-14 text-base rounded-2xl shadow-lg"
          size="lg"
          onClick={handleWhatsApp}
        >
          <MessageCircle className="h-5 w-5" />
          Chamar no WhatsApp
        </Button>
      </div>
    </div>
  );
};

export default ServicoEmpresaDetailPage;
