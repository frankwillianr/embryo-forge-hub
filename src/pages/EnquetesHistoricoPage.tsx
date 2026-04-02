import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Search, Vote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type EnqueteHistoricoItem = {
  id: string;
  pergunta: string;
  data_inicio: string;
  data_fim: string;
  status: "rascunho" | "ativa" | "encerrada" | "cancelada";
};

type ResultadoOpcao = {
  opcao_id: string;
  texto: string;
  votos: number;
  percentual: number;
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusLabel: Record<EnqueteHistoricoItem["status"], string> = {
  rascunho: "Rascunho",
  ativa: "Ativa",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

const getDisplayStatus = (item: EnqueteHistoricoItem): EnqueteHistoricoItem["status"] => {
  const fim = new Date(item.data_fim).getTime();
  if (!Number.isNaN(fim) && fim < Date.now()) return "encerrada";
  return item.status;
};

const EnquetesHistoricoPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  useSwipeBack({ onBack: () => navigate(`/cidade/${slug}`) });

  const { data: cidade } = useQuery({
    queryKey: ["cidade-enquetes-historico", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;

      // Compatibilidade com links antigos que usam "/governador-valadares".
      if (slug === "governador-valadares") {
        const fallback = await supabase
          .from("cidade")
          .select("id")
          .eq("slug", "gv")
          .maybeSingle();
        if (fallback.error) throw fallback.error;
        return fallback.data;
      }

      return null;
    },
    enabled: !!slug,
  });

  const { data: enquetes = [], isLoading, error } = useQuery({
    queryKey: ["enquetes-historico", cidade?.id],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const baseSelect = "id, pergunta, data_inicio, data_fim, status";

      const [byStatusRes, byDateRes] = await Promise.all([
        supabase
          .from("rel_cidade_enquete")
          .select(baseSelect)
          .eq("cidade_id", cidade!.id)
          .in("status", ["encerrada", "cancelada"]),
        supabase
          .from("rel_cidade_enquete")
          .select(baseSelect)
          .eq("cidade_id", cidade!.id)
          .lt("data_fim", nowIso),
      ]);

      if (byStatusRes.error) throw byStatusRes.error;
      if (byDateRes.error) throw byDateRes.error;

      const merged = [...(byStatusRes.data || []), ...(byDateRes.data || [])] as EnqueteHistoricoItem[];
      const unique = Array.from(new Map(merged.map((item) => [item.id, item])).values());
      unique.sort((a, b) => new Date(b.data_fim).getTime() - new Date(a.data_fim).getTime());
      return unique;
    },
    enabled: !!cidade?.id,
  });

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return enquetes;
    return enquetes.filter((item) => item.pergunta?.toLowerCase().includes(term));
  }, [enquetes, searchTerm]);

  const { data: rankingByEnquete = {} } = useQuery({
    queryKey: ["enquetes-historico-ranking", filtered.map((item) => item.id).join(",")],
    queryFn: async () => {
      const pairs = await Promise.all(
        filtered.map(async (item) => {
          const { data, error } = await supabase.rpc("enquete_resultado", { p_enquete_id: item.id });
          if (error || !data) return [item.id, [] as ResultadoOpcao[]] as const;
          const ranking = (data as ResultadoOpcao[])
            .sort((a, b) => Number(b.votos || 0) - Number(a.votos || 0))
            .slice(0, 5);
          return [item.id, ranking] as const;
        })
      );
      return Object.fromEntries(pairs) as Record<string, ResultadoOpcao[]>;
    },
    enabled: filtered.length > 0,
  });

  return (
    <div id="swipe-back-page" className="min-h-screen bg-background pb-4">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">Historico de Enquetes</h1>
      </header>

      <div className="relative h-40 overflow-hidden border-b border-border bg-[linear-gradient(130deg,hsl(var(--primary)/0.42)_0%,hsl(var(--card))_42%,hsl(var(--background))_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,160,46,0.45),transparent_45%)]" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/45 via-black/20 to-black/45" />
        <div className="absolute left-4 right-4 bottom-4">
          <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3 backdrop-blur-md shadow-lg">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90">
              <CalendarDays className="h-3.5 w-3.5" />
              Enquetes encerradas
            </div>
            <h2 className="mt-2 text-[22px] leading-tight font-black text-white">Todas as enquetes que ja passaram</h2>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pela pergunta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="px-4 pb-4">
        {error ? (
          <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            Nao foi possivel carregar o historico de enquetes no momento.
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[112px] rounded-2xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((item) => (
              <article key={item.id} className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Vote className="h-3.5 w-3.5" />
                    {statusLabel[getDisplayStatus(item)] || "Encerrada"}
                  </div>
                </div>

                <h3 className="text-sm font-semibold leading-snug text-foreground">{item.pergunta}</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inicio</p>
                    <p className="mt-0.5 text-xs text-foreground">{formatDateTime(item.data_inicio)}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fim</p>
                    <p className="mt-0.5 text-xs text-foreground">{formatDateTime(item.data_fim)}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    5 opcoes mais votadas
                  </p>
                  {(rankingByEnquete[item.id] || []).length > 0 ? (
                    (rankingByEnquete[item.id] || []).map((opcao, index) => (
                      <div
                        key={opcao.opcao_id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5"
                      >
                        <p className="min-w-0 flex-1 text-xs text-foreground">
                          <span className="mr-1 text-muted-foreground">#{index + 1}</span>
                          <span className="break-words">{opcao.texto}</span>
                        </p>
                        <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-foreground">
                          {opcao.votos} ({Number(opcao.percentual || 0).toFixed(1)}%)
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem votos registrados.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-4 py-12 text-center">
            <Vote className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <h3 className="text-sm font-semibold text-foreground">Nenhuma enquete encontrada</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {searchTerm ? "Tente ajustar o termo de busca." : "Nao ha enquetes encerradas para esta cidade."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnquetesHistoricoPage;
