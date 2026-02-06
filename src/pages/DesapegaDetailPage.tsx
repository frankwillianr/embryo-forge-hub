import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Share2, Heart, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DesapegaDetailPage = () => {
  const { slug, anuncioId } = useParams<{ slug: string; anuncioId: string }>();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: anuncio, isLoading } = useQuery({
    queryKey: ["desapega-anuncio", anuncioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_desapega")
        .select(`
          *,
          categoria:rel_cidade_desapega_categoria(id, nome, icone),
          imagens:rel_cidade_desapega_imagem(id, url, ordem)
        `)
        .eq("id", anuncioId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!anuncioId,
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatWhatsApp = (phone: string) => {
    if (phone.length === 11) {
      return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
    }
    return phone;
  };

  const handleWhatsApp = () => {
    if (!anuncio) return;
    const message = encodeURIComponent(
      `Olá! Vi seu anúncio "${anuncio.titulo}" no Desapega e tenho interesse.`
    );
    window.open(`https://wa.me/55${anuncio.whatsapp}?text=${message}`, "_blank");
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: anuncio?.titulo,
        text: `Confira: ${anuncio?.titulo} por ${formatPrice(anuncio?.preco || 0)}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const images = anuncio?.imagens?.sort((a, b) => a.ordem - b.ordem) || [];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const condicaoLabels: Record<string, string> = {
    novo: "Novo",
    seminovo: "Seminovo",
    usado: "Usado",
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        </header>
        <div className="aspect-square bg-muted animate-pulse" />
        <div className="p-4 space-y-4">
          <div className="h-8 w-24 bg-muted animate-pulse rounded" />
          <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!anuncio) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="flex items-center gap-3 p-4 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}/desapega`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Anúncio não encontrado</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Este anúncio não existe ou foi removido.</p>
            <Button onClick={() => navigate(`/cidade/${slug}/desapega`)}>
              Ver outros anúncios
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between p-4 border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/cidade/${slug}/desapega`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={handleShare}>
            <Share2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Heart className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Galeria de imagens */}
      <div className="relative aspect-square bg-muted">
        {images.length > 0 ? (
          <>
            <img
              src={images[currentImageIndex].url}
              alt={anuncio.titulo}
              className="w-full h-full object-contain"
            />
            
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>

                {/* Indicadores */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentImageIndex
                          ? "bg-primary"
                          : "bg-background/60"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-8xl">📦</span>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <main className="flex-1 p-4 space-y-4 pb-24">
        {/* Preço e badges */}
        <div className="flex items-start justify-between gap-4">
          <p className="text-2xl font-bold text-primary">
            {formatPrice(anuncio.preco)}
          </p>
          <div className="flex gap-2">
            <Badge variant="secondary">
              {condicaoLabels[anuncio.condicao] || anuncio.condicao}
            </Badge>
            {anuncio.categoria && (
              <Badge variant="outline">
                {anuncio.categoria.icone} {anuncio.categoria.nome}
              </Badge>
            )}
          </div>
        </div>

        {/* Título */}
        <h1 className="text-xl font-semibold text-foreground">
          {anuncio.titulo}
        </h1>

        {/* Data */}
        <p className="text-sm text-muted-foreground">
          Publicado{" "}
          {formatDistanceToNow(new Date(anuncio.created_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </p>

        {/* Descrição */}
        {anuncio.descricao && (
          <div className="pt-4 border-t border-border">
            <h2 className="font-medium text-foreground mb-2">Descrição</h2>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {anuncio.descricao}
            </p>
          </div>
        )}

        {/* Vendedor */}
        <div className="pt-4 border-t border-border">
          <h2 className="font-medium text-foreground mb-2">Contato</h2>
          <p className="text-muted-foreground">
            WhatsApp: {formatWhatsApp(anuncio.whatsapp)}
          </p>
        </div>
      </main>

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
        <Button className="w-full gap-2" size="lg" onClick={handleWhatsApp}>
          <MessageCircle className="h-5 w-5" />
          Chamar no WhatsApp
        </Button>
      </div>
    </div>
  );
};

export default DesapegaDetailPage;
