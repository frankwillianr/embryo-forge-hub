import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { ArrowLeft, CalendarDays, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import EventoCard from "@/components/eventos/EventoCard";

const EventosListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  useSwipeBack({ onBack: () => navigate(`/cidade/${slug}`) });
  const [searchTerm, setSearchTerm] = useState("");

  const { data: cidade } = useQuery({
    queryKey: ["cidade", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["eventos-list", cidade?.id],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("rel_cidade_eventos")
        .select("*")
        .eq("cidade_id", cidade!.id)
        .eq("ativo", true)
        .gte("data_evento", hoje)
        .order("data_evento", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!cidade?.id,
  });

  const filtered = eventos.filter((e: any) =>
    e.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.local_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="swipe-back-page" className="min-h-screen bg-background pb-4">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">Shows e Eventos</h1>
      </header>

      <div className="relative h-48 overflow-hidden border-b border-border bg-[linear-gradient(130deg,hsl(var(--primary)/0.42)_0%,hsl(var(--card))_42%,hsl(var(--background))_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,160,46,0.5),transparent_45%)]" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/45 via-black/20 to-black/45" />
        <div className="absolute left-4 right-4 bottom-4">
          <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3 backdrop-blur-md shadow-lg">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90">
              <CalendarDays className="h-3.5 w-3.5" />
              Agenda da cidade
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <h2 className="text-[22px] leading-tight font-black text-white">Próximos Eventos</h2>
              <div className="h-8 min-w-8 px-2 rounded-full bg-white/20 border border-white/30 text-xs font-semibold text-white flex items-center justify-center">
                {eventos.length}
              </div>
            </div>
            <p className="mt-1 text-xs text-white/80">
              Confira shows, festas e encontros para os próximos dias.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar evento ou local..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 py-2">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[230px] rounded-2xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((evento: any) => (
              <EventoCard
                key={evento.id}
                id={evento.id}
                cidadeSlug={slug}
                titulo={evento.titulo}
                imagem_url={evento.imagem_url}
                data_evento={evento.data_evento}
                horario={evento.horario}
                local_nome={evento.local_nome}
                categoria={evento.categoria}
                className="rounded-2xl overflow-hidden bg-card border border-border shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <CalendarDays className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">Nenhum evento encontrado</h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm ? "Tente buscar por outro termo" : "Não há eventos programados no momento"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventosListPage;
