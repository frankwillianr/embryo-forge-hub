import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Plus,
  PowerOff,
  RefreshCw,
  Rss,
} from "lucide-react";

interface AdminCidadeScrapingEventosProps {
  cidadeId: string;
}

interface LogLine {
  msg: string;
  kind: "info" | "ok" | "warn" | "err";
}

interface EventoScrapingResult {
  data_processada: string;
  inseridos: number;
  antigas_rejeitadas: number;
  duplicados: number;
  sem_imagem: number;
  sem_data: number;
  urls_invalidas: number;
  erros: string[];
}

interface FonteEventoConfig {
  id: string;
  nome: string;
  tipo: "html" | "rss";
  url: string;
  ativo: boolean;
  ordem?: number;
  created_at?: string;
}

const LOG_COLORS: Record<LogLine["kind"], string> = {
  info: "text-gray-300",
  ok: "text-green-400",
  warn: "text-yellow-400",
  err: "text-red-400",
};

const AdminCidadeScrapingEventos = ({ cidadeId }: AdminCidadeScrapingEventosProps) => {
  const queryClient = useQueryClient();
  const [novaFonte, setNovaFonte] = useState("");
  const [novaUrl, setNovaUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [lastResult, setLastResult] = useState<EventoScrapingResult | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const { data: eventos, isLoading: isLoadingEventos } = useQuery({
    queryKey: ["admin-cidade-eventos-scraped", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_eventos")
        .select("id, titulo, data_evento, created_at")
        .eq("cidade_id", cidadeId)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: fontes = [], isLoading: isLoadingFontes } = useQuery({
    queryKey: ["admin-cidade-scraping-eventos-fontes", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade_scraping_evento_fonte")
        .select("id, nome, tipo, url, ativo, ordem, created_at")
        .eq("cidade_id", cidadeId)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FonteEventoConfig[];
    },
  });

  function addLog(msg: string, kind: LogLine["kind"] = "info") {
    setLogs((prev) => [...prev, { msg, kind }]);
  }

  async function handleBuscarEventosAgora() {
    setIsRunning(true);
    setLogs([]);
    setLastResult(null);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const endpoint = `${supabaseUrl}/functions/v1/coletar-eventos-gv`;

    addLog(`Endpoint: ${endpoint}`);
    addLog(
      `Key: ${supabaseKey ? `${supabaseKey.slice(0, 20)}...` : "NAO ENCONTRADA"}`,
      supabaseKey ? "info" : "err",
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          stream: true,
          cidade_id: cidadeId,
          lookback_days: 20,
          validate_ai: true,
          rewrite_ai: true,
        }),
      });

      addLog(`Resposta: HTTP ${response.status} ${response.statusText}`, response.ok ? "ok" : "err");

      if (!response.ok) {
        const body = await response.text();
        addLog(`Erro: ${body.slice(0, 300)}`, "err");
        return;
      }

      if (!response.body) {
        addLog("Resposta sem stream body", "err");
        return;
      }

      addLog("Streaming iniciado...", "ok");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "log") {
              setLogs((prev) => [...prev, { msg: data.msg, kind: data.kind ?? "info" }]);
            } else if (data.type === "done") {
              setLastResult(data as EventoScrapingResult);
              queryClient.invalidateQueries({ queryKey: ["admin-cidade-eventos-scraped", cidadeId] });
            } else if (data.type === "error") {
              setLogs((prev) => [...prev, { msg: `Erro interno: ${data.msg}`, kind: "err" }]);
            }
          } catch {
            // ignore
          }
        }
      }

      addLog("Stream encerrado.", "info");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Erro de conexao: ${msg}`, "err");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleAddFonte() {
    const nome = novaFonte.trim();
    const url = novaUrl.trim();

    if (!nome || !url) {
      toast.error("Preencha nome e URL da fonte.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      toast.error("A URL precisa comecar com http:// ou https://");
      return;
    }

    const tipo: "rss" | "html" = /rss|feed|\.xml($|\?)/i.test(url) ? "rss" : "html";
    const ordem = fontes.length > 0 ? Math.max(...fontes.map((f) => f.ordem ?? 0)) + 1 : 1;

    const { error } = await supabase.from("cidade_scraping_evento_fonte").insert({
      cidade_id: cidadeId,
      nome,
      tipo,
      url,
      ativo: true,
      ordem,
    });

    if (error) {
      toast.error(`Erro ao adicionar fonte: ${error.message}`);
      return;
    }

    toast.success("Fonte de eventos adicionada.");
    setNovaFonte("");
    setNovaUrl("");
    queryClient.invalidateQueries({ queryKey: ["admin-cidade-scraping-eventos-fontes", cidadeId] });
  }

  async function handleDisableFonte(id: string, nome: string) {
    if (!confirm(`Desativar a fonte "${nome}"?`)) return;
    const { error } = await supabase
      .from("cidade_scraping_evento_fonte")
      .update({ ativo: false })
      .eq("id", id)
      .eq("cidade_id", cidadeId);

    if (error) {
      toast.error(`Erro ao desativar fonte: ${error.message}`);
      return;
    }

    toast.success(`Fonte "${nome}" desativada.`);
    queryClient.invalidateQueries({ queryKey: ["admin-cidade-scraping-eventos-fontes", cidadeId] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">Scraping de Eventos</h3>
          <p className="text-sm text-muted-foreground">
            Fluxo novo para buscar shows, stand-up e teatro em Governador Valadares.
          </p>
        </div>
        <Button onClick={handleBuscarEventosAgora} disabled={isRunning} className="shrink-0 gap-2">
          <RefreshCw className={`h-4 w-4 ${isRunning ? "animate-spin" : ""}`} />
          {isRunning ? "Buscando..." : "Buscar Eventos Agora"}
        </Button>
      </div>

      {(isRunning || logs.length > 0) && (
        <div className="rounded-lg border border-gray-700 bg-gray-950 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-700">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-2 text-xs text-gray-400 font-mono">coletar-eventos-gv</span>
          </div>
          <div className="p-4 h-64 overflow-y-auto font-mono text-xs space-y-0.5">
            {logs.map((line, i) => (
              <div key={i} className={LOG_COLORS[line.kind]}>
                <span className="select-none text-gray-600 mr-2">{String(i + 1).padStart(3, "0")}</span>
                {line.msg}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {lastResult && (
            <div className="border-t border-gray-700 bg-gray-900 px-4 py-3 grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-green-400">{lastResult.inseridos}</p>
                <p className="text-xs text-gray-500">Inseridos</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-400">{lastResult.duplicados}</p>
                <p className="text-xs text-gray-500">Duplicados</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-400">{lastResult.antigas_rejeitadas}</p>
                <p className="text-xs text-gray-500">Passados</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-yellow-400">{lastResult.sem_imagem + lastResult.sem_data + lastResult.urls_invalidas}</p>
                <p className="text-xs text-gray-500">Rejeitados</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
          <Rss className="h-4 w-4" />
          Fontes de eventos ativas ({fontes.length})
        </h4>

        {isLoadingFontes ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Carregando fontes...</div>
        ) : fontes.length === 0 ? (
          <div className="text-center py-8 border rounded-lg bg-muted/30">
            <Globe className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma fonte ativa configurada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {fontes.map((fonte) => (
              <div key={fonte.id} className="flex items-start justify-between p-4 border rounded-lg bg-gray-50 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <p className="font-medium text-sm">{fonte.nome}</p>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 uppercase">
                      {fonte.tipo}
                    </span>
                  </div>
                  <a
                    href={fonte.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate max-w-xl"
                  >
                    {fonte.url}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <button
                  onClick={() => handleDisableFonte(fonte.id, fonte.nome)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                  title={`Desativar fonte ${fonte.nome}`}
                >
                  <PowerOff className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Adicionar nova fonte de eventos
        </h4>
        <div className="flex gap-2">
          <Input
            placeholder="Nome da fonte"
            value={novaFonte}
            onChange={(e) => setNovaFonte(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="URL da fonte"
            value={novaUrl}
            onChange={(e) => setNovaUrl(e.target.value)}
            className="flex-1"
          />
          <Button variant="default" className="shrink-0" onClick={handleAddFonte}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" />
        Eventos no banco: {isLoadingEventos ? "..." : eventos?.length ?? 0}
      </div>
    </div>
  );
};

export default AdminCidadeScrapingEventos;

