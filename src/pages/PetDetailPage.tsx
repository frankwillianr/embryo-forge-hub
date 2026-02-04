import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Calendar, Phone, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Pet } from "@/types/pets";

const especieLabels: Record<string, string> = {
  cachorro: "🐕 Cachorro",
  gato: "🐱 Gato",
  passaro: "🐦 Pássaro",
  outro: "🐾 Outro",
};

const PetDetailPage = () => {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const navigate = useNavigate();

  const { data: pet, isLoading } = useQuery({
    queryKey: ["pet", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_pets")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Pet;
    },
    enabled: !!id,
  });

  const handleWhatsApp = () => {
    if (!pet) return;
    const message = encodeURIComponent(
      `Olá! Vi o anúncio do pet "${pet.nome}" (${pet.status}) no app e gostaria de mais informações.`
    );
    const phone = pet.contato_whatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-sm">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Skeleton className="h-5 w-32" />
        </header>
        <div className="p-4 space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Pet não encontrado</p>
          <Button variant="link" onClick={() => navigate(`/cidade/${slug}/pets`)}>
            Voltar para a lista
          </Button>
        </div>
      </div>
    );
  }

  const dataOcorrencia = new Date(pet.data_ocorrencia);
  const dataFormatada = dataOcorrencia.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold truncate">{pet.nome}</h1>
      </header>

      {/* Foto */}
      <div className="aspect-square bg-muted/30 relative">
        {pet.foto_url ? (
          <img
            src={pet.foto_url}
            alt={pet.nome}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-8xl">
            {pet.especie === "cachorro" ? "🐕" : pet.especie === "gato" ? "🐱" : "🐾"}
          </div>
        )}
        <Badge
          variant={pet.status === "perdido" ? "destructive" : "default"}
          className="absolute top-4 right-4 text-sm"
        >
          {pet.status === "perdido" ? "PERDIDO" : "ENCONTRADO"}
        </Badge>
      </div>

      {/* Info */}
      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{pet.nome}</h2>
          <p className="text-muted-foreground">
            {especieLabels[pet.especie]} · {pet.cor}
            {pet.raca && ` · ${pet.raca}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            <span>Visto em: {pet.local_visto}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            <span>{dataFormatada}</span>
          </div>
        </div>

        {pet.descricao && (
          <div className="pt-2">
            <h3 className="font-semibold text-foreground mb-2">Descrição</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {pet.descricao}
            </p>
          </div>
        )}

        <div className="pt-2 border-t border-border">
          <h3 className="font-semibold text-foreground mb-2">Contato</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{pet.contato_nome}</span>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <Button
          onClick={handleWhatsApp}
          className="w-full h-12 bg-green-600 hover:bg-green-700 text-white"
        >
          <MessageCircle className="h-5 w-5 mr-2" />
          Entrar em Contato
        </Button>
      </div>
    </div>
  );
};

export default PetDetailPage;
