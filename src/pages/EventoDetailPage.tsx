import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CalendarDays, Clock, MapPin, Ticket, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const EventoDetailPage = () => {
  const { slug, eventoId } = useParams<{ slug: string; eventoId: string }>();
  const navigate = useNavigate();
  useSwipeBack({ onBack: () => navigate(`/cidade/${slug}`) });

  const { data: evento, isLoading } = useQuery({
    queryKey: ["evento-detail", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_eventos")
        .select("*")
        .eq("id", eventoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!eventoId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="pt-safe px-4 pb-4">
          <div className="h-[250px] bg-muted animate-pulse rounded-2xl mb-4" />
          <div className="h-6 w-3/4 bg-muted animate-pulse rounded-lg mb-2" />
          <div className="h-4 w-1/2 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Evento não encontrado</p>
        <Button variant="ghost" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const dataObj = new Date(evento.data_evento + "T00:00:00");
  const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div id="swipe-back-page" className="min-h-screen bg-background">
      {/* Header */}
      <div className="pt-safe px-4 pb-2 flex items-center gap-3">
        <button
          onClick={() => navigate(`/cidade/${slug}`)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-semibold text-foreground text-lg truncate">Evento</h1>
      </div>

      {/* Image */}
      {evento.imagem_url ? (
        <div className="mx-4 rounded-2xl overflow-hidden">
          <img
            src={evento.imagem_url}
            alt={evento.titulo}
            className="w-full h-[250px] object-cover"
          />
        </div>
      ) : (
        <div className="mx-4 rounded-2xl h-[200px] bg-muted flex items-center justify-center">
          <CalendarDays className="h-16 w-16 text-muted-foreground/30" />
        </div>
      )}

      {/* Content */}
      <div className="px-5 py-5 space-y-5">
        {/* Category badge */}
        {evento.categoria && (
          <span className="inline-block bg-accent text-accent-foreground rounded-full px-3 py-1 text-xs font-semibold uppercase">
            {evento.categoria}
          </span>
        )}

        <h2 className="text-2xl font-bold text-foreground leading-tight">{evento.titulo}</h2>

        {/* Info cards */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground capitalize">{dataFormatada}</p>
              {evento.horario && (
                <p className="text-xs text-muted-foreground">Horário: {evento.horario}</p>
              )}
            </div>
          </div>

          {evento.local_nome && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{evento.local_nome}</p>
                {evento.local_endereco && (
                  <p className="text-xs text-muted-foreground">{evento.local_endereco}</p>
                )}
              </div>
            </div>
          )}
        </div>


        {/* Description */}
        {evento.descricao && (
          <div>
            <h3 className="font-semibold text-foreground mb-2">Sobre o evento</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {evento.descricao}
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default EventoDetailPage;
