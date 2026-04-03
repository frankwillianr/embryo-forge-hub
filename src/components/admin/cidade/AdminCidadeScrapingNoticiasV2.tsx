import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, FileText, Image as ImageIcon, ArrowRight,
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
  created_at: string;
}

interface AgentRun {
  status: AgentStatus;
  inseridos?: number;
  logs?: string[];
  erro?: string;
}

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

  // ── Noticias coletadas query ───────────────────────────────────────────────

  const { data: noticias = [], isLoading: loadingNoticias } = useQuery<NoticiaColetada[]>({
    queryKey: ["tabela_agente_buscador", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabela_agente_buscador")
        .select("id, url, titulo, descricao, lista_imagens, fonte_nome, data_publicacao, status, created_at")
        .eq("cidade_id", cidadeId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as NoticiaColetada[];
    },
    enabled: !!cidadeId,
  });

  // ── Modal de noticia ──────────────────────────────────────────────────────

  const [modalNoticia, setModalNoticia] = useState<NoticiaColetada | null>(null);
  const [imgIndex, setImgIndex] = useState(0);

  const abrirModal = (n: NoticiaColetada) => { setModalNoticia(n); setImgIndex(0); };
  const fecharModal = () => setModalNoticia(null);

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

  const iniciarAgente1 = async () => {
    if (fontes.filter((f) => f.ativo).length === 0) {
      setAgent1({ status: "error", erro: "Cadastre ao menos uma fonte ativa antes de iniciar." });
      return;
    }
    setAgent1({ status: "running" });
    try {
      const { data, error } = await supabase.functions.invoke("agente_buscador_01", {
        body: { cidade_id: cidadeId, lookback_days: 7, max_articles: 60 },
      });
      if (error) throw error;
      setAgent1({ status: "done", inseridos: data?.inseridos ?? 0, logs: data?.logs ?? [] });
      queryClient.invalidateQueries({ queryKey: ["tabela_agente_buscador", cidadeId] });
    } catch (e) {
      setAgent1({ status: "error", erro: String(e) });
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

  // ─── Render ───────────────────────────────────────────────────────────────

  const a1Running = agent1.status === "running";
  const a1Done    = agent1.status === "done";
  const a1Error   = agent1.status === "error";
  const a1Idle    = agent1.status === "idle";

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Scraping de Noticias V2</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Pipeline de agentes para coleta e enriquecimento de noticias
        </p>
      </div>

      {/* ── Pipeline cards ─────────────────────────────────────────────────── */}
      <div className="flex items-stretch gap-0">

        {/* Agente 1 — Buscador (real) */}
        <div className="flex items-center flex-1 min-w-0">
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
                <p className="text-xs text-red-500 leading-snug">{agent1.erro}</p>
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
                disabled={a1Running}
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
          <div className="flex flex-col items-center px-2 shrink-0">
            <ArrowRight className="h-6 w-6 text-gray-200" />
          </div>
        </div>

        {/* Agente 2 — Texto */}
        <div className="flex items-center flex-1 min-w-0">
          <div className="flex-1 rounded-xl border-2 border-violet-200 bg-violet-50 p-5 opacity-50 grayscale">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white shadow-sm text-violet-600">
                <FileText className="h-5 w-5" />
              </div>
              <Circle className="h-5 w-5 text-gray-300 mt-0.5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agente 2</p>
              <p className="font-semibold text-gray-900 text-sm leading-snug">Agente de Texto</p>
              <p className="text-xs text-gray-500 leading-snug">
                Reescreve titulo e descricao com linguagem local
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/60">
              <p className="text-xs text-gray-300 font-medium">Aguardando agente anterior</p>
            </div>
          </div>
          <div className="flex flex-col items-center px-2 shrink-0">
            <ArrowRight className="h-6 w-6 text-gray-200" />
          </div>
        </div>

        {/* Agente 3 — Imagem */}
        <div className="flex items-center flex-1 min-w-0">
          <div className="flex-1 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 opacity-50 grayscale">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="p-2 rounded-lg bg-white shadow-sm text-emerald-600">
                <ImageIcon className="h-5 w-5" />
              </div>
              <Circle className="h-5 w-5 text-gray-300 mt-0.5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agente 3</p>
              <p className="font-semibold text-gray-900 text-sm leading-snug">Agente de Imagem</p>
              <p className="text-xs text-gray-500 leading-snug">
                Gera ou seleciona imagem adequada para a noticia
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/60">
              <p className="text-xs text-gray-300 font-medium">Aguardando agente anterior</p>
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
              {noticias.map((noticia) => (
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
              {modalNoticia.lista_imagens?.length > 0 && (
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
    </div>
  );
};

export default AdminCidadeScrapingNoticiasV2;
