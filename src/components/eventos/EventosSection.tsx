import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, ChevronRight } from "lucide-react";
import EventoCard from "./EventoCard";

interface EventosSectionProps {
  cidadeSlug?: string;
}

const EventosSection = ({ cidadeSlug }: EventosSectionProps) => {
  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["eventos-home", cidadeSlug],
    queryFn: async () => {
      // Get cidade id
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return [];

      const hoje = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("rel_cidade_eventos")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .eq("ativo", true)
        .gte("data_evento", hoje)
        .order("data_evento", { ascending: true })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!cidadeSlug,
  });

  if (isLoading) {
    return (
      <div className="px-5 py-4 space-y-3">
        <div className="h-5 w-40 bg-muted animate-pulse rounded-lg" />
        <div className="flex gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="min-w-[220px] h-[230px] bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (eventos.length === 0) return null;

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-accent" />
          <h2 className="font-bold text-foreground text-base">Shows e Eventos</h2>
        </div>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-5 pb-2">
        {eventos.map((evento: any) => (
          <EventoCard
            key={evento.id}
            titulo={evento.titulo}
            imagem_url={evento.imagem_url}
            data_evento={evento.data_evento}
            horario={evento.horario}
            local_nome={evento.local_nome}
            preco={evento.preco}
            categoria={evento.categoria}
          />
        ))}
      </div>
    </div>
  );
};

export default EventosSection;
