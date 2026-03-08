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
  Trash2,
  PowerOff,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AdminCidadeScrapingProps {
  cidadeId: string;
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

interface FonteConfig {
  id: string;
  nome: string;
  tipo: "rss" | "html";
  url: string;
  local_gv: boolean;
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

const AdminCidadeScraping = ({ cidadeId }: AdminCidadeScrapingProps) => {
  const queryClient = useQueryClient();
  const [novaFonte, setNovaFonte] = useState("");
  const [novaUrl, setNovaUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [lastResult, setLastResult] = useState<ScrapingResult | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const { data: artigosScrapados, isLoading } = useQuery({
    queryKey: ["admin-cidade-scraping-artigos", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_jornal")
        .select("id, titulo, fonte, id_externo, created_at, data_noticia")
        .eq("cidade_id", cidadeId)
        .not("id_externo", "is", null)
        .order("data_noticia", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: fontesConfig = [], isLoading: isLoadingFontes } = useQuery({
    queryKey: ["admin-cidade-scraping-fontes", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade_scraping_fonte")
        .select("id, nome, tipo, url, local_gv, ativo, ordem, created_at")
        .eq("cidade_id", cidadeId)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FonteConfig[];
    },
  });

  const { data: scrapingConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["admin-cidade-scraping-config", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade_scraping_config")
        .select("cidade_id, auto_ativo, intervalo_horas, lookback_dias, max_artigos, rewrite_ai, validate_ai")
        .eq("cidade_id", cidadeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const statsMap: Record<string, { total: number; ultima: string }> = {};
  if (artigosScrapados) {
    for (const item of artigosScrapados) {
      if (!item.fonte) continue;
      const dataComparacao = item.data_noticia || item.created_at;
      if (!statsMap[item.fonte]) {
        statsMap[item.fonte] = { total: 0, ultima: dataComparacao };
      }
      statsMap[item.fonte].total++;
      if (new Date(dataComparacao) > new Date(statsMap[item.fonte].ultima)) {
        statsMap[item.fonte].ultima = dataComparacao;
      }
    }
  }

  const fontes = fontesConfig.map((f) => ({
    ...f,
    total: statsMap[f.nome]?.total ?? 0,
    ultima: statsMap[f.nome]?.ultima ?? null,
  }));

  async function handleAddFonte() {
    const nome = novaFonte.trim();
    const url = novaUrl.trim();

    if (!nome || !url) {
      toast.error("Preencha nome e URL da fonte.");
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      toast.error("A URL precisa começar com http:// ou https://");
      return;
    }

    const tipo: "rss" | "html" = /rss|feed|\.xml($|\?)/i.test(url) ? "rss" : "html";

    const ordemBase = fontesConfig.length > 0
      ? Math.max(...fontesConfig.map((f) => f.ordem ?? 0)) + 1
      : 1;

    const { error } = await supabase.from("cidade_scraping_fonte").insert({
      cidade_id: cidadeId,
      nome,
      tipo,
      url,
      local_gv: true,
      ativo: true,
      ordem: ordemBase,
    });

    if (error) {
      toast.error(`Erro ao adicionar fonte: ${error.message}`);
      return;
    }

    toast.success("Fonte adicionada com sucesso.");
    setNovaFonte("");
    setNovaUrl("");
    queryClient.invalidateQueries({ queryKey: ["admin-cidade-scraping-fontes", cidadeId] });
  }

  async function handleDisableFonte(fonteId: string, fonteNome: string) {
    if (!confirm(`Desativar a fonte "${fonteNome}"?`)) return;

    const { error } = await supabase
      .from("cidade_scraping_fonte")
      .update({ ativo: false })
      .eq("id", fonteId)
      .eq("cidade_id", cidadeId);

    if (error) {
      toast.error(`Erro ao desativar fonte: ${error.message}`);
      return;
    }

    toast.success(`Fonte "${fonteNome}" desativada.`);
    queryClient.invalidateQueries({ queryKey: ["admin-cidade-scraping-fontes", cidadeId] });
  }

  async function handleDeleteByFonte(fonteNome: string) {
    if (!confirm(`Deletar todos os artigos coletados de "${fonteNome}"?`)) return;
    const { error } = await supabase
      .from("rel_cidade_jornal")
      .delete()
      .eq("cidade_id", cidadeId)
      .eq("fonte", fonteNome)
      .not("id_externo", "is", null);
    if (error) {
      toast.error("Erro ao deletar: " + error.message);
    } else {
      toast.success(`Artigos de "${fonteNome}" deletados`);
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-scraping-artigos", cidadeId] });
    }
  }

  async function handleDeleteAll() {
    if (!confirm("Deletar TODOS os artigos coletados por scraping desta cidade?")) return;
    const { error } = await supabase
      .from("rel_cidade_jornal")
      .delete()
      .eq("cidade_id", cidadeId)
      .not("id_externo", "is", null);
    if (error) {
      toast.error("Erro ao deletar: " + error.message);
    } else {
      toast.success("Todos os artigos de scraping deletados");
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-scraping-artigos", cidadeId] });
    }
  }

  async function handleToggleAutoBusca() {
    const novoValor = !(scrapingConfig?.auto_ativo === true);
    const payload = {
      cidade_id: cidadeId,
      auto_ativo: novoValor,
      intervalo_horas: 3,
      lookback_dias: 2,
      max_artigos: 60,
      rewrite_ai: true,
      validate_ai: true,
    };

    const { error } = await supabase
      .from("cidade_scraping_config")
      .upsert(payload, { onConflict: "cidade_id" });

    if (error) {
      toast.error(`Erro ao atualizar busca automática: ${error.message}`);
      return;
    }

    toast.success(novoValor ? "Busca automática ativada." : "Busca automática desativada.");
    queryClient.invalidateQueries({ queryKey: ["admin-cidade-scraping-config", cidadeId] });
  }

  function addLog(msg: string, kind: LogLine["kind"] = "info") {
    setLogs((prev) => [...prev, { msg, kind }]);
  }

  async function handleBuscarAgora() {
    setIsRunning(true);
    setLogs([]);
    setLastResult(null);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const endpoint = `${supabaseUrl}/functions/v1/coletar-noticias-gv`;

    addLog(`Endpoint: ${endpoint}`);
    addLog(
      `Key: ${supabaseKey ? `${supabaseKey.slice(0, 20)}...` : "NAO ENCONTRADA"}`,
      supabaseKey ? "info" : "err",
    );

    try {
      addLog("Enviando requisicao...");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          stream: true,
          test_mode: false,
          cidade_id: cidadeId,
          lookback_days: 2,
          validate_ai: true,
          rewrite_ai: true,
        }),
      });

      addLog(
        `Resposta recebida: HTTP ${response.status} ${response.statusText}`,
        response.ok ? "ok" : "err",
      );
      addLog(`Content-Type: ${response.headers.get("content-type") ?? "(vazio)"}`);

      if (!response.ok) {
        let body = "";
        try {
          body = await response.text();
        } catch {
          // ignore
        }
        addLog(`Corpo do erro: ${body.slice(0, 300)}`, "err");
        return;
      }

      if (!response.body) {
        addLog("Resposta sem body (streaming nao suportado?)", "err");
        return;
      }

      addLog("Streaming iniciado, aguardando eventos...", "ok");

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
              setLastResult(data as ScrapingResult);
              queryClient.invalidateQueries({ queryKey: ["admin-cidade-scraping-artigos", cidadeId] });
            } else if (data.type === "error") {
              setLogs((prev) => [...prev, { msg: `Erro interno: ${data.msg}`, kind: "err" }]);
            }
          } catch {
            // ignore malformed
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">Scraping de Noticias</h3>
          <p className="text-sm text-muted-foreground">
            Fontes configuradas para coleta automatica de noticias desta cidade
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={scrapingConfig?.auto_ativo ? "default" : "outline"}
            onClick={handleToggleAutoBusca}
            disabled={isLoadingConfig}
            className="shrink-0 gap-2"
          >
            <Bot className="h-4 w-4" />
            {scrapingConfig?.auto_ativo ? "Busca automática: ATIVA" : "Busca automática: INATIVA"}
          </Button>
          <Button onClick={handleBuscarAgora} disabled={isRunning} className="shrink-0 gap-2">
            <RefreshCw className={`h-4 w-4 ${isRunning ? "animate-spin" : ""}`} />
            {isRunning ? "Buscando..." : "Buscar Noticias Agora"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Quando ativa, executa scraping no servidor a cada 3 horas, mesmo com o PC desligado.
      </p>

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
              <div className="text-gray-500 animate-pulse">Aguardando resposta da funcao...</div>
            )}
            <div ref={logEndRef} />
          </div>

          {lastResult && (
            <div className="border-t border-gray-700 bg-gray-900 px-4 py-3 grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-green-400">{lastResult.inseridas}</p>
                <p className="text-xs text-gray-500">Inseridas</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-400">
                  {lastResult.duplicadas_url + lastResult.duplicadas_titulo}
                </p>
                <p className="text-xs text-gray-500">Duplicadas</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-400">{lastResult.antigas_rejeitadas}</p>
                <p className="text-xs text-gray-500">Antigas</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-yellow-400">
                  {lastResult.urls_invalidas + lastResult.sem_conteudo + lastResult.sem_imagens_validas}
                </p>
                <p className="text-xs text-gray-500">Rejeitadas</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
            <Rss className="h-4 w-4" />
            Fontes ativas ({fontes.reduce((s, f) => s + f.total, 0)} artigos)
          </h4>
          {fontes.some((f) => f.total > 0) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5"
              onClick={handleDeleteAll}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Deletar todos
            </Button>
          )}
        </div>

        {isLoading || isLoadingFontes ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Carregando...</div>
        ) : fontes.length === 0 ? (
          <div className="text-center py-8 border rounded-lg bg-muted/30">
            <Globe className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma fonte ativa configurada</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {fontes.map((fonte) => (
              <div key={fonte.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      fonte.total > 0 ? "bg-green-100" : "bg-gray-100"
                    }`}
                  >
                    {fonte.total > 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Globe className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{fonte.nome}</p>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 uppercase">
                        {fonte.tipo}
                      </span>
                    </div>
                    <a
                      href={fonte.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate max-w-xs"
                    >
                      {fonte.url}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{fonte.total} artigo{fonte.total !== 1 ? "s" : ""}</span>
                  {fonte.ultima && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(fonte.ultima).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  <button
                    onClick={() => handleDisableFonte(fonte.id, fonte.nome)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                    title={`Desativar fonte ${fonte.nome}`}
                  >
                    <PowerOff className="h-3.5 w-3.5" />
                  </button>
                  {fonte.total > 0 && (
                    <button
                      onClick={() => handleDeleteByFonte(fonte.nome)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title={`Deletar artigos de ${fonte.nome}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Adicionar nova fonte
        </h4>
        <div className="flex gap-2">
          <Input
            placeholder="Nome da fonte (ex: Diario do Rio Doce)"
            value={novaFonte}
            onChange={(e) => setNovaFonte(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="URL da fonte (ex: https://drd.com.br)"
            value={novaUrl}
            onChange={(e) => setNovaUrl(e.target.value)}
            className="flex-1"
          />
          <Button variant="default" className="shrink-0" onClick={handleAddFonte}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          As fontes ativas sao lidas dinamicamente do banco e usadas no scraping desta cidade.
        </p>
      </div>
    </div>
  );
};

export default AdminCidadeScraping;


