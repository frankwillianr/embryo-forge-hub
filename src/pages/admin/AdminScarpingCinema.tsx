import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Clock3,
  CheckCircle2,
  Film,
  Globe,
  Loader2,
  Pencil,
  Play,
  Plus,
  Rss,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const parseInvokeError = async (err: unknown): Promise<string> => {
  const e = err as {
    message?: string;
    status?: number;
    context?: Response;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
    error?: unknown;
  };

  const lines: string[] = [];
  if (typeof e.status === "number") lines.push(`status: ${e.status}`);
  if (e.message) lines.push(`message: ${e.message}`);

  if (e.context) {
    lines.push(`response_status: ${e.context.status}`);
    lines.push(`response_status_text: ${e.context.statusText}`);
    try {
      const raw = await e.context.text();
      if (raw) lines.push(`response_body: ${raw.slice(0, 1000)}`);
    } catch {
      lines.push("response_body: <nao foi possivel ler>");
    }
  }

  if (e.code !== undefined) lines.push(`code: ${String(e.code)}`);
  if (e.hint !== undefined) lines.push(`hint: ${String(e.hint)}`);
  if (e.details !== undefined) lines.push(`details: ${String(e.details)}`);
  if (e.error !== undefined) lines.push(`error: ${String(e.error)}`);

  return lines.length ? lines.join("\n") : "Erro desconhecido ao executar o agente.";
};

