import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Briefcase,
  Building2,
  Globe,
  Loader2,
  MapPin,
  Pencil,
  Play,
  Plus,
  Send,
  Rss,
  Sparkles,
  Trash2,
  Wallet,
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

interface EmpregoFonte {
  id: string;
  cidade_id: string;
  nome: string;
  url: string;
  tipo: "rss" | "html" | "auto";
  ativo: boolean;
  ordem: number;
  created_at: string;
}

interface VagaEmprego {
  id: string;
  titulo: string;
  empresa: string | null;
  descricao: string | null;
  area: string | null;
  tipo_contrato: string | null;
  salario: string | null;
  local_vaga: string | null;
  url_origem: string | null;
  fonte_nome: string | null;
  contato: string | null;
  created_at: string;
}

const getFreshAccessToken = async (): Promise<string | null> => {
  const current = await supabase.auth.getSession();
  let session = current.data.session;
  if (!session) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresSoon =
    typeof session.expires_at === "number" && session.expires_at <= nowSec + 30;
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
    code?: unknown;
    error?: unknown;
  };
  const lines: string[] = [];
  if (typeof e.status === "number") lines.push(`status: ${e.status}`);
  if (e.message) lines.push(`message: ${e.message}`);
  if (e.context) {
    lines.push(`response_status: ${e.context.status}`);
    try {
      const raw = await e.context.text();
      if (raw) lines.push(`response_body: ${raw.slice(0, 1000)}`);
    } catch {
      lines.push("response_body: <nao foi possivel ler>");
    }
  }
  if (e.code !== undefined) lines.push(`code: ${String(e.code)}`);
  if (e.error !== undefined) lines.push(`error: ${String(e.error)}`);
  return lines.length ? lines.join("\n") : "Erro desconhecido ao executar o agente.";
};

