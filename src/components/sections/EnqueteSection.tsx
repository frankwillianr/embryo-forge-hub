import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Vote, TrendingUp, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EnqueteSectionProps {
  cidadeSlug?: string;
}

type Enquete = {
  id: string;
  cidade_id: string;
  pergunta: string;
  data_inicio: string;
  data_fim: string;
  status: "rascunho" | "ativa" | "encerrada" | "cancelada";
};

type EnqueteOpcao = {
  id: string;
  enquete_id: string;
  texto: string;
  ordem: number;
};

type ResultadoOpcao = {
  opcao_id: string;
  texto: string;
  votos: number;
  percentual: number;
};

const formatRemainingCompact = (ms: number) => {
  if (ms <= 0) return "Encerrando hoje";
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const EnqueteSection = ({ cidadeSlug }: EnqueteSectionProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [now, setNow] = useState(Date.now());
  const [localVotedOptionId, setLocalVotedOptionId] = useState<string | null>(null);
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [fullRankingModalOpen, setFullRankingModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: cidade } = useQuery({
    queryKey: ["cidade-id-enquete-home", cidadeSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cidadeSlug,
  });

  const { data: enquete, isLoading: enqueteLoading } = useQuery({
    queryKey: ["home-enquete-ativa", cidade?.id],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("rel_cidade_enquete")
        .select("*")
        .eq("cidade_id", cidade!.id)
        .eq("status", "ativa")
        .lte("data_inicio", nowIso)
        .gte("data_fim", nowIso)
        .order("data_fim", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as Enquete | null;
    },
    enabled: !!cidade?.id,
  });

  const { data: opcoes = [] } = useQuery({
    queryKey: ["home-enquete-opcoes", enquete?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_enquete_opcao")
        .select("*")
        .eq("enquete_id", enquete!.id)
        .order("ordem");
      if (error) throw error;
      return (data || []) as EnqueteOpcao[];
    },
    enabled: !!enquete?.id,
  });

  const { data: resultados = [] } = useQuery({
    queryKey: ["home-enquete-resultado", enquete?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("enquete_resultado", { p_enquete_id: enquete!.id });
      if (error) throw error;
      return (data || []) as ResultadoOpcao[];
    },
    enabled: !!enquete?.id,
  });

  const { data: meuVoto } = useQuery({
    queryKey: ["home-enquete-meu-voto", enquete?.id, user?.id],
    queryFn: async () => {
      if (!user || !enquete?.id) return null;
      const { data, error } = await supabase
        .from("rel_cidade_enquete_voto")
        .select("opcao_id")
        .eq("enquete_id", enquete.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return null;
      return data?.opcao_id || null;
    },
    enabled: !!user?.id && !!enquete?.id,
  });

  useEffect(() => {
    if (meuVoto) setLocalVotedOptionId(meuVoto);
  }, [meuVoto]);

  const ranking = useMemo(() => {
    if (!opcoes.length) return [] as ResultadoOpcao[];

    if (resultados.length > 0) {
      return [...resultados].sort((a, b) => b.votos - a.votos);
    }

    return opcoes.map((opcao) => ({
      opcao_id: opcao.id,
      texto: opcao.texto,
      votos: 0,
      percentual: 0,
    }));
  }, [opcoes, resultados]);

  const opcoesOrdenadas = useMemo(
    () => [...opcoes].sort((a, b) => a.texto.localeCompare(b.texto, "pt-BR")),
    [opcoes],
  );

  const opcoesFiltradas = useMemo(() => {
    const term = normalizeText(searchTerm.trim());
    if (!term) return opcoesOrdenadas;
    return opcoesOrdenadas.filter((opcao) => normalizeText(opcao.texto).includes(term));
  }, [opcoesOrdenadas, searchTerm]);

  const totalVotos = useMemo(
    () => ranking.reduce((acc, item) => acc + Number(item.votos || 0), 0),
    [ranking],
  );

  const topVotes = ranking[0]?.votos || 0;
  const votedOptionId = localVotedOptionId || null;
  const canVote = !!enquete;
  const timeLeftMs = enquete ? Math.max(0, new Date(enquete.data_fim).getTime() - now) : 0;

  const voteMutation = useMutation({
    mutationFn: async (opcaoId: string) => {
      if (!enquete || !cidade?.id) throw new Error("Enquete indisponivel");
      if (!user) {
        const redirect = encodeURIComponent(`/cidade/${cidadeSlug}`);
        navigate(`/cidade/${cidadeSlug}/auth?redirect=${redirect}`);
        throw new Error("login-required");
      }

      if (votedOptionId) {
        const { error: deleteError } = await supabase
          .from("rel_cidade_enquete_voto")
          .delete()
          .eq("enquete_id", enquete.id)
          .eq("user_id", user.id);
        if (deleteError) throw deleteError;
      }

      const { error: insertError } = await supabase
        .from("rel_cidade_enquete_voto")
        .insert({
          enquete_id: enquete.id,
          opcao_id: opcaoId,
          cidade_id: cidade.id,
          user_id: user.id,
        });
      if (insertError) throw insertError;
      return opcaoId;
    },
    onSuccess: (opcaoId) => {
      const hadVoteBefore = !!votedOptionId;
      setLocalVotedOptionId(opcaoId);
      setVoteModalOpen(false);
      toast.success(hadVoteBefore ? "Voto atualizado!" : "Voto computado!");
      queryClient.invalidateQueries({ queryKey: ["home-enquete-resultado"] });
      queryClient.invalidateQueries({ queryKey: ["home-enquete-meu-voto"] });
    },
    onError: (error: any) => {
      if (error?.message === "login-required") return;
      console.error("[Enquete] erro ao registrar voto", error);
      toast.error("Nao foi possivel registrar seu voto.");
    },
  });

  const handleOpenVoteModal = () => {
    if (!enquete) return;
    if (!user) {
      const redirect = encodeURIComponent(`/cidade/${cidadeSlug}`);
      navigate(`/cidade/${cidadeSlug}/auth?redirect=${redirect}`);
      return;
    }
    setSelectedOptionId(votedOptionId || null);
    setSearchTerm("");
    setVoteModalOpen(true);
  };

  if (enqueteLoading || !enquete) return null;

  return (
    <section className="px-4 py-2">
      <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1a1a2e]/90 px-3 py-1 text-[11px] font-semibold text-white">
            <Vote className="h-3.5 w-3.5" />
            Enquete da semana
          </div>
          <Button
            size="sm"
            disabled={!canVote || voteMutation.isPending}
            onClick={handleOpenVoteModal}
            variant="outline"
            className="h-8 rounded-full border-border/70 bg-transparent px-3 text-xs font-medium text-foreground shadow-none hover:bg-muted/50"
          >
            {votedOptionId ? "Alterar voto" : "Votar"}
          </Button>
        </div>

        <h3 className="text-sm font-semibold leading-snug text-foreground">{enquete.pergunta}</h3>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Ranking Top 3
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => setFullRankingModalOpen(true)}
            >
              Ver votacao completa
            </Button>
          </div>

          {ranking.slice(0, 3).map((item, index) => {
            const pct = topVotes > 0 ? (item.votos / topVotes) * 100 : 0;
            const isMine = votedOptionId === item.opcao_id;
            return (
              <div key={item.opcao_id} className="relative overflow-hidden rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                <div
                  className="absolute inset-y-0 left-0 bg-primary/12 transition-all duration-700"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 text-[10px] font-normal text-foreground">
                    <span className="mr-1.5 text-xs text-muted-foreground">#{index + 1}</span>
                    <span className="inline-block max-w-full break-words align-bottom">{item.texto}</span>
                    {isMine ? <span className="ml-2 text-[11px] text-primary">(Seu voto)</span> : null}
                  </div>
                  <div className="shrink-0 whitespace-nowrap pl-1 text-xs font-semibold text-foreground">
                    {item.votos} ({Number(item.percentual || 0).toFixed(1)}%)
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {totalVotos} {totalVotos === 1 ? "voto" : "votos"}
            </span>
            <span>{formatRemainingCompact(timeLeftMs)}</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!cidadeSlug}
            className="mt-1 w-full rounded-full border-border/70 bg-transparent text-xs font-medium text-foreground shadow-none hover:bg-muted/50"
            onClick={() => cidadeSlug && navigate(`/cidade/${cidadeSlug}/enquetes`)}
          >
            Ver todas enquetes
          </Button>
        </div>
      </div>

      <Dialog open={voteModalOpen} onOpenChange={setVoteModalOpen}>
        <DialogContent
          className="overflow-hidden p-3 flex flex-col gap-2"
          style={{
            width: "min(calc(100vw - 1rem), 600px)",
            maxWidth: "600px",
            minWidth: 0,
            height: "min(72vh, 560px)",
            maxHeight: "72vh",
          }}
        >
          <DialogHeader>
            <DialogTitle>Escolha uma alternativa</DialogTitle>
          </DialogHeader>

          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar bairro..."
              className="pl-9"
            />
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-2 pr-1 border border-border/60 rounded-lg p-2"
            style={{ maxHeight: "100%" }}
          >
            {opcoesFiltradas.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
                Nenhuma alternativa encontrada.
              </div>
            ) : (
              opcoesFiltradas.map((opcao) => {
                const selected = selectedOptionId === opcao.id;
                return (
                  <button
                    key={opcao.id}
                    type="button"
                    onClick={() => setSelectedOptionId(opcao.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left text-[13px] font-normal transition-all ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    {opcao.texto}
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-1 flex justify-end">
            <Button
              disabled={!selectedOptionId || voteMutation.isPending}
              onClick={() => selectedOptionId && voteMutation.mutate(selectedOptionId)}
              size="sm"
            >
              {voteMutation.isPending ? "Enviando..." : "Confirmar voto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fullRankingModalOpen} onOpenChange={setFullRankingModalOpen}>
        <DialogContent
          className="overflow-hidden p-3 flex flex-col gap-2"
          style={{
            width: "min(calc(100vw - 1rem), 600px)",
            maxWidth: "600px",
            minWidth: 0,
            height: "min(72vh, 560px)",
            maxHeight: "72vh",
          }}
        >
          <DialogHeader>
            <DialogTitle>Votacao completa</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-2 pr-1">
            {ranking.map((item, index) => {
              const isMine = votedOptionId === item.opcao_id;
              return (
                <div
                  key={item.opcao_id}
                  className="rounded-xl border border-border/60 bg-background/70 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 text-[10px] font-normal text-foreground">
                      <span className="mr-1.5 text-xs text-muted-foreground">#{index + 1}</span>
                      <span className="inline-block max-w-full break-words align-bottom">{item.texto}</span>
                      {isMine ? <span className="ml-2 text-[11px] text-primary">(Seu voto)</span> : null}
                    </div>
                    <div className="shrink-0 whitespace-nowrap pl-1 text-xs font-semibold text-foreground">
                      {item.votos} ({Number(item.percentual || 0).toFixed(1)}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default EnqueteSection;
