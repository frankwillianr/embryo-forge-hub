import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, FileText, Image as ImageIcon,
  CheckCircle2, Loader2, Circle, Plus, Trash2, Globe, Rss,
  ChevronDown, ChevronUp, Newspaper, Calendar, AlertCircle, RefreshCw,
  X, ExternalLink, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface AdminCidadeScrapingNoticiasV2Props {
  cidadeId: string;
}

type AgentStatus = "idle" | "running" | "done" | "waiting" | "error";

interface FonteV2 {
  id: string;
  cidade_id: string;
  nome: string;
  url: string;
  tipo: "rss" | "html" | "auto";
  ativo: boolean;
  ordem: number;
}

interface NoticiaColetada {
  id: string;
  url: string;
  titulo: string | null;
  descricao: string | null;
  lista_imagens: string[];
  fonte_nome: string | null;
  data_publicacao: string | null;
  status: string;
  is_duplicada?: boolean;
  imagem_refeita?: string | null;
  created_at: string;
}

interface AgentRun {
  status: AgentStatus;
  inseridos?: number;
  logs?: string[];
  erro?: string;
}

interface Agent2Run {
  status: AgentStatus;
  total_entrada?: number;
  duplicadas?: number;
  canonicas?: number;
  grupos?: number;
  itens?: Array<{ canonica_id: string; grupo_qtd: number; score: number }>;
  erro?: string;
}

interface Agent3Run {
  status: AgentStatus;
  processados?: number;
  erros?: number;
  model?: string;
  erro?: string;
}

interface Agent4Run {
  status: AgentStatus;
  processados?: number;
  erro?: string;
  detalhe?: string;
}

interface Agent5Run {
  status: AgentStatus;
  publicados?: number;
  jaExistia?: number;
  erros?: number;
  erro?: string;
}

const parseDateToMs = (raw?: string | null): number => {
  const s = (raw ?? "").trim();
  if (!s) return 0;

  const isoMs = Date.parse(s);
  if (Number.isFinite(isoMs)) return isoMs;

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const yyyy = dmy[3];
    const ms = Date.parse(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    if (Number.isFinite(ms)) return ms;
  }

  return 0;
};

const extractDateFromTextToMs = (raw?: string | null): number => {
  const s = (raw ?? "").trim();
  if (!s) return 0;
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return 0;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yyyy = m[3];
  return parseDateToMs(`${yyyy}-${mm}-${dd}`);
};

const safeString = (value: unknown) => {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const parseInvokeError = async (err: unknown): Promise<string> => {
  const e = err as {
    name?: string;
    message?: string;
    status?: number;
    context?: Response;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
    error?: unknown;
  };

  const lines: string[] = [];
  if (e.name) lines.push(`type: ${e.name}`);
  if (typeof e.status === "number") lines.push(`status: ${e.status}`);
  if (e.message) lines.push(`message: ${e.message}`);

  const context = e.context;
  if (context) {
    lines.push(`response_status: ${context.status}`);
    lines.push(`response_status_text: ${context.statusText}`);
    try {
      const raw = await context.text();
      if (raw) lines.push(`response_body: ${raw.slice(0, 1200)}`);
    } catch {
      lines.push("response_body: <nao foi possivel ler>");
    }
  }

  if (e.code !== undefined) lines.push(`code: ${safeString(e.code)}`);
  if (e.hint !== undefined) lines.push(`hint: ${safeString(e.hint)}`);
  if (e.details !== undefined) lines.push(`details: ${safeString(e.details)}`);
  if (e.error !== undefined) lines.push(`error: ${safeString(e.error)}`);

  return lines.length ? lines.join("\n") : safeString(err);
};

const isInvalidJwtError = async (err: unknown): Promise<boolean> => {
  const e = err as { status?: number; context?: Response; message?: string };
  if (e?.status === 401 && /invalid jwt/i.test(e?.message ?? "")) return true;
  if (e?.status === 401 && /unsupported token algorithm|unauthorized/i.test(e?.message ?? "")) return true;
  if (e?.context?.status !== 401) return false;
  try {
    const raw = await e.context.clone().text();
    return /invalid jwt|unsupported token algorithm|unauthorized/i.test(raw);
  } catch {
    return false;
  }
};

const getFreshAccessToken = async (): Promise<string | null> => {
  const current = await supabase.auth.getSession();
  let session = current.data.session;
  if (!session) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresSoon = typeof session.expires_at === "number" && session.expires_at <= nowSec + 30;
  if (expiresSoon) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session ?? session;
  }

  return session?.access_token ?? null;
};

const isTransientFetchError = (err: unknown): boolean => {
  const e = err as { message?: string; name?: string };
  const msg = String(e?.message ?? "").toLowerCase();
  const name = String(e?.name ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    name.includes("typeerror")
  );
};

const invokeEdgeWithAnonKey = async (fnName: string, body: unknown) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Variaveis VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes.");
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }

  if (!res.ok) {
    const err = new Error(`Edge Function HTTP ${res.status}`) as Error & {
      status?: number;
      details?: unknown;
      code?: string;
    };
    err.status = res.status;
    err.code = "edge_http_error";
    err.details = parsed;
    throw err;
  }

  return parsed;
};

