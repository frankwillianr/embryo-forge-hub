import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, FileText, Image, ArrowRight, Play, RotateCcw,
  CheckCircle2, Loader2, Circle, Plus, Trash2, Globe, Rss,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface AdminCidadeScrapingNoticiasV2Props {
  cidadeId: string;
}

type AgentStatus = "idle" | "running" | "done" | "waiting";

interface Agent {
  id: number;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  status: AgentStatus;
}

interface FonteV2 {
  id: string;
  cidade_id: string;
  nome: string;
  url: string;
  tipo: "rss" | "html" | "auto";
  ativo: boolean;
  ordem: number;
}

const TIPO_LABELS: Record<string, string> = { rss: "RSS", html: "HTML", auto: "Auto" };
const TIPO_COLORS: Record<string, string> = {
  rss: "bg-orange-100 text-orange-700",
  html: "bg-blue-100 text-blue-700",
  auto: "bg-gray-100 text-gray-600",
};

// ─── Pipeline agents config ───────────────────────────────────────────────────

const buildAgents = (): Agent[] => [
  {
    id: 1, label: "Agente Buscador",
    description: "Busca noticias da cidade nas fontes cadastradas",
    icon: Search, color: "text-blue-600", bgColor: "bg-blue-50",
    borderColor: "border-blue-200", status: "idle",
  },
  {
    id: 2, label: "Agente de Texto",
    description: "Reescreve titulo e descricao com linguagem local",
    icon: FileText, color: "text-violet-600", bgColor: "bg-violet-50",
    borderColor: "border-violet-200", status: "waiting",
  },
  {
    id: 3, label: "Agente de Imagem",
    description: "Gera ou seleciona imagem adequada para a noticia",
    icon: Image, color: "text-emerald-600", bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200", status: "waiting",
  },
];

const statusConfig: Record<AgentStatus, { label: string; icon: React.ElementType; className: string }> = {
  idle:    { label: "Aguardando inicio",          icon: Circle,       className: "text-gray-400" },
  waiting: { label: "Aguardando agente anterior", icon: Circle,       className: "text-gray-300" },
  running: { label: "Executando...",              icon: Loader2,      className: "text-amber-500 animate-spin" },
  done:    { label: "Concluido",                  icon: CheckCircle2, className: "text-emerald-500" },
};

// ─── Component ────────────────────────────────────────────────────────────────

const AdminCidadeScrapingNoticiasV2 = ({ cidadeId }: AdminCidadeScrapingNoticiasV2Props) => {
  const queryClient = useQueryClient();

  // Pipeline state
  const [agents, setAgents] = useState<Agent[]>(buildAgents());
  const [running, setRunning] = useState(false);

  // Fontes panel
  const [fontesOpen, setFontesOpen] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [novoUrl, setNovoUrl] = useState("");
  const [novoTipo, setNovoTipo] = useState<"rss" | "html" | "auto">("auto");
  const [saving, setSaving] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // ── Fontes query ─────────────────────────────────────────────────────────

  const { data: fontes = [], isLoading: loadingFontes } = useQuery<FonteV2[]>({
    queryKey: ["cidade_scraping_fonte_v2", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade_scraping_fonte_v2")
        .select("*")
        .eq("cidade_id", cidadeId)
        .order("ordem");
      if (error) throw error;
      return data as FonteV2[];
    },
    enabled: !!cidadeId,
  });

  // ── Add fonte ─────────────────────────────────────────────────────────────

  const addFonte = async () => {
    setErroForm(null);
    if (!novoNome.trim()) return setErroForm("Informe o nome da fonte");
    if (!novoUrl.trim()) return setErroForm("Informe a URL");
    try {
      new URL(novoUrl);
    } catch {
      return setErroForm("URL invalida");
    }

    setSaving(true);
    const { error } = await supabase.from("cidade_scraping_fonte_v2").insert({
      cidade_id: cidadeId,
      nome: novoNome.trim(),
      url: novoUrl.trim(),
      tipo: novoTipo,
      ativo: true,
      ordem: (fontes.length + 1) * 10,
    });
    setSaving(false);

    if (error) return setErroForm(error.message);
    setNovoNome("");
    setNovoUrl("");
    setNovoTipo("auto");
    queryClient.invalidateQueries({ queryKey: ["cidade_scraping_fonte_v2", cidadeId] });
  };

  // ── Delete fonte ──────────────────────────────────────────────────────────

  const deleteFonte = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cidade_scraping_fonte_v2")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["cidade_scraping_fonte_v2", cidadeId] }),
  });

  // ── Toggle ativo ──────────────────────────────────────────────────────────

  const toggleAtivo = async (fonte: FonteV2) => {
    await supabase
      .from("cidade_scraping_fonte_v2")
      .update({ ativo: !fonte.ativo })
      .eq("id", fonte.id);
    queryClient.invalidateQueries({ queryKey: ["cidade_scraping_fonte_v2", cidadeId] });
  };

  // ── Pipeline simulation ───────────────────────────────────────────────────

  const simulatePipeline = () => {
    setRunning(true);
    setAgents((prev) => prev.map((a, i) => ({ ...a, status: i === 0 ? "running" : "waiting" })));
    setTimeout(() => {
      setAgents((prev) => prev.map((a, i) => ({ ...a, status: i === 0 ? "done" : i === 1 ? "running" : "waiting" })));
    }, 1800);
    setTimeout(() => {
      setAgents((prev) => prev.map((a, i) => ({ ...a, status: i <= 1 ? "done" : "running" })));
    }, 3600);
    setTimeout(() => {
      setAgents((prev) => prev.map((a) => ({ ...a, status: "done" })));
      setRunning(false);
    }, 5400);
  };

  const reset = () => { setAgents(buildAgents()); setRunning(false); };
  const allDone = agents.every((a) => a.status === "done");

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Scraping de Noticias V2</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Pipeline de agentes para coleta e enriquecimento de noticias
          </p>
        </div>
        <div className="flex gap-2">
          {allDone && (
            <Button variant="outline" size="sm" onClick={reset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reiniciar
            </Button>
          )}
          <Button
            size="sm"
            onClick={simulatePipeline}
            disabled={running || allDone}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Play className="h-4 w-4" />
            Iniciar Pipeline
          </Button>
        </div>
      </div>

      {/* Pipeline cards */}
      <div className="flex items-stretch gap-0">
        {agents.map((agent, index) => {
          const Icon = agent.icon;
          const status = statusConfig[agent.status];
          const StatusIcon = status.icon;
          const isActive = agent.status === "running";
          const isDone = agent.status === "done";

          return (
            <div key={agent.id} className="flex items-center flex-1 min-w-0">
              <div
                className={cn(
                  "flex-1 rounded-xl border-2 p-5 transition-all duration-500 min-w-0",
                  agent.borderColor, agent.bgColor,
                  isActive && "shadow-lg scale-[1.02]",
                  agent.status === "waiting" && "opacity-50 grayscale"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className={cn("p-2 rounded-lg bg-white shadow-sm", agent.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <StatusIcon className={cn("h-5 w-5 mt-0.5 shrink-0", status.className)} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Agente {agent.id}
                  </p>
                  <p className="font-semibold text-gray-900 text-sm leading-snug">{agent.label}</p>
                  <p className="text-xs text-gray-500 leading-snug">{agent.description}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/60">
                  <p className={cn("text-xs font-medium", status.className)}>{status.label}</p>
                  {isActive && (
                    <div className="mt-1.5 h-1 bg-white rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full w-3/5 animate-pulse" />
                    </div>
                  )}
                  {isDone && (
                    <div className="mt-1.5 h-1 bg-white rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full w-full" />
                    </div>
                  )}
                </div>
              </div>

              {index < agents.length - 1 && (
                <div className="flex flex-col items-center px-2 shrink-0">
                  <ArrowRight
                    className={cn(
                      "h-6 w-6 transition-colors duration-300",
                      agents[index + 1].status === "waiting" ? "text-gray-200"
                        : agents[index].status === "done" ? "text-emerald-400"
                        : "text-gray-300"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Fontes do Agente Buscador ─────────────────────────────────────── */}
      <div className="border border-blue-100 rounded-xl overflow-hidden">

        {/* Accordion header */}
        <button
          onClick={() => setFontesOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Search className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">
              Fontes do Agente Buscador
            </span>
            {!loadingFontes && (
              <span className="text-xs bg-blue-200 text-blue-800 rounded-full px-2 py-0.5 font-medium">
                {fontes.filter((f) => f.ativo).length} ativas
              </span>
            )}
          </div>
          {fontesOpen
            ? <ChevronUp className="h-4 w-4 text-blue-500" />
            : <ChevronDown className="h-4 w-4 text-blue-500" />
          }
        </button>

        {fontesOpen && (
          <div className="p-5 space-y-4 bg-white">

            {/* Lista de fontes */}
            {loadingFontes ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando fontes...
              </div>
            ) : fontes.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">
                Nenhuma fonte cadastrada. Adicione abaixo.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                {fontes.map((fonte) => (
                  <div key={fonte.id} className="flex items-center gap-3 px-4 py-3">
                    {/* ativo toggle */}
                    <button
                      onClick={() => toggleAtivo(fonte)}
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0 transition-colors",
                        fonte.ativo ? "bg-emerald-500" : "bg-gray-300"
                      )}
                      title={fonte.ativo ? "Ativa — clique para desativar" : "Inativa — clique para ativar"}
                    />

                    {/* tipo icon */}
                    {fonte.tipo === "rss"
                      ? <Rss className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                      : <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    }

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{fonte.nome}</p>
                      <p className="text-xs text-gray-400 truncate">{fonte.url}</p>
                    </div>

                    <span className={cn("text-xs rounded px-1.5 py-0.5 font-medium shrink-0", TIPO_COLORS[fonte.tipo])}>
                      {TIPO_LABELS[fonte.tipo]}
                    </span>

                    <button
                      onClick={() => deleteFonte.mutate(fonte.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulário de nova fonte */}
            <div className="pt-2 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Adicionar fonte
              </p>

              <div className="flex gap-2">
                <Input
                  placeholder="Nome (ex: G1 Vales)"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="flex-1 text-sm"
                />
                <select
                  value={novoTipo}
                  onChange={(e) => setNovoTipo(e.target.value as "rss" | "html" | "auto")}
                  className="border border-gray-200 rounded-md px-3 text-sm text-gray-700 bg-white"
                >
                  <option value="auto">Auto</option>
                  <option value="rss">RSS</option>
                  <option value="html">HTML</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="https://exemplo.com/feed"
                  value={novoUrl}
                  onChange={(e) => setNovoUrl(e.target.value)}
                  className="flex-1 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && addFonte()}
                />
                <Button
                  size="sm"
                  onClick={addFonte}
                  disabled={saving}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Adicionar
                </Button>
              </div>

              {erroForm && (
                <p className="text-xs text-red-500">{erroForm}</p>
              )}
            </div>

          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Cidade vinculada: <span className="font-mono">{cidadeId}</span>
      </p>
    </div>
  );
};

export default AdminCidadeScrapingNoticiasV2;