const AdminScrapingEmprego = () => {
  const defaultCidadeId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("admin:selectedCidadeId") || ""
      : "";

  const [cidadeIdSelecionada] = useState(defaultCidadeId);
  const [novoNome, setNovoNome] = useState("");
  const [novoUrl, setNovoUrl] = useState("");
  const [novoTipo, setNovoTipo] = useState<"rss" | "html" | "auto">("auto");
  const [editingFonteId, setEditingFonteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [maxVagas, setMaxVagas] = useState("60");
  const [lookbackDias, setLookbackDias] = useState("14");
  const [fonteError, setFonteError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<any>(null);
  const [isRunningTexto2, setIsRunningTexto2] = useState(false);
  const [runTexto2Error, setRunTexto2Error] = useState<string | null>(null);
  const [runTexto2Result, setRunTexto2Result] = useState<any>(null);
  const [isRunningPreco3, setIsRunningPreco3] = useState(false);
  const [runPreco3Error, setRunPreco3Error] = useState<string | null>(null);
  const [runPreco3Result, setRunPreco3Result] = useState<any>(null);
  const [isRunningPublicador3, setIsRunningPublicador3] = useState(false);
  const [runPublicador3Error, setRunPublicador3Error] = useState<string | null>(null);
  const [runPublicador3Result, setRunPublicador3Result] = useState<any>(null);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [runPipelineError, setRunPipelineError] = useState<string | null>(null);
  const [runPipelineResult, setRunPipelineResult] = useState<any>(null);
  const [isDeletingVagasColetadas, setIsDeletingVagasColetadas] = useState(false);
  const [deleteVagasColetadasError, setDeleteVagasColetadasError] = useState<string | null>(null);
  const [isSavingAutoPublicacao, setIsSavingAutoPublicacao] = useState(false);

  const { data: cidadeSelecionada } = useQuery({
    queryKey: ["admin-cidade-selecionada-scraping-emprego", cidadeIdSelecionada],
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
    queryKey: ["admin-scraping-emprego-fontes", cidadeIdSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade_scraping_emprego_fonte")
        .select("id, cidade_id, nome, url, tipo, ativo, ordem, created_at")
        .eq("cidade_id", cidadeIdSelecionada)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as EmpregoFonte[];
    },
    enabled: !!cidadeIdSelecionada,
  });

  const {
    data: vagas = [],
    isLoading: loadingVagas,
    refetch: refetchVagas,
  } = useQuery({
    queryKey: ["admin-vagas-emprego-scraping", cidadeIdSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vagas_emprego_scraping")
        .select(
          "id, titulo, empresa, descricao, area, tipo_contrato, salario, local_vaga, url_origem, fonte_nome, contato, created_at"
        )
        .eq("cidade_id", cidadeIdSelecionada)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data || []) as VagaEmprego[];
    },
    enabled: !!cidadeIdSelecionada,
  });

  const {
    data: autoEmpregoConfig,
    refetch: refetchAutoEmpregoConfig,
  } = useQuery({
    queryKey: ["admin-auto-emprego-config", cidadeIdSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade_scraping_config")
        .select("cidade_id, emprego_auto_ativo")
        .eq("cidade_id", cidadeIdSelecionada)
        .maybeSingle();
      if (error) throw error;
      return (data as { cidade_id: string; emprego_auto_ativo?: boolean } | null) ?? null;
    },
    enabled: !!cidadeIdSelecionada,
  });

  const sitesAtivos = fontes.filter((f) => f.ativo).map((f) => f.url);
  const autoEmpregoAtivo = autoEmpregoConfig?.emprego_auto_ativo === true;

  const resetForm = () => {
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

  const salvar = async () => {
    setFonteError(null);
    const erro = validarFonte();
    if (erro) { setFonteError(erro); return; }
    if (!cidadeIdSelecionada) { setFonteError("Nenhuma cidade selecionada."); return; }

    setIsSaving(true);
    try {
      if (editingFonteId) {
        const { error } = await supabase
          .from("cidade_scraping_emprego_fonte")
          .update({ nome: novoNome.trim(), url: novoUrl.trim(), tipo: novoTipo })
          .eq("id", editingFonteId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cidade_scraping_emprego_fonte")
          .insert({
            cidade_id: cidadeIdSelecionada,
            nome: novoNome.trim(),
            url: novoUrl.trim(),
            tipo: novoTipo,
            ativo: true,
            ordem: (fontes.length + 1) * 10,
          });
        if (error) throw error;
      }
      resetForm();
      await refetchFontes();
    } catch (e: any) {
      setFonteError(e?.message || "Falha ao salvar fonte.");
    } finally {
      setIsSaving(false);
    }
  };

  const editar = (fonte: EmpregoFonte) => {
    setEditingFonteId(fonte.id);
    setNovoNome(fonte.nome);
    setNovoUrl(fonte.url);
    setNovoTipo(fonte.tipo);
    setFonteError(null);
  };

  const excluir = async (id: string) => {
    if (!window.confirm("Excluir esta fonte?")) return;
    const { error } = await supabase
      .from("cidade_scraping_emprego_fonte")
      .delete()
      .eq("id", id);
    if (!error) {
      if (editingFonteId === id) resetForm();
      await refetchFontes();
    }
  };

  const alternarAtiva = async (fonte: EmpregoFonte) => {
    const { error } = await supabase
      .from("cidade_scraping_emprego_fonte")
      .update({ ativo: !fonte.ativo })
      .eq("id", fonte.id);
    if (!error) await refetchFontes();
  };

  const executarAgente = async () => {
    setRunError(null);
    setRunResult(null);

    if (!cidadeIdSelecionada) { setRunError("Nenhuma cidade selecionada."); return; }
    if (sitesAtivos.length === 0) { setRunError("Cadastre e ative ao menos um site."); return; }

    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("agente_emprego_buscador_01", {
        body: {
          cidade_id: cidadeIdSelecionada,
          sites: sitesAtivos,
          max_vagas: Number(maxVagas),
          lookback_dias: Number(lookbackDias),
        },
      });

      if (error) throw error;
      setRunResult(data);
      await refetchVagas();
    } catch (e: unknown) {
      const detalhe = await parseInvokeError(e);
      setRunError(detalhe);
    } finally {
      setIsRunning(false);
    }
  };

  const executarAgenteTexto2 = async () => {
    setRunTexto2Error(null);
    setRunTexto2Result(null);

    if (!cidadeIdSelecionada) { setRunTexto2Error("Nenhuma cidade selecionada."); return; }

    setIsRunningTexto2(true);
    try {
      const { data, error } = await supabase.functions.invoke("agente_emprego_texto_02", {
        body: {
          cidade_id: cidadeIdSelecionada,
          limit: Number(maxVagas) || 40,
        },
      });

      if (error) throw error;
      setRunTexto2Result(data);
      await refetchVagas();
    } catch (e: unknown) {
      const detalhe = await parseInvokeError(e);
      setRunTexto2Error(detalhe);
    } finally {
      setIsRunningTexto2(false);
    }
  };

  const executarAgentePublicador3 = async () => {
    setRunPublicador3Error(null);
    setRunPublicador3Result(null);

    if (!cidadeIdSelecionada) { setRunPublicador3Error("Nenhuma cidade selecionada."); return; }

    setIsRunningPublicador3(true);
    try {
      const { data, error } = await supabase.functions.invoke("agente_emprego_publicador_04", {
        body: {
          cidade_id: cidadeIdSelecionada,
          limit: Number(maxVagas) || 120,
        },
      });

      if (error) throw error;
      setRunPublicador3Result(data);
    } catch (e: unknown) {
      const detalhe = await parseInvokeError(e);
      setRunPublicador3Error(detalhe);
    } finally {
      setIsRunningPublicador3(false);
    }
  };

  const executarAgentePreco3 = async () => {
    setRunPreco3Error(null);
    setRunPreco3Result(null);

    if (!cidadeIdSelecionada) { setRunPreco3Error("Nenhuma cidade selecionada."); return; }

    setIsRunningPreco3(true);
    try {
      const { data, error } = await supabase.functions.invoke("agente_emprego_preco_03", {
        body: {
          cidade_id: cidadeIdSelecionada,
          limit: Number(maxVagas) || 80,
        },
      });

      if (error) throw error;
      setRunPreco3Result(data);
      await refetchVagas();
    } catch (e: unknown) {
      const detalhe = await parseInvokeError(e);
      setRunPreco3Error(detalhe);
    } finally {
      setIsRunningPreco3(false);
    }
  };

  const executarPipelineAgentes = async () => {
    setRunPipelineError(null);
    setRunPipelineResult(null);
    setRunError(null);
    setRunTexto2Error(null);
    setRunPreco3Error(null);
    setRunPublicador3Error(null);

    if (!cidadeIdSelecionada) { setRunPipelineError("Nenhuma cidade selecionada."); return; }
    if (sitesAtivos.length === 0) { setRunPipelineError("Cadastre e ative ao menos um site."); return; }

    setIsRunningPipeline(true);
    try {
      const r1 = await supabase.functions.invoke("agente_emprego_buscador_01", {
        body: {
          cidade_id: cidadeIdSelecionada,
          sites: sitesAtivos,
          max_vagas: Number(maxVagas),
          lookback_dias: Number(lookbackDias),
        },
      });
      if (r1.error) throw r1.error;

      const r2 = await supabase.functions.invoke("agente_emprego_texto_02", {
        body: {
          cidade_id: cidadeIdSelecionada,
          limit: Number(maxVagas) || 40,
        },
      });
      if (r2.error) throw r2.error;

      const r3 = await supabase.functions.invoke("agente_emprego_preco_03", {
        body: {
          cidade_id: cidadeIdSelecionada,
          limit: Number(maxVagas) || 80,
        },
      });
      if (r3.error) throw r3.error;

      const r4 = await supabase.functions.invoke("agente_emprego_publicador_04", {
        body: {
          cidade_id: cidadeIdSelecionada,
          limit: Number(maxVagas) || 120,
        },
      });
      if (r4.error) throw r4.error;

      setRunPipelineResult({
        ok: true,
        buscador: r1.data,
        texto_02: r2.data,
        preco_03: r3.data,
        publicador_04: r4.data,
      });

      setRunResult(r1.data);
      setRunTexto2Result(r2.data);
      setRunPreco3Result(r3.data);
      setRunPublicador3Result(r4.data);
      await refetchVagas();
    } catch (e: unknown) {
      const detalhe = await parseInvokeError(e);
      setRunPipelineError(detalhe);
    } finally {
      setIsRunningPipeline(false);
    }
  };

  const deletarTodasVagasColetadas = async () => {
    setDeleteVagasColetadasError(null);
    if (!cidadeIdSelecionada) {
      setDeleteVagasColetadasError("Nenhuma cidade selecionada.");
      return;
    }
    const ok = window.confirm("Deseja apagar TODAS as vagas coletadas desta cidade?");
    if (!ok) return;

    setIsDeletingVagasColetadas(true);
    try {
      const { error } = await supabase
        .from("vagas_emprego_scraping")
        .delete()
        .eq("cidade_id", cidadeIdSelecionada);
      if (error) throw error;
      await refetchVagas();
    } catch (e: any) {
      setDeleteVagasColetadasError(e?.message || "Falha ao apagar vagas coletadas.");
    } finally {
      setIsDeletingVagasColetadas(false);
    }
  };

  const toggleAutoPublicacaoEmprego = async () => {
    if (!cidadeIdSelecionada) return;
    setIsSavingAutoPublicacao(true);
    setFonteError(null);
    try {
      const novoValor = !autoEmpregoAtivo;
      const payload = {
        cidade_id: cidadeIdSelecionada,
        emprego_auto_ativo: novoValor,
      } as any;

      const { error } = await supabase
        .from("cidade_scraping_config")
        .upsert(payload, { onConflict: "cidade_id" });
      if (error) throw error;
      await refetchAutoEmpregoConfig();
    } catch (e: any) {
      setFonteError(e?.message || "Falha ao atualizar publicacao automatica.");
    } finally {
      setIsSavingAutoPublicacao(false);
    }
  };

  const ativas = fontes.filter((f) => f.ativo).length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
          Scraping emprego
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Agente buscador de vagas de emprego nos sites cadastrados.
        </p>
      </div>

      {/* Painel do agente */}
      <div className="border border-amber-100 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-amber-50 border-b border-amber-100">
          <div className="flex items-center gap-2.5">
            <Briefcase className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-900">Agente Buscador de Vagas</span>
          </div>
        </div>

        <div className="p-5 bg-white space-y-4">
          {/* Cidade */}
          <div className="space-y-2">
            <Label>Cidade</Label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {cidadeSelecionada?.nome || "Nenhuma cidade selecionada"}
            </div>
            <p className="text-xs text-gray-500">
              Usa a cidade selecionada no menu lateral do admin.
            </p>
          </div>

          {/* Lista de fontes */}
          <div className="space-y-2">
            <Label>Sites cadastrados</Label>
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
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        fonte.ativo ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                      title={fonte.ativo ? "Ativa" : "Inativa"}
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
                    <span className="text-xs border rounded px-1.5 py-0.5 text-gray-600 shrink-0">
                      {fonte.tipo}
                    </span>
                    <button onClick={() => editar(fonte)} className="text-gray-400 hover:text-gray-700" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => excluir(fonte.id)} className="text-gray-400 hover:text-red-600" title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formulario adicionar/editar */}
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
                placeholder="https://site.com/vagas"
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
              <Button onClick={salvar} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingFonteId ? "Salvar edicao" : "Adicionar"}
              </Button>
              {editingFonteId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
            {fonteError && <p className="text-xs text-red-600">{fonteError}</p>}
            <p className="text-xs text-gray-500">
              Ativas: <span className="font-medium">{ativas}</span> de{" "}
              <span className="font-medium">{fontes.length}</span>
            </p>
          </div>

          {/* Parametros do agente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Maximo de vagas</Label>
              <Input
                type="number"
                min={1}
                value={maxVagas}
                onChange={(e) => setMaxVagas(e.target.value)}
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
                onClick={toggleAutoPublicacaoEmprego}
                disabled={!cidadeIdSelecionada || isSavingAutoPublicacao}
                variant={autoEmpregoAtivo ? "default" : "outline"}
                className="gap-2"
              >
                {isSavingAutoPublicacao ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {autoEmpregoAtivo ? "Publicacao automatica: SIM" : "Publicacao automatica: NAO"}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Quando ativo, roda automaticamente os agentes 1-2-3-4 todos os dias as 18:00.
            </p>
          </div>

          {/* Botao executar */}
          <Button
            onClick={executarAgente}
            disabled={isRunning || !cidadeIdSelecionada}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Executando agente...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Iniciar busca de vagas
              </>
            )}
          </Button>
          <Button
            onClick={executarAgenteTexto2}
            disabled={isRunningTexto2 || !cidadeIdSelecionada}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isRunningTexto2 ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Resumindo descricoes...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Rodar agente 2 (resumo IA)
              </>
            )}
          </Button>
          <Button
            onClick={executarAgentePreco3}
            disabled={isRunningPreco3 || !cidadeIdSelecionada}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isRunningPreco3 ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validando precos...
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" />
                Rodar agente 3 (validar preco IA)
              </>
            )}
          </Button>
          <Button
            onClick={executarAgentePublicador3}
            disabled={isRunningPublicador3 || !cidadeIdSelecionada}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isRunningPublicador3 ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Publicando vagas...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Publicar na tabela vagas (agente 4)
              </>
            )}
          </Button>
          <Button
            onClick={executarPipelineAgentes}
            disabled={isRunningPipeline || !cidadeIdSelecionada}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isRunningPipeline ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Rodando pipeline 1-2-3-4...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Rodar todos os agentes (1-2-3-4)
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
              <p className="font-medium">Agente executado com sucesso.</p>
            </div>
          )}
          {runTexto2Error && (
            <pre className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs whitespace-pre-wrap break-words text-red-700">
              {runTexto2Error}
            </pre>
          )}
          {runTexto2Result && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              <p className="font-medium">Agente 2 executado com sucesso.</p>
            </div>
          )}
          {runPreco3Error && (
            <pre className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs whitespace-pre-wrap break-words text-red-700">
              {runPreco3Error}
            </pre>
          )}
          {runPreco3Result && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <p className="font-medium">Agente 3 executado com sucesso.</p>
            </div>
          )}
          {runPublicador3Error && (
            <pre className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs whitespace-pre-wrap break-words text-red-700">
              {runPublicador3Error}
            </pre>
          )}
          {runPublicador3Result && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <p className="font-medium">Agente 4 executado com sucesso.</p>
            </div>
          )}
          {runPipelineError && (
            <pre className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs whitespace-pre-wrap break-words text-red-700">
              {runPipelineError}
            </pre>
          )}
          {runPipelineResult && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-700">
              <p className="font-medium">Pipeline 1-2-3-4 executado com sucesso.</p>
            </div>
          )}
        </div>
      </div>

      {/* Vagas coletadas */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-gray-500" />
            <p className="text-sm font-semibold text-gray-900">Vagas coletadas</p>
            {!loadingVagas && (
              <span className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">
                {vagas.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => refetchVagas()}>
              Atualizar lista
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={deletarTodasVagasColetadas}
              disabled={isDeletingVagasColetadas || vagas.length === 0}
              className="gap-1.5"
            >
              {isDeletingVagasColetadas ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Apagando...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Deletar todas
                </>
              )}
            </Button>
          </div>
        </div>
        {deleteVagasColetadasError && (
          <p className="text-xs text-red-600">{deleteVagasColetadasError}</p>
        )}

        {loadingVagas ? (
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando vagas...
          </div>
        ) : vagas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma vaga coletada ainda para esta cidade.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vagas.map((vaga) => (
              <div key={vaga.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">{vaga.titulo}</p>

                {vaga.empresa && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="truncate">{vaga.empresa}</span>
                  </div>
                )}

                {vaga.local_vaga && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="truncate">{vaga.local_vaga}</span>
                  </div>
                )}

                {vaga.salario && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Wallet className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="truncate">{vaga.salario}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {vaga.area && (
                    <span className="text-xs border rounded px-1.5 py-0.5 text-gray-600">
                      {vaga.area}
                    </span>
                  )}
                  {vaga.tipo_contrato && (
                    <span className="text-xs border rounded px-1.5 py-0.5 text-gray-600">
                      {vaga.tipo_contrato}
                    </span>
                  )}
                </div>

                {vaga.descricao && (
                  <p className="text-xs text-gray-500 whitespace-pre-wrap break-words">{vaga.descricao}</p>
                )}

                {vaga.contato && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1.5 mt-1">
                    <p className="text-xs font-medium text-amber-800 mb-0.5">Contato</p>
                    <p className="text-xs text-amber-700 break-all">{vaga.contato}</p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  {vaga.fonte_nome && (
                    <span className="text-xs text-gray-400 truncate">{vaga.fonte_nome}</span>
                  )}
                  {vaga.url_origem && (
                    <a
                      href={vaga.url_origem}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline shrink-0"
                    >
                      Ver vaga
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminScrapingEmprego;