const invokeEdgeWithSession = async (fnName: string, body: unknown) => {
  const token = await getFreshAccessToken();
  if (!token) {
    throw new Error("Sessao expirada. Faca login novamente no painel admin.");
  }
  return supabase.functions.invoke(fnName, {
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
};

const TIPO_LABELS: Record<string, string> = { rss: "RSS", html: "HTML", auto: "Auto" };
const TIPO_COLORS: Record<string, string> = {
  rss: "bg-orange-100 text-orange-700",
  html: "bg-blue-100 text-blue-700",
  auto: "bg-gray-100 text-gray-600",
};

// ─── Component ────────────────────────────────────────────────────────────────

const AdminCidadeScrapingNoticiasV2 = ({ cidadeId }: AdminCidadeScrapingNoticiasV2Props) => {
  const queryClient = useQueryClient();

  // Agente 1 real run state
  const [agent1, setAgent1] = useState<AgentRun>({ status: "idle" });
  const [agent2, setAgent2] = useState<Agent2Run>({ status: "idle" });
  const [agent3, setAgent3] = useState<Agent3Run>({ status: "idle" });
  const [agent4, setAgent4] = useState<Agent4Run>({ status: "idle" });
  const [agent5, setAgent5] = useState<Agent5Run>({ status: "idle" });
  const [pipelineRunning, setPipelineRunning] = useState(false);

  // Fontes panel
  const [fontesOpen, setFontesOpen] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [novoUrl, setNovoUrl] = useState("");
  const [novoTipo, setNovoTipo] = useState<"rss" | "html" | "auto">("auto");
  const [saving, setSaving] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [savingAuto, setSavingAuto] = useState(false);

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

  const { data: autoConfig } = useQuery<{ auto_ativo: boolean } | null>({
    queryKey: ["cidade_scraping_config", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade_scraping_config")
        .select("auto_ativo")
        .eq("cidade_id", cidadeId)
        .maybeSingle();
      if (error) throw error;
      return (data as { auto_ativo: boolean } | null) ?? null;
    },
    enabled: !!cidadeId,
  });

  // ── Noticias coletadas query ───────────────────────────────────────────────

  const { data: noticias = [], isLoading: loadingNoticias } = useQuery<NoticiaColetada[]>({
    queryKey: ["tabela_agente_buscador", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabela_agente_buscador")
        .select("id, url, titulo, descricao, lista_imagens, fonte_nome, data_publicacao, status, is_duplicada, imagem_refeita, created_at")
        .eq("cidade_id", cidadeId)
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as NoticiaColetada[];
      rows.sort((a, b) => {
        const aMs = parseDateToMs(a.data_publicacao) || parseDateToMs(a.created_at);
        const bMs = parseDateToMs(b.data_publicacao) || parseDateToMs(b.created_at);
        if (bMs !== aMs) return bMs - aMs;
        return parseDateToMs(b.created_at) - parseDateToMs(a.created_at);
      });
      return rows;
    },
    enabled: !!cidadeId,
  });

  const noticiasOrdenadas = useMemo(() => {
    return [...noticias].sort((a, b) => {
      const aPubMs =
        parseDateToMs(a.data_publicacao) ||
        extractDateFromTextToMs(a.titulo) ||
        extractDateFromTextToMs(a.descricao) ||
        parseDateToMs(a.created_at);
      const bPubMs =
        parseDateToMs(b.data_publicacao) ||
        extractDateFromTextToMs(b.titulo) ||
        extractDateFromTextToMs(b.descricao) ||
        parseDateToMs(b.created_at);

      if (bPubMs !== aPubMs) return bPubMs - aPubMs;
      return parseDateToMs(b.created_at) - parseDateToMs(a.created_at);
    });
  }, [noticias]);

  // ── Modal de noticia ──────────────────────────────────────────────────────

  const [modalNoticia, setModalNoticia] = useState<NoticiaColetada | null>(null);
  const [imgIndex, setImgIndex] = useState(0);
  const [verImagemRefeita, setVerImagemRefeita] = useState(false);
  const [popupImagemGerada, setPopupImagemGerada] = useState<string | null>(null);

  const abrirModal = (n: NoticiaColetada) => { setModalNoticia(n); setImgIndex(0); setVerImagemRefeita(false); };
  const fecharModal = () => { setModalNoticia(null); setVerImagemRefeita(false); };

  // ── Deletar todas as noticias ─────────────────────────────────────────────

  const [deletingAll, setDeletingAll] = useState(false);

  const deletarTodasNoticias = async () => {
    if (!confirm("Deletar todas as noticias coletadas desta cidade?")) return;
    setDeletingAll(true);
    await supabase.from("tabela_agente_buscador").delete().eq("cidade_id", cidadeId);
    setDeletingAll(false);
    queryClient.invalidateQueries({ queryKey: ["tabela_agente_buscador", cidadeId] });
  };

  // ── Iniciar Agente 1 ──────────────────────────────────────────────────────

  const executarAgente1 = async () => {
    if (fontes.filter((f) => f.ativo).length === 0) {
      const msg = "Cadastre ao menos uma fonte ativa antes de iniciar.";
      setAgent1({ status: "error", erro: msg });
      throw new Error(msg);
    }
    setAgent1({ status: "running" });
    try {
      const payload = { cidade_id: cidadeId, lookback_days: 7, max_articles: 120 };
      let { data, error } = await invokeEdgeWithSession("agente_buscador_01", payload);
      if (error && await isInvalidJwtError(error)) {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.data.session) {
          const retry = await invokeEdgeWithSession("agente_buscador_01", payload);
          data = retry.data;
          error = retry.error;
        }
      }

      if (error && await isInvalidJwtError(error)) {
        data = await invokeEdgeWithAnonKey("agente_buscador_01", payload);
        error = null;
      }

      if (error) throw error;
      setAgent1({ status: "done", inseridos: data?.inseridos ?? 0, logs: data?.logs ?? [] });
      queryClient.invalidateQueries({ queryKey: ["tabela_agente_buscador", cidadeId] });
      return data;
    } catch (e) {
      const detalhe = await parseInvokeError(e);
      setAgent1({ status: "error", erro: detalhe });
      throw e;
    }
  };

  const executarAgente2 = async () => {
    setAgent2({ status: "running" });
    try {
      const payload = { cidade_id: cidadeId, limit: 220 };
      let { data, error } = await invokeEdgeWithSession("agente_conferencia_02", payload);
      if (error && await isInvalidJwtError(error)) {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.data.session) {
          const retry = await invokeEdgeWithSession("agente_conferencia_02", payload);
          data = retry.data;
          error = retry.error;
        }
      }
      if (error && await isInvalidJwtError(error)) {
        data = await invokeEdgeWithAnonKey("agente_conferencia_02", payload);
        error = null;
      }
      if (error) throw error;

      setAgent2({
        status: "done",
        total_entrada: data?.total_entrada ?? 0,
        duplicadas: data?.total_duplicadas ?? 0,
        canonicas: data?.total_canonicas ?? 0,
        grupos: data?.grupos_duplicados ?? 0,
        itens: data?.itens ?? [],
      });
      queryClient.invalidateQueries({ queryKey: ["tabela_agente_buscador", cidadeId] });
      return data;
    } catch (e) {
      const detalhe = await parseInvokeError(e);
      setAgent2({ status: "error", erro: detalhe });
      throw e;
    }
  };

  const executarAgente3 = async () => {
    setAgent3({ status: "running" });
    try {
      const payload = { cidade_id: cidadeId, limit: 120 };
      let data: any = null;
      let error: any = null;
      let tentativasRede = 0;

      while (tentativasRede < 3) {
        try {
          ({ data, error } = await invokeEdgeWithSession("agente_texto_03", payload));
          break;
        } catch (netErr) {
          if (!isTransientFetchError(netErr)) throw netErr;
          tentativasRede++;
          setAgent3({
            status: "running",
            erro: `Reconectando com o agente 3... (${tentativasRede}/3)`,
          });
          if (tentativasRede >= 3) {
            data = await invokeEdgeWithAnonKey("agente_texto_03", payload);
            error = null;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1800));
        }
      }

      if (error && await isInvalidJwtError(error)) {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.data.session) {
          const retry = await invokeEdgeWithSession("agente_texto_03", payload);
          data = retry.data;
          error = retry.error;
        }
      }
      if (error && await isInvalidJwtError(error)) {
        data = await invokeEdgeWithAnonKey("agente_texto_03", payload);
        error = null;
      }
      if (error) throw error;

      setAgent3({
        status: "done",
        processados: data?.total_processado ?? 0,
        erros: data?.total_erros ?? 0,
        model: data?.model ?? "",
      });
      queryClient.invalidateQueries({ queryKey: ["tabela_agente_buscador", cidadeId] });
      return data;
    } catch (e) {
      const detalhe = await parseInvokeError(e);
      setAgent3({ status: "error", erro: detalhe });
      throw e;
    }
  };

  const executarAgente4 = async () => {
    setAgent4({ status: "running" });
    try {
      const MAX_RODADAS = 120;
      const DELAY_ENTRE_RODADAS_MS = 1200;
      let totalProcessado = 0;
      let totalErros = 0;
      let totalTentado = 0;
      let rodadas = 0;
      let ultimoDetalhe = "";
      let totalElegiveis = 0;
      let rodadasSemMovimento = 0;
      let workerLimitHits = 0;

      for (let i = 0; i < MAX_RODADAS; i++) {
        rodadas++;
        const payload = { cidade_id: cidadeId, limit: 1 };
        let data: any = null;
        let error: any = null;
        let tentativasRede = 0;

        while (tentativasRede < 3) {
          try {
            ({ data, error } = await invokeEdgeWithSession("agente_imagem_04", payload));
            break;
          } catch (netErr) {
            if (!isTransientFetchError(netErr)) throw netErr;
            tentativasRede++;
            setAgent4({
              status: "running",
              processados: totalProcessado,
              detalhe: totalElegiveis > 0
                ? `${totalProcessado}/${totalElegiveis} • Rodada ${rodadas} • reconectando... (${tentativasRede}/3)`
                : `Rodada ${rodadas} • reconectando... (${tentativasRede}/3)`,
            });
            if (tentativasRede >= 3) throw netErr;
            await new Promise((resolve) => setTimeout(resolve, 1800));
          }
        }

        if (error && await isInvalidJwtError(error)) {
          const refreshed = await supabase.auth.refreshSession();
          if (refreshed.data.session) {
            const retry = await invokeEdgeWithSession("agente_imagem_04", payload);
            data = retry.data;
            error = retry.error;
          }
        }
        if (error && await isInvalidJwtError(error)) {
          data = await invokeEdgeWithAnonKey("agente_imagem_04", payload);
          error = null;
        }
        if (error) {
          const status = Number((error as { status?: number })?.status ?? 0);
          if (status === 546) {
            workerLimitHits++;
            setAgent4({
              status: "running",
              processados: totalProcessado,
              detalhe: totalElegiveis > 0
                ? `${totalProcessado}/${totalElegiveis} • Rodada ${rodadas} • aguardando recursos...`
                : `Rodada ${rodadas} • aguardando recursos...`,
            });
            if (workerLimitHits >= 5) throw error;
            await new Promise((resolve) => setTimeout(resolve, 2500));
            continue;
          }
          throw error;
        }
        workerLimitHits = 0;

        const processadoRodada = Number(data?.total_processado ?? data?.processados ?? 0);
        const errosRodada = Number(data?.total_erros ?? 0);
        const tentadoRodada = Number(data?.total_tentado ?? (processadoRodada + errosRodada));
        const restanteGlobal = Number(data?.restantes_globais ?? 0);
        const elegiveisRodada = Number(data?.total_elegiveis ?? 0);
        totalProcessado += processadoRodada;
        totalErros += errosRodada;
        totalTentado += tentadoRodada;
        ultimoDetalhe = String(data?.message ?? data?.status ?? "").trim();
        totalElegiveis = Math.max(totalElegiveis, elegiveisRodada, totalProcessado + restanteGlobal);

        if (tentadoRodada <= 0) rodadasSemMovimento++;
        else rodadasSemMovimento = 0;

        setAgent4({
          status: "running",
          processados: totalProcessado,
          detalhe: totalElegiveis > 0
            ? `${totalProcessado}/${totalElegiveis} • Rodada ${rodadas} • ${Math.max(restanteGlobal, 0)} restantes`
            : `Rodada ${rodadas} • ${totalProcessado} processadas`,
        });

        if (restanteGlobal <= 0) break;
        if (rodadasSemMovimento >= 3) break;

        await new Promise((resolve) => setTimeout(resolve, DELAY_ENTRE_RODADAS_MS));
      }

      const detalheFinal = totalErros > 0
        ? `${totalProcessado}/${Math.max(totalElegiveis, totalProcessado)} • ${rodadas} rodadas, ${totalErros} erros`
        : `${totalProcessado}/${Math.max(totalElegiveis, totalProcessado)} • ${rodadas} rodadas`;

      setAgent4({
        status: "done",
        processados: totalProcessado,
        detalhe: totalProcessado > 0
          ? detalheFinal
          : (totalErros > 0 ? `${detalheFinal}` : (ultimoDetalhe || "Nenhuma notícia elegível para gerar imagem.")),
      });
      queryClient.invalidateQueries({ queryKey: ["tabela_agente_buscador", cidadeId] });
      return { total_processado: totalProcessado, total_erros: totalErros, total_tentado: totalTentado, rodadas };
    } catch (e) {
      const detalhe = await parseInvokeError(e);
      setAgent4({ status: "error", erro: detalhe });
      throw e;
    }
  };

  const executarAgente5 = async () => {
    setAgent5({ status: "running" });
    try {
      const payload = { cidade_id: cidadeId, limit: 120 };
      let { data, error } = await invokeEdgeWithSession("agente_publicador_05", payload);
      if (error && await isInvalidJwtError(error)) {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.data.session) {
          const retry = await invokeEdgeWithSession("agente_publicador_05", payload);
          data = retry.data;
          error = retry.error;
        }
      }
      if (error && await isInvalidJwtError(error)) {
        data = await invokeEdgeWithAnonKey("agente_publicador_05", payload);
        error = null;
      }
      if (error) throw error;

      setAgent5({
        status: "done",
        publicados: data?.total_publicado ?? 0,
        jaExistia: data?.total_ja_existia ?? 0,
        erros: data?.total_erros ?? 0,
      });
      queryClient.invalidateQueries({ queryKey: ["tabela_agente_buscador", cidadeId] });
      return data;
    } catch (e) {
      const detalhe = await parseInvokeError(e);
      setAgent5({ status: "error", erro: detalhe });
      throw e;
    }
  };

  const iniciarAgente1 = async () => {
    setPipelineRunning(true);
    try {
      await executarAgente1();
    } finally {
      setPipelineRunning(false);
    }
  };

  const iniciarPipelineAgentes = async () => {
    setPipelineRunning(true);
    setAgent2({ status: "waiting" });
    setAgent3({ status: "waiting" });
    setAgent4({ status: "waiting" });
    setAgent5({ status: "waiting" });
    try {
      await executarAgente1();
      await executarAgente2();
      await executarAgente3();
      await executarAgente4();
      await executarAgente5();
    } catch {
      // status detalhado já é tratado por cada agente
    } finally {
      setPipelineRunning(false);
    }
  };

  // ── Add fonte ─────────────────────────────────────────────────────────────

  const addFonte = async () => {
    setErroForm(null);
    if (!novoNome.trim()) return setErroForm("Informe o nome da fonte");
    if (!novoUrl.trim()) return setErroForm("Informe a URL");
    try { new URL(novoUrl); } catch { return setErroForm("URL invalida"); }

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
      const { error } = await supabase.from("cidade_scraping_fonte_v2").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["cidade_scraping_fonte_v2", cidadeId] }),
  });

  const toggleAtivo = async (fonte: FonteV2) => {
    await supabase.from("cidade_scraping_fonte_v2").update({ ativo: !fonte.ativo }).eq("id", fonte.id);
    queryClient.invalidateQueries({ queryKey: ["cidade_scraping_fonte_v2", cidadeId] });
  };

  const autoAtivo = Boolean(autoConfig?.auto_ativo);
  const toggleFluxoAutomatico = async () => {
    setSavingAuto(true);
    const { error } = await supabase
      .from("cidade_scraping_config")
      .upsert(
        {
          cidade_id: cidadeId,
          auto_ativo: !autoAtivo,
          intervalo_horas: 3,
          lookback_dias: 7,
          max_artigos: 120,
          rewrite_ai: true,
          validate_ai: true,
        },
        { onConflict: "cidade_id" },
      );
    setSavingAuto(false);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["cidade_scraping_config", cidadeId] });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const a1Running = agent1.status === "running";
  const a1Done    = agent1.status === "done";
  const a1Error   = agent1.status === "error";
  const a1Idle    = agent1.status === "idle";
  const a2Running = agent2.status === "running";
  const a2Done    = agent2.status === "done";
  const a2Error   = agent2.status === "error";
  const a2Waiting = agent2.status === "waiting";
  const a2Idle    = agent2.status === "idle";
  const a3Running = agent3.status === "running";
  const a3Done    = agent3.status === "done";
  const a3Error   = agent3.status === "error";
  const a3Waiting = agent3.status === "waiting";
  const a3Idle    = agent3.status === "idle";
  const a4Running = agent4.status === "running";
  const a4Done    = agent4.status === "done";
  const a4Error   = agent4.status === "error";
  const a4Waiting = agent4.status === "waiting";
  const a4Idle    = agent4.status === "idle";
  const a5Running = agent5.status === "running";
  const a5Done    = agent5.status === "done";
  const a5Error   = agent5.status === "error";
  const a5Waiting = agent5.status === "waiting";
  const a5Idle    = agent5.status === "idle";

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Scraping de Noticias V2</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Pipeline de agentes para coleta e enriquecimento de noticias
          </p>
          <p className="text-xs mt-1 text-gray-500">
            Fluxo automático: 08h, 12h, 16h e 21h (horário de Brasília)
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant={autoAtivo ? "default" : "outline"}
            onClick={toggleFluxoAutomatico}
            disabled={savingAuto}
            className={cn("gap-2", autoAtivo && "bg-emerald-600 hover:bg-emerald-700 text-white")}
          >
            {savingAuto
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
              : autoAtivo
              ? <><CheckCircle2 className="h-4 w-4" /> Fluxo automático ativo</>
              : <><Circle className="h-4 w-4" /> Ativar fluxo automático</>
            }
          </Button>
          <Button
            size="sm"
            onClick={iniciarPipelineAgentes}
            disabled={pipelineRunning}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {pipelineRunning
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Executando agentes...</>
              : <><RefreshCw className="h-4 w-4" /> Iniciar Agentes 1 {" > "} 2 {" > "} 3 {" > "} 4 {" > "} 5</>
            }
          </Button>
        </div>
      </div>

      {/* ── Pipeline cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-5 gap-3">

        {/* Agente 1 — Buscador (real) */}
        <div className="min-w-0">
          <div className={cn(
            "flex-1 rounded-xl border-2 p-5 transition-all duration-500 min-w-0",
            "border-blue-200 bg-blue-50",
            a1Running && "shadow-lg scale-[1.02]",
          )}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white shadow-sm text-blue-600">
                <Search className="h-5 w-5" />
              </div>
              {a1Running && <Loader2 className="h-5 w-5 text-amber-500 animate-spin mt-0.5" />}
              {a1Done    && <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />}
              {a1Error   && <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />}
              {a1Idle    && <Circle className="h-5 w-5 text-gray-300 mt-0.5" />}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agente 1</p>
              <p className="font-semibold text-gray-900 text-sm leading-snug">Agente Buscador</p>
              <p className="text-xs text-gray-500 leading-snug">
                Busca noticias dos ultimos 7 dias nas fontes cadastradas
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/60 space-y-2">
              {a1Done && (
                <p className="text-xs text-emerald-600 font-medium">
                  {agent1.inseridos} noticias coletadas
                </p>
              )}
              {a1Error && (
                <pre className="text-xs text-red-600 leading-snug whitespace-pre-wrap break-words rounded-md bg-red-50 p-2 border border-red-100">
                  {agent1.erro}
                </pre>
              )}
              {a1Running && (
                <div className="h-1 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full w-3/5 animate-pulse" />
                </div>
              )}
              {a1Done && (
                <div className="h-1 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-full" />
                </div>
              )}
              <Button
                size="sm"
                onClick={iniciarAgente1}
                disabled={pipelineRunning || a1Running || a2Running || a3Running || a4Running || a5Running}
                className={cn(
                  "w-full gap-2 text-white text-xs",
                  a1Done || a1Error
                    ? "bg-blue-500 hover:bg-blue-600"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {a1Running
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...</>
                  : a1Done
                  ? <><RefreshCw className="h-3.5 w-3.5" /> Buscar novamente</>
                  : <><Search className="h-3.5 w-3.5" /> Iniciar Agente 1</>
                }
              </Button>
            </div>
          </div>
        </div>

        {/* Agente 2 — Conferencia */}
        <div className="min-w-0">
          <div className={cn(
            "flex-1 rounded-xl border-2 border-violet-200 bg-violet-50 p-5 transition-all duration-500",
            a2Waiting && "opacity-70",
            a2Running && "shadow-lg scale-[1.02]",
          )}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white shadow-sm text-violet-600">
                <FileText className="h-5 w-5" />
              </div>
              {a2Running && <Loader2 className="h-5 w-5 text-amber-500 animate-spin mt-0.5" />}
              {a2Done    && <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />}
              {a2Error   && <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />}
              {(a2Idle || a2Waiting) && <Circle className="h-5 w-5 text-gray-300 mt-0.5" />}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agente 2</p>
              <p className="font-semibold text-gray-900 text-sm leading-snug">Agente de Conferencia</p>
              <p className="text-xs text-gray-500 leading-snug">
                Detecta noticias duplicadas e mantem uma canonica
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/60 space-y-2">
              {a2Waiting && (
                <p className="text-xs text-gray-500 font-medium">Aguardando agente 1 concluir</p>
              )}
              {a2Done && (
                <p className="text-xs text-emerald-600 font-medium">
                  {agent2.duplicadas ?? 0} duplicadas em {agent2.grupos ?? 0} grupos
                  {typeof agent2.canonicas === "number" ? `, ${agent2.canonicas} canonicas` : ""}
                </p>
              )}
              {a2Error && (
                <pre className="text-xs text-red-600 leading-snug whitespace-pre-wrap break-words rounded-md bg-red-50 p-2 border border-red-100">
                  {agent2.erro}
                </pre>
              )}
              {a2Running && (
                <div className="h-1 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full w-3/5 animate-pulse" />
                </div>
              )}
              {a2Done && (
                <div className="h-1 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-full" />
                </div>
              )}
              <Button
                size="sm"
                onClick={executarAgente2}
                disabled={pipelineRunning || a1Running || a2Running || a3Running || a4Running || a5Running || noticias.length === 0}
                className={cn(
                  "w-full gap-2 text-white text-xs",
                  a2Done || a2Error
                    ? "bg-violet-500 hover:bg-violet-600"
                    : "bg-violet-600 hover:bg-violet-700"
                )}
              >
                {a2Running
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Conferindo...</>
                  : a2Done
                  ? <><RefreshCw className="h-3.5 w-3.5" /> Conferir novamente</>
                  : <><FileText className="h-3.5 w-3.5" /> Iniciar Agente 2</>
                }
              </Button>
            </div>
          </div>
        </div>

        {/* Agente 3 — Texto */}
        <div className="min-w-0">
          <div className={cn(
            "flex-1 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 transition-all duration-500",
            a3Waiting && "opacity-70",
            a3Running && "shadow-lg scale-[1.02]",
          )}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white shadow-sm text-emerald-600">
                <FileText className="h-5 w-5" />
              </div>
              {a3Running && <Loader2 className="h-5 w-5 text-amber-500 animate-spin mt-0.5" />}
              {a3Done    && <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />}
              {a3Error   && <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />}
              {(a3Idle || a3Waiting) && <Circle className="h-5 w-5 text-gray-300 mt-0.5" />}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agente 3</p>
              <p className="font-semibold text-gray-900 text-sm leading-snug">Agente de Texto</p>
              <p className="text-xs text-gray-500 leading-snug">
                Reescreve as noticias canonicas para o formato final
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/60 space-y-2">
              {a3Waiting && (
                <p className="text-xs text-gray-500 font-medium">Aguardando agente 2 concluir</p>
              )}
              {a3Done && (
                <p className="text-xs text-emerald-600 font-medium">
                  {agent3.processados ?? 0} noticias reescritas
                  {typeof agent3.erros === "number" ? `, ${agent3.erros} erros` : ""}
                  {agent3.model ? ` • ${agent3.model}` : ""}
                </p>
              )}
              {a3Error && (
                <pre className="text-xs text-red-600 leading-snug whitespace-pre-wrap break-words rounded-md bg-red-50 p-2 border border-red-100">
                  {agent3.erro}
                </pre>
              )}
              {a3Running && (
                <div className="h-1 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full w-3/5 animate-pulse" />
                </div>
              )}
              {a3Done && (
                <div className="h-1 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-full" />
                </div>
              )}
              <Button
                size="sm"
                onClick={executarAgente3}
                disabled={pipelineRunning || a1Running || a2Running || a3Running || a4Running || a5Running || noticias.length === 0}
                className={cn(
                  "w-full gap-2 text-white text-xs",
                  a3Done || a3Error
                    ? "bg-emerald-500 hover:bg-emerald-600"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {a3Running
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reescrevendo...</>
                  : a3Done
                  ? <><RefreshCw className="h-3.5 w-3.5" /> Reescrever novamente</>
                  : <><FileText className="h-3.5 w-3.5" /> Iniciar Agente 3</>
                }
              </Button>
            </div>
          </div>
        </div>

        {/* Agente 4 — Imagem */}
        <div className="min-w-0">
          <div className={cn(
            "flex-1 rounded-xl border-2 border-pink-200 bg-pink-50 p-5 transition-all duration-500",
            a4Waiting && "opacity-70",
            a4Running && "shadow-lg scale-[1.02]",
          )}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white shadow-sm text-pink-600">
                <ImageIcon className="h-5 w-5" />
              </div>
              {a4Running && <Loader2 className="h-5 w-5 text-amber-500 animate-spin mt-0.5" />}
              {a4Done    && <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />}
              {a4Error   && <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />}
              {(a4Idle || a4Waiting) && <Circle className="h-5 w-5 text-gray-300 mt-0.5" />}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agente 4</p>
              <p className="font-semibold text-gray-900 text-sm leading-snug">Agente de Imagem</p>
              <p className="text-xs text-gray-500 leading-snug">
                Gera ou seleciona imagem para cada noticia
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/60 space-y-2">
              {a4Waiting && (
                <p className="text-xs text-gray-500 font-medium">Aguardando agente 3 concluir</p>
              )}
              {a4Running && (
                <p className="text-xs text-amber-700 font-medium">
                  {agent4.detalhe || `Gerando... ${agent4.processados ?? 0} processadas`}
                </p>
              )}
              {a4Done && (
                <p className="text-xs text-emerald-600 font-medium">
                  {agent4.processados ?? 0} noticias processadas
                  {agent4.detalhe ? ` • ${agent4.detalhe}` : ""}
                </p>
              )}
              {a4Error && (
                <pre className="text-xs text-red-600 leading-snug whitespace-pre-wrap break-words rounded-md bg-red-50 p-2 border border-red-100">
                  {agent4.erro}
                </pre>
              )}
              {a4Running && (
                <div className="h-1 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full w-3/5 animate-pulse" />
                </div>
              )}
              {a4Done && (
                <div className="h-1 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-full" />
                </div>
              )}
              <Button
                size="sm"
                onClick={executarAgente4}
                disabled={pipelineRunning || a1Running || a2Running || a3Running || a4Running || a5Running || noticias.length === 0}
                className={cn(
                  "w-full gap-2 text-white text-xs",
                  a4Done || a4Error
                    ? "bg-pink-500 hover:bg-pink-600"
                    : "bg-pink-600 hover:bg-pink-700"
                )}
              >
                {a4Running
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando...</>
                  : a4Done
                  ? <><RefreshCw className="h-3.5 w-3.5" /> Gerar novamente</>
                  : <><ImageIcon className="h-3.5 w-3.5" /> Iniciar Agente 4</>
                }
              </Button>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className={cn(
            "flex-1 rounded-xl border-2 border-amber-200 bg-amber-50 p-5 transition-all duration-500",
            a5Waiting && "opacity-70",
            a5Running && "shadow-lg scale-[1.02]",
          )}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white shadow-sm text-amber-600">
                <Newspaper className="h-5 w-5" />
              </div>
              {a5Running && <Loader2 className="h-5 w-5 text-amber-500 animate-spin mt-0.5" />}
              {a5Done    && <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />}
              {a5Error   && <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />}
              {(a5Idle || a5Waiting) && <Circle className="h-5 w-5 text-gray-300 mt-0.5" />}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agente 5</p>
              <p className="font-semibold text-gray-900 text-sm leading-snug">Agente Publicador</p>
              <p className="text-xs text-gray-500 leading-snug">
                Publica no Jornal da Cidade sem repostar noticia ja publicada
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/60 space-y-2">
              {a5Waiting && (
                <p className="text-xs text-gray-500 font-medium">Aguardando agente 4 concluir</p>
              )}
              {a5Done && (
                <p className="text-xs text-emerald-600 font-medium">
                  {agent5.publicados ?? 0} publicadas
                  {typeof agent5.jaExistia === "number" ? `, ${agent5.jaExistia} ja existentes` : ""}
                  {typeof agent5.erros === "number" ? `, ${agent5.erros} erros` : ""}
                </p>
              )}
              {a5Error && (
                <pre className="text-xs text-red-600 leading-snug whitespace-pre-wrap break-words rounded-md bg-red-50 p-2 border border-red-100">
                  {agent5.erro}
                </pre>
              )}
              {a5Running && (
                <div className="h-1 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full w-3/5 animate-pulse" />
                </div>
              )}
              {a5Done && (
                <div className="h-1 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-full" />
                </div>
              )}
              <Button
                size="sm"
                onClick={executarAgente5}
                disabled={pipelineRunning || a1Running || a2Running || a3Running || a4Running || a5Running || noticias.length === 0}
                className={cn(
                  "w-full gap-2 text-white text-xs",
                  a5Done || a5Error
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {a5Running
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Publicando...</>
                  : a5Done
                  ? <><RefreshCw className="h-3.5 w-3.5" /> Publicar novamente</>
                  : <><Newspaper className="h-3.5 w-3.5" /> Iniciar Agente 5</>
                }
              </Button>
            </div>
          </div>
        </div>

      </div>

      {/* ── Fontes do Agente Buscador ─────────────────────────────────────── */}
      <div className="border border-blue-100 rounded-xl overflow-hidden">
        <button
          onClick={() => setFontesOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Search className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">Fontes do Agente Buscador</span>
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
            {loadingFontes ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando fontes...
              </div>
            ) : fontes.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Nenhuma fonte cadastrada. Adicione abaixo.</p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                {fontes.map((fonte) => (
                  <div key={fonte.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleAtivo(fonte)}
                      className={cn("w-2 h-2 rounded-full shrink-0 transition-colors",
                        fonte.ativo ? "bg-emerald-500" : "bg-gray-300")}
                      title={fonte.ativo ? "Ativa" : "Inativa"}
                    />
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
              {erroForm && <p className="text-xs text-red-500">{erroForm}</p>}
            </div>
          </div>
        )}
      </div>

      {/* ── Noticias coletadas ────────────────────────────────────────────── */}
      {(noticias.length > 0 || loadingNoticias || a1Running) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-gray-500" />
              <p className="text-sm font-semibold text-gray-900">Noticias coletadas</p>
              {!loadingNoticias && (
                <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">
                  {noticias.length}
                </span>
              )}
            </div>
            {!loadingNoticias && noticias.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["tabela_agente_buscador", cidadeId] })}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={deletarTodasNoticias}
                  disabled={deletingAll}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  {deletingAll
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                  Deletar todas
                </button>
              </div>
            )}
          </div>

          {loadingNoticias || a1Running ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl overflow-hidden border border-gray-100">
                  <div className="w-full h-36 bg-gray-100" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-4/5" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {noticiasOrdenadas.map((noticia) => (
                <button
                  key={noticia.id}
                  onClick={() => abrirModal(noticia)}
                  className="group text-left rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-gray-200 transition-all bg-white flex flex-col"
                >
                  {/* Imagem */}
                  <div className="w-full h-36 bg-gray-100 overflow-hidden shrink-0">
                    {noticia.lista_imagens?.[0] ? (
                      <img
                        src={noticia.lista_imagens[0]}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Newspaper className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Conteudo */}
                  <div className="p-3 flex flex-col flex-1 space-y-1.5">
                    <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {noticia.titulo ?? <span className="text-gray-400 italic">Sem titulo</span>}
                    </p>
                    {noticia.descricao && (
                      <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{noticia.descricao}</p>
                    )}
                    <div className="flex items-center gap-3 pt-0.5 flex-wrap">
                      {noticia.fonte_nome && (
                        <span className="text-xs text-blue-600 font-medium">{noticia.fonte_nome}</span>
                      )}
                      {noticia.data_publicacao && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="h-3 w-3" />
                          {noticia.data_publicacao}
                        </span>
                      )}
                      {noticia.lista_imagens?.length > 1 && (
                        <span className="text-xs text-gray-400">{noticia.lista_imagens.length} imgs</span>
                      )}
                      {noticia.imagem_refeita && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPopupImagemGerada(noticia.imagem_refeita ?? null);
                          }}
                          className="text-xs text-pink-600 font-medium hover:text-pink-700 underline"
                        >
                          Ver imagem gerada
                        </button>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Logs do último run */}
      {a1Done && agent1.logs && agent1.logs.length > 0 && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-600 select-none">
            Ver logs da execucao
          </summary>
          <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-0.5 font-mono">
            {agent1.logs.map((log, i) => <p key={i}>{log}</p>)}
          </div>
        </details>
      )}

      <p className="text-xs text-gray-400">
        Cidade vinculada: <span className="font-mono">{cidadeId}</span>
      </p>

      {/* ── Modal de noticia ────────────────────────────────────────────── */}
      {modalNoticia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={fecharModal}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {modalNoticia.fonte_nome && (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 rounded-full px-2.5 py-0.5 shrink-0">
                    {modalNoticia.fonte_nome}
                  </span>
                )}
                {modalNoticia.data_publicacao && (
                  <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                    <Calendar className="h-3 w-3" />
                    {modalNoticia.data_publicacao}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {modalNoticia.imagem_refeita && (
                  <button
                    className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors"
                    onClick={() => setVerImagemRefeita((v) => !v)}
                  >
                    {verImagemRefeita ? "Ver imagem original" : "Ver imagem gerada"}
                  </button>
                )}
                <a
                  href={modalNoticia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir original
                </a>
                <button
                  onClick={fecharModal}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1">

              {/* Galeria de imagens */}
              {verImagemRefeita && modalNoticia.imagem_refeita ? (
                <div className="relative bg-gray-900">
                  <img
                    src={modalNoticia.imagem_refeita}
                    alt=""
                    className="w-full max-h-72 object-contain bg-white"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              ) : modalNoticia.lista_imagens?.length > 0 && (
                <div className="relative bg-gray-900">
                  <img
                    src={modalNoticia.lista_imagens[imgIndex]}
                    alt=""
                    className="w-full max-h-72 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  {/* Navegação entre imagens */}
                  {modalNoticia.lista_imagens.length > 1 && (
                    <>
                      <button
                        onClick={() => setImgIndex((i) => (i - 1 + modalNoticia.lista_imagens.length) % modalNoticia.lista_imagens.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setImgIndex((i) => (i + 1) % modalNoticia.lista_imagens.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      {/* Dots */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {modalNoticia.lista_imagens.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setImgIndex(i)}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full transition-colors",
                              i === imgIndex ? "bg-white" : "bg-white/40"
                            )}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Titulo e descricao */}
              <div className="p-5 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 leading-snug">
                  {modalNoticia.titulo ?? <span className="text-gray-400 italic">Sem titulo</span>}
                </h2>

                {modalNoticia.descricao ? (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {modalNoticia.descricao}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Sem descricao disponivel.</p>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Popup imagem gerada */}
      {popupImagemGerada && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setPopupImagemGerada(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Imagem gerada</p>
              <button
                onClick={() => setPopupImagemGerada(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-gray-100 flex items-center justify-center p-3 max-h-[80vh] overflow-auto">
              <img
                src={popupImagemGerada}
                alt="Imagem gerada"
                className="max-w-full max-h-[75vh] object-contain rounded-lg bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCidadeScrapingNoticiasV2;

