import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Globe,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  Rss,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminCidadeScrapingProps {
  cidadeId: string;
}

interface FonteDetectada {
  nome: string;
  url: string | null;
  total: number;
  ultima: string;
}

interface LogLine {
  msg: string;
  kind: "info" | "ok" | "warn" | "err";
}

interface ScrapingResult {
  data_processada: string;
  modo: string;
  inseridas: number;
  antigas_rejeitadas: number;
  duplicadas_url: number;
  duplicadas_titulo: number;
  sem_imagens_validas: number;
  urls_invalidas: number;
  sem_conteudo: number;
  erros: string[];
}

const LOG_COLORS: Record<LogLine["kind"], string> = {
  info: "text-gray-300",
  ok:   "text-green-400",
  warn: "text-yellow-400",
  err:  "text-red-400",
};

const AdminCidadeScraping = ({ cidadeId }: AdminCidadeScrapingProps) => {
  const queryClient = useQueryClient();
  const [novaFonte, setNovaFonte] = useState("");
  const [novaUrl, setNovaUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [lastResult, setLastResult] = useState<ScrapingResult | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const { data: artigosScrapados, isLoading } = useQuery({
    queryKey: ["admin-cidade-scraping-artigos", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_jornal")
        .select("id, titulo, fonte, id_externo, created_at")
        .eq("cidade_id", cidadeId)
        .not("id_externo", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fontes reais configuradas na Edge Function
  const FONTES_CONFIGURADAS = [
    { nome: "G1 Vales",           tipo: "rss",  url: "https://g1.globo.com/dynamo/minas-gerais/vales-mg/rss2.xml" },
    { nome: "Diário do Rio Doce", tipo: "html", url: "https://drd.com.br/" },
    { nome: "Jornal da Cidade",   tipo: "html", url: "https://jornaldacidadevalesdeminas.com/" },
    { nome: "DeFato Online",      tipo: "html", url: "https://defatoonline.com.br/localidades/governador-valadares/" },
  ];

  // Stats por fonte (vindas dos artigos já coletados)
  const statsMap: Record<string, { total: number; ultima: string }> = {};
  if (artigosScrapados) {
    for (const item of artigosScrapados) {
      if (!item.fonte) continue;
      if (!statsMap[item.fonte]) {
        statsMap[item.fonte] = { total: 0, ultima: item.created_at };
      }
      statsMap[item.fonte].total++;
      if (item.created_at > statsMap[item.fonte].ultima) {
        statsMap[item.fonte].ultima = item.created_at;
      }
    }
  }

  const fontes = FONTES_CONFIGURADAS.map((f) => ({
    ...f,
    total: statsMap[f.nome]?.total ?? 0,
    ultima: statsMap[f.nome]?.ultima ?? null,
  }));

  function addLog(msg: string, kind: LogLine["kind"] = "info") {
    setLogs((prev) => [...prev, { msg, kind }]);
  }

  async function handleBuscarAgora() {
    setIsRunning(true);
    setLogs([]);
    setLastResult(null);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const endpoint    = `${supabaseUrl}/functions/v1/coletar-noticias-gv`;

    addLog(`📡 Endpoint: ${endpoint}`);
    addLog(`🔑 Key: ${supabaseKey ? supabaseKey.slice(0, 20) + "..." : "NÃO ENCONTRADA"}`, supabaseKey ? "info" : "err");

    try {
      addLog("⏳ Enviando requisição...");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ stream: true, test_mode: false }),
      });

      addLog(`📥 Resposta recebida: HTTP ${response.status} ${response.statusText}`, response.ok ? "ok" : "err");
      addLog(`   Content-Type: ${response.headers.get("content-type") ?? "(vazio)"}`);

      if (!response.ok) {
        let body = "";
        try { body = await response.text(); } catch { /* ignore */ }
        addLog(`   Corpo do erro: ${body.slice(0, 300)}`, "err");
        return;
      }

      if (!response.body) {
        addLog("❌ Resposta sem body (streaming não suportado?)", "err");
        return;
      }

      addLog("✅ Streaming iniciado, aguardando eventos...", "ok");

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

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
              setLastResult(data as ScrapingResult);
              queryClient.invalidateQueries({ queryKey: ["admin-cidade-scraping-artigos", cidadeId] });
            } else if (data.type === "error") {
              setLogs((prev) => [...prev, { msg: `Erro interno: ${data.msg}`, kind: "err" }]);
            }
          } catch { /* ignore malformed */ }
        }
      }

      addLog("🏁 Stream encerrado.", "info");

    } catch (err: any) {
      const msg = err?.message ?? String(err);
      addLog(`❌ Erro de conexão: ${msg}`, "err");

      if (msg.includes("Failed to fetch")) {
        addLog("   Possíveis causas:", "warn");
        addLog("   1. A Edge Function não foi publicada no Supabase", "warn");
        addLog("   2. O URL do Supabase está errado", "warn");
        addLog("   3. Bloqueio de CORS ou rede", "warn");
        addLog(`   → Acesse: ${supabaseUrl.replace("https://", "https://supabase.com/dashboard/project/").replace(".supabase.co", "")}/functions`, "warn");
      }
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">Scraping de Notícias</h3>
          <p className="text-sm text-muted-foreground">
            Fontes configuradas para coleta automática de notícias desta cidade
          </p>
        </div>
        <Button onClick={handleBuscarAgora} disabled={isRunning} className="shrink-0 gap-2">
          <RefreshCw className={`h-4 w-4 ${isRunning ? "animate-spin" : ""}`} />
          {isRunning ? "Buscando..." : "Buscar Notícias Agora"}
        </Button>
      </div>

      {/* Terminal de logs */}
      {(isRunning || logs.length > 0) && (
        <div className="rounded-lg border border-gray-700 bg-gray-950 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-700">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-2 text-xs text-gray-400 font-mono">coletar-noticias-gv</span>
            {isRunning && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-yellow-400">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                rodando...
              </span>
            )}
          </div>

          <div className="p-4 h-64 overflow-y-auto font-mono text-xs space-y-0.5">
            {logs.map((line, i) => (
              <div key={i} className={LOG_COLORS[line.kind]}>
                <span className="select-none text-gray-600 mr-2">{String(i + 1).padStart(3, "0")}</span>
                {line.msg}
              </div>
            ))}
            {isRunning && logs.length === 0 && (
              <div className="text-gray-500 animate-pulse">Aguardando resposta da função...</div>
            )}
            <div ref={logEndRef} />
          </div>

          {/* Resumo final */}
          {lastResult && (
            <div className="border-t border-gray-700 bg-gray-900 px-4 py-3 grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-green-400">{lastResult.inseridas}</p>
                <p className="text-xs text-gray-500">Inseridas</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-400">{lastResult.duplicadas_url + lastResult.duplicadas_titulo}</p>
                <p className="text-xs text-gray-500">Duplicadas</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-400">{lastResult.antigas_rejeitadas}</p>
                <p className="text-xs text-gray-500">Antigas</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-yellow-400">{lastResult.urls_invalidas + lastResult.sem_conteudo + lastResult.sem_imagens_validas}</p>
                <p className="text-xs text-gray-500">Rejeitadas</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fontes detectadas */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
          <Rss className="h-4 w-4" />
          Fontes ativas
        </h4>

        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Carregando...</div>
        ) : fontes.length === 0 ? (
          <div className="text-center py-8 border rounded-lg bg-muted/30">
            <Globe className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma fonte detectada ainda</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {fontes.map((fonte) => (
              <div key={fonte.nome} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${fonte.total > 0 ? "bg-green-100" : "bg-gray-100"}`}>
                    {fonte.total > 0
                      ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                      : <Globe className="h-4 w-4 text-gray-400" />
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{fonte.nome}</p>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 uppercase">{fonte.tipo}</span>
                    </div>
                    <a href={fonte.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate max-w-xs">
                      {fonte.url}<ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{fonte.total} artigo{fonte.total !== 1 ? "s" : ""}</span>
                  {fonte.ultima && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(fonte.ultima).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adicionar nova fonte */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Adicionar nova fonte
        </h4>
        <div className="flex gap-2">
          <Input placeholder="Nome da fonte (ex: Diário do Rio Doce)" value={novaFonte}
            onChange={(e) => setNovaFonte(e.target.value)} className="flex-1" />
          <Input placeholder="URL do site (ex: https://drd.com.br)" value={novaUrl}
            onChange={(e) => setNovaUrl(e.target.value)} className="flex-1" />
          <Button variant="default" className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure aqui as fontes e o sistema irá buscar automaticamente as notícias para esta cidade.
        </p>
      </div>

    </div>
  );
};

export default AdminCidadeScraping;
