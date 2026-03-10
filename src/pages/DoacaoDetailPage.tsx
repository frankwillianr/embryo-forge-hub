import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Heart, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DoacaoDetailPage = () => {
  const { slug, anuncioId } = useParams<{ slug: string; anuncioId: string }>();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: anuncio, isLoading } = useQuery({
    queryKey: ["doacao-anuncio", anuncioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_doacao")
        .select(`
          *,
          categoria:rel_cidade_doacao_categoria(id, nome, icone),
          imagens:rel_cidade_doacao_imagem(id, url, ordem)
        `)
        .eq("id", anuncioId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!anuncioId,
  });

  const formatWhatsApp = (phone: string) => {
    if (phone.length === 11) {
      return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
    }
    return phone;
  };

  const handleWhatsApp = () => {
    if (!anuncio) return;
    const message = encodeURIComponent(
      `Olá! Vi sua doação "${anuncio.titulo}" e tenho interesse.`
    );
    window.open(`https://wa.me/55${anuncio.whatsapp}?text=${message}`, "_blank");
  };

  const images = anuncio?.imagens?.sort((a: any, b: any) => a.ordem - b.ordem) || [];

  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);

  const condicaoLabels: Record<string, string> = {
    novo: "Novo",
    seminovo: "Seminovo",
    usado: "Usado",
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="flex items-center gap-3 px-4 py-3 pt-safe border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        </header>
        <div className="aspect-square bg-muted animate-pulse" />
      </div>
    );
  }

  if (!anuncio) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="flex items-center gap-3 px-4 py-3 pt-safe border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}/doacoes`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Doação não encontrada</h1>
        </header>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 pt-safe border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}/doacoes`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon">
            <Heart className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="relative aspect-square bg-muted">
        {images.length > 0 ? (
          <>
            <img src={images[currentImageIndex].url} alt={anuncio.titulo} className="w-full h-full object-contain" />
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
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-8xl">🎁</span>
          </div>
        )}
      </div>

      <main className="flex-1 p-4 space-y-4 pb-24">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">Doação</Badge>
            <Badge variant="secondary">{condicaoLabels[anuncio.condicao] || anuncio.condicao}</Badge>
            {anuncio.categoria && (
              <Badge variant="outline">
                {anuncio.categoria.icone} {anuncio.categoria.nome}
              </Badge>
            )}
          </div>
        </div>

        <h1 className="text-xl font-semibold text-foreground">{anuncio.titulo}</h1>

        <p className="text-sm text-muted-foreground">
          Publicado{" "}
          {formatDistanceToNow(new Date(anuncio.created_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </p>

        {anuncio.descricao && (
          <div className="pt-4 border-t border-border">
            <h2 className="font-medium text-foreground mb-2">Descrição</h2>
            <p className="text-muted-foreground whitespace-pre-wrap">{anuncio.descricao}</p>
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <h2 className="font-medium text-foreground mb-2">Contato</h2>
          <p className="text-muted-foreground">WhatsApp: {formatWhatsApp(anuncio.whatsapp)}</p>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
        <Button className="w-full gap-2" size="lg" onClick={handleWhatsApp}>
          <MessageCircle className="h-5 w-5" />
          Chamar no WhatsApp
        </Button>
      </div>
    </div>
  );
};

export default DoacaoDetailPage;