const formatDiaBr = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const getYoutubeEmbedUrl = (raw: string | null): string | null => {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  if (/^[a-zA-Z0-9_-]{8,15}$/.test(value)) {
    return `https://www.youtube.com/embed/${value}`;
  }

  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    if (host.includes("youtube.com")) {
      if (u.pathname.startsWith("/watch")) {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith("/embed/")) return value;
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/shorts/")[1]?.split(/[/?#]/)[0];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
    if (host.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").split(/[/?#]/)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }

  return null;
};

const getYoutubeWatchUrl = (raw: string | null): string | null => {
  if (!raw) return null;
  const embed = getYoutubeEmbedUrl(raw);
  if (!embed) return null;
  const m = embed.match(/\/embed\/([A-Za-z0-9_-]{6,})/);
  if (!m) return null;
  return `https://www.youtube.com/watch?v=${m[1]}`;
};

interface CinemaFonte {
  id: string;
  cidade_id: string;
  nome: string;
  url: string;
  tipo: "rss" | "html" | "auto";
  ativo: boolean;
  ordem: number;
  created_at: string;
}

const getPosterCandidates = (url: string): string[] => {
  const u = url.trim();
  if (!u) return [];

  const out = [u];
  out.push(u.replace("://www.", "://"));
  out.push(u.replace("://claquete.com.br", "://www.claquete.com.br"));
  out.push(u.replace("://www.claquete.com.br", "://claquete.com.br"));

  if (u.includes("/poster/")) {
    out.push(u.replace("/poster/", "/banner1920/"));
    out.push(u.replace("_medio", ""));
  }

  return [...new Set(out.filter(Boolean))];
};

const MoviePoster = ({ posterUrl, titulo }: { posterUrl: string | null; titulo: string }) => {
  const candidates = useMemo(() => (posterUrl ? getPosterCandidates(posterUrl) : []), [posterUrl]);
  const [index, setIndex] = useState(0);

  if (!posterUrl || candidates.length === 0 || index >= candidates.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <Film className="h-8 w-8" />
      </div>
    );
  }

  return (
    <img
      src={candidates[index]}
      alt={titulo}
      className="w-full h-full object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setIndex((prev) => prev + 1)}
    />
  );
};

const MovieTrailer = ({ trailerUrl, titulo }: { trailerUrl: string | null; titulo: string }) => {
  const embedUrl = useMemo(() => getYoutubeEmbedUrl(trailerUrl), [trailerUrl]);
  const watchUrl = useMemo(() => getYoutubeWatchUrl(trailerUrl), [trailerUrl]);
  if (!embedUrl) return null;

  return (
    <div className="border-t border-gray-200 bg-black">
      <iframe
        src={embedUrl}
        title={`Trailer - ${titulo}`}
        className="w-full"
        style={{ height: 190 }}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
      {watchUrl && (
        <div className="bg-white px-2 py-1.5 border-t border-gray-200">
          <a
            href={watchUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            Abrir trailer no YouTube
          </a>
        </div>
      )}
    </div>
  );
};

const AdminScarpingCinema = () => {
  const defaultCidadeId =
    typeof window !== "undefined" ? window.localStorage.getItem("admin:selectedCidadeId") || "" : "";

  const [cidadeIdSelecionada] = useState(defaultCidadeId);
  const [novoNome, setNovoNome] = useState("");
  const [novoUrl, setNovoUrl] = useState("");
  const [novoTipo, setNovoTipo] = useState<"rss" | "html" | "auto">("auto");
  const [editingFonteId, setEditingFonteId] = useState<string | null>(null);
  const [maxFilmes, setMaxFilmes] = useState("60");
  const [lookbackDias, setLookbackDias] = useState("14");
  const [isRunning, setIsRunning] = useState(false);
  const [isSavingFonte, setIsSavingFonte] = useState(false);
  const [isSavingAutoCinema, setIsSavingAutoCinema] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<any>(null);
  const [fonteError, setFonteError] = useState<string | null>(null);

  const { data: cidadeSelecionada } = useQuery({
    queryKey: ["admin-cidade-selecionada-scraping-cinema", cidadeIdSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome")
        .eq("id", cidadeIdSelecionada)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; nome: string } | null;
    },
    enabled: !!cidadeIdSelecionada,
  });

  const {
    data: fontes = [],
    isLoading: loadingFontes,
    refetch: refetchFontes,
  } = useQuery({
    queryKey: ["admin-scraping-cinema-fontes", cidadeIdSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade_scraping_cinema_fonte")
        .select("id, cidade_id, nome, url, tipo, ativo, ordem, created_at")
        .eq("cidade_id", cidadeIdSelecionada)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as CinemaFonte[];
    },
    enabled: !!cidadeIdSelecionada,
  });

  const {
    data: filmesScraping = [],
    isLoading: loadingFilmesScraping,
    refetch: refetchFilmesScraping,
  } = useQuery({
    queryKey: ["admin-filmes-scraping", cidadeIdSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("filmes_scraping")
        .select("id, titulo, poster_url, trailer_url, genero, duracao, classificacao, idioma, data_estreia, horarios, dias_exibicao, situacao_exibicao, fonte_nome, url_origem, created_at")
        .eq("cidade_id", cidadeIdSelecionada)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        titulo: string;
        poster_url: string | null;
        trailer_url: string | null;
        genero: string | null;
        duracao: string | null;
        classificacao: string | null;
        idioma: string | null;
        data_estreia: string | null;
        horarios: string[] | null;
        dias_exibicao: string[] | null;
        situacao_exibicao: "em_cartaz" | "em_breve" | "pre_venda" | "desconhecido" | null;
        fonte_nome: string | null;
        url_origem: string | null;
        created_at: string;
      }>;
    },
    enabled: !!cidadeIdSelecionada,
  });

  const {
    data: autoCinemaConfig,
    refetch: refetchAutoCinemaConfig,
  } = useQuery({
    queryKey: ["admin-auto-cinema-config", cidadeIdSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade_scraping_config")
        .select("cidade_id, cinema_auto_ativo")
        .eq("cidade_id", cidadeIdSelecionada)
        .maybeSingle();
      if (error) throw error;
      return (data as { cidade_id: string; cinema_auto_ativo?: boolean } | null) ?? null;
    },
    enabled: !!cidadeIdSelecionada,
  });

  const autoCinemaAtivo = autoCinemaConfig?.cinema_auto_ativo === true;

  const sitesAtivos = useMemo(
    () => fontes.filter((f) => f.ativo).map((f) => f.url),
    [fontes],
  );

  const resetFormFonte = () => {
    setEditingFonteId(null);
    setNovoNome("");
    setNovoUrl("");
    setNovoTipo("auto");
    setFonteError(null);
  };

  const validarFonte = () => {
    if (!novoNome.trim()) return "Informe o nome da fonte.";
    if (!novoUrl.trim()) return "Informe a URL do site.";
    try {
      const parsed = new URL(novoUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) return "URL invalida.";
    } catch {
      return "URL invalida.";
    }
    return null;
  };

  const salvarFonte = async () => {
    setFonteError(null);
    const erro = validarFonte();
    if (erro) {
      setFonteError(erro);
      return;
    }
    if (!cidadeIdSelecionada) {
      setFonteError("Nenhuma cidade selecionada.");
      return;
    }

    setIsSavingFonte(true);
    try {
      if (editingFonteId) {
        const { error } = await supabase
          .from("cidade_scraping_cinema_fonte")
          .update({
            nome: novoNome.trim(),
            url: novoUrl.trim(),
            tipo: novoTipo,
          })
          .eq("id", editingFonteId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cidade_scraping_cinema_fonte").insert({
          cidade_id: cidadeIdSelecionada,
          nome: novoNome.trim(),
          url: novoUrl.trim(),
          tipo: novoTipo,
          ativo: true,
          ordem: (fontes.length + 1) * 10,
        });
        if (error) throw error;
      }

      resetFormFonte();
      await refetchFontes();
    } catch (e: any) {
      setFonteError(e?.message || "Falha ao salvar fonte.");
    } finally {
      setIsSavingFonte(false);
    }
  };

  const editarFonte = (fonte: CinemaFonte) => {
    setEditingFonteId(fonte.id);
    setNovoNome(fonte.nome);
    setNovoUrl(fonte.url);
    setNovoTipo(fonte.tipo);
    setFonteError(null);
  };

  const excluirFonte = async (id: string) => {
    const confirmar = window.confirm("Excluir esta fonte?");
    if (!confirmar) return;
    const { error } = await supabase.from("cidade_scraping_cinema_fonte").delete().eq("id", id);
    if (!error) {
      if (editingFonteId === id) resetFormFonte();
      await refetchFontes();
    }
  };

  const alternarAtiva = async (fonte: CinemaFonte) => {
    const { error } = await supabase
      .from("cidade_scraping_cinema_fonte")
      .update({ ativo: !fonte.ativo })
      .eq("id", fonte.id);
    if (!error) await refetchFontes();
  };

  const validar = () => {
    if (!cidadeIdSelecionada) return "Nenhuma cidade selecionada no menu lateral do admin.";
    if (sitesAtivos.length === 0) return "Cadastre e ative ao menos um site.";
    for (const site of sitesAtivos) {
      try {
        const parsed = new URL(site);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return `URL invalida: ${site}`;
        }
      } catch {
        return `URL invalida: ${site}`;
      }
    }
    const maxNum = Number(maxFilmes);
    const lookbackNum = Number(lookbackDias);
    if (!Number.isFinite(maxNum) || maxNum <= 0) return "Maximo de filmes deve ser um numero maior que zero.";
    if (!Number.isFinite(lookbackNum) || lookbackNum <= 0) return "Lookback (dias) deve ser um numero maior que zero.";
    return null;
  };

  const executarAgenteBuscador = async () => {
    setRunError(null);
    setRunResult(null);

    const erro = validar();
    if (erro) {
      setRunError(erro);
      return;
    }

    setIsRunning(true);
    try {
      const token = await getFreshAccessToken();
      if (!token) {
        throw new Error("Sessao expirada. Faca login novamente no painel admin.");
      }

      const payload = {
        cidade_id: cidadeIdSelecionada,
        sites: sitesAtivos,
        max_filmes: Number(maxFilmes),
        lookback_dias: Number(lookbackDias),
      };

      const { data, error } = await supabase.functions.invoke("agente_cinema_buscador_01", {
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });

      if (error) throw error;
      setRunResult(data);
      await refetchFilmesScraping();
    } catch (e: unknown) {
      const detalhe = await parseInvokeError(e);
      setRunError(detalhe);
    } finally {
      setIsRunning(false);
    }
  };

  const toggleAutoCinema = async () => {
    if (!cidadeIdSelecionada) return;
    setIsSavingAutoCinema(true);
    setFonteError(null);
    try {
      const novoValor = !autoCinemaAtivo;
      const payload = {
        cidade_id: cidadeIdSelecionada,
        cinema_auto_ativo: novoValor,
      } as any;

      const { error } = await supabase
        .from("cidade_scraping_config")
        .upsert(payload, { onConflict: "cidade_id" });
      if (error) throw error;
      await refetchAutoCinemaConfig();
    } catch (e: any) {
      setFonteError(e?.message || "Falha ao atualizar busca automatica de cinema.");
    } finally {
      setIsSavingAutoCinema(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Scarping cinema</h1>
        <p className="text-sm text-gray-500 mt-1">Agente 1: buscador de filmes nos sites informados.</p>
      </div>

      <div className="border border-blue-100 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center gap-2.5">
            <Search className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">Agente Buscador</span>
          </div>
        </div>

        <div className="p-5 bg-white space-y-4">
          <div className="space-y-2">
            <Label>Cidade</Label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {cidadeSelecionada?.nome || "Nenhuma cidade selecionada"}
            </div>
            <p className="text-xs text-gray-500">
              Esta tela sempre usa a cidade atualmente selecionada no menu lateral do admin.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Fontes de sites</Label>
            {loadingFontes ? (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando fontes...
              </div>
            ) : fontes.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma fonte cadastrada.</p>
            ) : (
              <div className="border rounded-lg divide-y">
                {fontes.map((fonte) => (
                  <div key={fonte.id} className="flex items-center gap-3 px-3 py-2">
                    <button
                      onClick={() => alternarAtiva(fonte)}
                      className={`h-2.5 w-2.5 rounded-full ${fonte.ativo ? "bg-emerald-500" : "bg-gray-300"}`}
                      title={fonte.ativo ? "Fonte ativa" : "Fonte inativa"}
                    />
                    {fonte.tipo === "rss" ? (
                      <Rss className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{fonte.nome}</p>
                      <p className="text-xs text-gray-500 truncate">{fonte.url}</p>
                    </div>
                    <span className="text-xs border rounded px-1.5 py-0.5 text-gray-600">{fonte.tipo}</span>
                    <button
                      onClick={() => editarFonte(fonte)}
                      className="text-gray-400 hover:text-gray-700"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => excluirFonte(fonte.id)}
                      className="text-gray-400 hover:text-red-600"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label>{editingFonteId ? "Editar site" : "Adicionar site"}</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nome da fonte"
              />
              <Input
                value={novoUrl}
                onChange={(e) => setNovoUrl(e.target.value)}
                placeholder="https://site.com/cinema"
                className="md:col-span-2"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v as "rss" | "html" | "auto")}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">auto</SelectItem>
                  <SelectItem value="html">html</SelectItem>
                  <SelectItem value="rss">rss</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={salvarFonte} disabled={isSavingFonte} className="gap-2">
                {isSavingFonte ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingFonteId ? "Salvar edicao" : "Adicionar"}
              </Button>

              {editingFonteId && (
                <Button type="button" variant="outline" onClick={resetFormFonte}>
                  Cancelar
                </Button>
              )}
            </div>
            {fonteError && <p className="text-xs text-red-600">{fonteError}</p>}
            <p className="text-xs text-gray-500">
              Ativas: <span className="font-medium">{sitesAtivos.length}</span> de{" "}
              <span className="font-medium">{fontes.length}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Maximo de filmes</Label>
              <Input
                type="number"
                min={1}
                value={maxFilmes}
                onChange={(e) => setMaxFilmes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Lookback (dias)</Label>
              <Input
                type="number"
                min={1}
                value={lookbackDias}
                onChange={(e) => setLookbackDias(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={toggleAutoCinema}
                disabled={!cidadeIdSelecionada || isSavingAutoCinema}
                variant={autoCinemaAtivo ? "default" : "outline"}
                className="gap-2"
              >
                {isSavingAutoCinema ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock3 className="h-4 w-4" />
                )}
                {autoCinemaAtivo ? "Busca automatica: ATIVA" : "Ativar busca automatica"}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Quando ativa, roda automaticamente o agente de cinema todos os dias as 07:00 e as
              10:00.
            </p>
          </div>

          <Button
            onClick={executarAgenteBuscador}
            disabled={isRunning || !cidadeIdSelecionada}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Executando Agente 1...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Iniciar Agente 1
              </>
            )}
          </Button>

          {runError && (
            <pre className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs whitespace-pre-wrap break-words text-red-700">
              {runError}
            </pre>
          )}

          {runResult && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <p className="font-medium mb-1">Agente executado com sucesso.</p>
              <pre className="text-xs whitespace-pre-wrap break-words text-emerald-800">
                {JSON.stringify(runResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-gray-500" />
            <p className="text-sm font-semibold text-gray-900">Filmes encontrados</p>
            {!loadingFilmesScraping && (
              <span className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">
                {filmesScraping.length}
              </span>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => refetchFilmesScraping()}>
            Atualizar lista
          </Button>
        </div>

        {loadingFilmesScraping ? (
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando filmes...
          </div>
        ) : filmesScraping.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum filme coletado ainda para esta cidade.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filmesScraping.map((filme) => (
              <div key={filme.id} className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                <div className="h-40 bg-gray-100">
                  <MoviePoster posterUrl={filme.poster_url} titulo={filme.titulo} />
                </div>
                <MovieTrailer trailerUrl={filme.trailer_url} titulo={filme.titulo} />
                <div className="p-3 space-y-1.5">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">{filme.titulo}</p>                  <p className="text-xs text-gray-500 line-clamp-1">
                    Situacao:{" "}
                    {filme.situacao_exibicao === "em_cartaz"
                      ? "Em cartaz"
                      : filme.situacao_exibicao === "em_breve"
                        ? "Em breve"
                        : filme.situacao_exibicao === "pre_venda"
                          ? "Pre-venda"
                          : "Desconhecido"}
                  </p>                  <p className="text-xs text-gray-500 line-clamp-1">
                    {filme.genero || "Genero n/i"} - {filme.duracao || "Duracao n/i"}
                  </p>
                  <p className="text-xs text-gray-500 line-clamp-1">
                    Estreia: {filme.data_estreia || "n/i"} - Classificacao: {filme.classificacao || "n/i"}
                  </p>
                  {Array.isArray(filme.horarios) && filme.horarios.length > 0 && (
                    <p className="text-xs text-gray-500 line-clamp-2">
                      Horarios: {filme.horarios.join(", ")}
                    </p>
                  )}
                  {Array.isArray(filme.dias_exibicao) && filme.dias_exibicao.length > 0 && (
                    <p className="text-xs text-gray-500 line-clamp-2">
                      Dias: {filme.dias_exibicao.map(formatDiaBr).join(", ")}
                    </p>
                  )}
                  {filme.url_origem && (
                    <a
                      href={filme.url_origem}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline line-clamp-1 inline-block"
                    >
                      Ver origem
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold text-gray-900">Proximo passo</p>
        </div>
        <p className="text-sm text-gray-600">
          Fontes agora estao com CRUD completo e persistencia por cidade.
        </p>
      </div>
    </div>
  );
};

export default AdminScarpingCinema;

