import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2, Send, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CATEGORIAS_SERVICO } from "@/lib/categoriasServico";

function formatarCep(cep: string | number | null | undefined): string | null {
  if (cep == null) return null;
  const s = String(cep).trim();
  if (s.length < 8) return s || null;
  return s.slice(0, 5) + "-" + s.slice(5, 8);
}

const ConversaOrcamentoPage = () => {
  const { slug, conversaId } = useParams<{ slug: string; conversaId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile: profileLogado, loading: authLoading } = useAuth();
  const [texto, setTexto] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(
        `/cidade/${slug}/auth?redirect=${encodeURIComponent(`/cidade/${slug}/orcamentos/conversa/${conversaId}`)}`,
        { replace: true }
      );
    }
  }, [user, authLoading, navigate, slug, conversaId]);

  const { data: conversaComSolicitacao, isLoading: loadingConversa } = useQuery({
    queryKey: ["conversa-orcamento", conversaId],
    queryFn: async () => {
      const { data: conv, error: errConv } = await supabase
        .from("solicitacao_orcamento_conversa")
        .select("id, solicitacao_id, user_id")
        .eq("id", conversaId)
        .single();
      if (errConv || !conv) throw errConv || new Error("Conversa não encontrada");
      const { data: sol, error: errSol } = await supabase
        .from("solicitacao_orcamento")
        .select("id, categoria, descricao, created_at, bairro, cep, nome_solicitante_censurado, user_id, cidade_id")
        .eq("id", conv.solicitacao_id)
        .single();
      if (errSol || !sol) throw errSol || new Error("Solicitação não encontrada");
      return { ...conv, solicitacao: sol };
    },
    enabled: !!conversaId && !!user,
  });

  const souSolicitante = conversaComSolicitacao?.solicitacao?.user_id === user?.id;
  const souProfissional = conversaComSolicitacao?.user_id === user?.id;
  const podeParticipar = souSolicitante || souProfissional;

  const { data: mensagens = [], isLoading: loadingMensagens } = useQuery({
    queryKey: ["orcamento-mensagens", conversaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacao_orcamento_mensagem")
        .select("id, user_id, body, created_at")
        .eq("conversa_id", conversaId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!conversaId && !!conversaComSolicitacao,
  });

  // Realtime: novas mensagens e atualização de leitura
  useEffect(() => {
    if (!conversaId) return;
    const channel = supabase
      .channel(`orcamento-chat:${conversaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "solicitacao_orcamento_mensagem",
          filter: `conversa_id=eq.${conversaId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orcamento-mensagens", conversaId] });
          queryClient.invalidateQueries({ queryKey: ["conversas-recebidos"] });
          queryClient.invalidateQueries({ queryKey: ["conversas-enviados"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "solicitacao_orcamento_conversa_leitura",
          filter: `conversa_id=eq.${conversaId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orcamento-conversa-leitura", conversaId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversaId, queryClient]);

  const chatIniciado = (mensagens?.length ?? 0) > 0;
  const solicitanteId = conversaComSolicitacao?.solicitacao?.user_id;
  const profissionalId = conversaComSolicitacao?.user_id;
  const cidadeIdSol = conversaComSolicitacao?.solicitacao?.cidade_id;
  const categoriaSol = conversaComSolicitacao?.solicitacao?.categoria;
  const idsParaNome = solicitanteId && profissionalId ? [solicitanteId, profissionalId] : [];

  const { data: perfisEnvolvidos = [] } = useQuery({
    queryKey: ["profiles-orcamento-chat", idsParaNome],
    queryFn: async () => {
      if (idsParaNome.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", idsParaNome);
      if (error) throw error;
      return data || [];
    },
    enabled: idsParaNome.length > 0,
  });

  const nomePorId = (perfisEnvolvidos as { id: string; nome: string }[]).reduce(
    (acc, p) => ({ ...acc, [p.id]: p.nome?.trim() || "Usuário" }),
    {} as Record<string, string>
  );
  const nomeCliente = solicitanteId
    ? (solicitanteId === user?.id ? profileLogado?.nome?.trim() || null : nomePorId[solicitanteId] ?? null)
    : null;
  const nomeProfissional = profissionalId
    ? (profissionalId === user?.id ? profileLogado?.nome?.trim() || null : nomePorId[profissionalId] ?? null)
    : null;

  const { data: empresaRespondendo } = useQuery({
    queryKey: ["empresa-orcamento-chat", profissionalId, cidadeIdSol, categoriaSol],
    queryFn: async () => {
      if (!profissionalId || !cidadeIdSol || !categoriaSol) return null;
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome")
        .eq("user_id", profissionalId)
        .eq("cidade_id", cidadeIdSol)
        .eq("status", "ativo")
        .or(`categoria.eq.${categoriaSol},categorias_adicionais.cs.{"${categoriaSol}"}`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: chatIniciado && !!profissionalId && !!cidadeIdSol && !!categoriaSol,
  });
  const nomeEmpresa = (empresaRespondendo as { nome?: string } | null)?.nome?.trim() || nomeProfissional || null;

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => {
    scrollToBottom();
  }, [mensagens.length]);

  const outroParticipanteId = souSolicitante ? profissionalId : solicitanteId;

  const { data: leituraOutro } = useQuery({
    queryKey: ["orcamento-conversa-leitura", conversaId, outroParticipanteId],
    queryFn: async () => {
      if (!conversaId || !outroParticipanteId) return null;
      const { data, error } = await supabase
        .from("solicitacao_orcamento_conversa_leitura")
        .select("read_at")
        .eq("conversa_id", conversaId)
        .eq("user_id", outroParticipanteId)
        .maybeSingle();
      if (error) throw error;
      return data?.read_at ? new Date(data.read_at).getTime() : null;
    },
    enabled: !!conversaId && !!outroParticipanteId && !!conversaComSolicitacao,
  });

  const marcarComoLido = useMutation({
    mutationFn: async () => {
      if (!conversaId || !user?.id) return;
      await supabase
        .from("solicitacao_orcamento_conversa_leitura")
        .upsert({ conversa_id: conversaId, user_id: user.id, read_at: new Date().toISOString() }, { onConflict: "conversa_id,user_id" });
    },
  });

  useEffect(() => {
    if (!conversaId || !user?.id || !conversaComSolicitacao) return;
    marcarComoLido.mutate();
  }, [conversaId, user?.id, !!conversaComSolicitacao]);

  const enviarMensagem = useMutation({
    mutationFn: async (body: string) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("solicitacao_orcamento_mensagem")
        .insert({ conversa_id: conversaId!, user_id: user.id, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setTexto("");
      queryClient.invalidateQueries({ queryKey: ["orcamento-mensagens", conversaId] });
      queryClient.invalidateQueries({ queryKey: ["conversas-recebidos"] });
      queryClient.invalidateQueries({ queryKey: ["conversas-enviados"] });
    },
  });

  const handleEnviar = () => {
    const t = texto.trim();
    if (!t || enviarMensagem.isPending || !podeParticipar) return;
    enviarMensagem.mutate(t);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadingConversa || !conversaComSolicitacao) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!podeParticipar) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground text-center">Você não faz parte desta conversa.</p>
      </div>
    );
  }

  const solicitacao = conversaComSolicitacao.solicitacao;
  const categoriaLabel = CATEGORIAS_SERVICO[solicitacao.categoria] || solicitacao.categoria;
  const cepFormatado = formatarCep(solicitacao.cep);

  return (
    <div className="min-h-screen bg-background flex flex-col pb-safe">
      <header className="sticky top-0 z-10 flex items-center gap-2 p-3 pt-safe border-b border-border bg-background shrink-0">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(`/cidade/${slug}/orcamentos`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-sm truncate">{categoriaLabel}</h1>
          <p className="text-[11px] text-muted-foreground truncate">
            {nomeCliente || solicitacao.nome_solicitante_censurado || "Cliente"}
            {chatIniciado && nomeEmpresa ? ` · ${nomeEmpresa}` : ""}
          </p>
        </div>
      </header>

      {/* Card de informações fixo (sem rolagem) */}
      <div className="shrink-0 border-b border-border bg-card max-h-[220px] overflow-y-auto">
        <div className="p-4 flex flex-col gap-3">
          <div>
            <p className="text-[10px] font-medium text-primary uppercase tracking-wide">Descrição</p>
            <p className="text-sm text-foreground mt-0.5">{solicitacao.descricao}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Categoria</p>
              <p className="text-foreground font-medium">{categoriaLabel}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Data da solicitação</p>
              <p className="text-foreground">{format(new Date(solicitacao.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
            {solicitacao.bairro && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bairro</p>
                <p className="text-foreground">{solicitacao.bairro}</p>
              </div>
            )}
            {cepFormatado && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">CEP</p>
                <p className="text-foreground font-mono">{cepFormatado}</p>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cliente</p>
              <p className="text-foreground">{nomeCliente || solicitacao.nome_solicitante_censurado || "Anônimo"}</p>
            </div>
            {chatIniciado && nomeEmpresa && (
              <div className="col-span-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Empresa respondendo</p>
                <p className="text-foreground">{nomeEmpresa}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Área de mensagens (única que rola) */}
      <div className="flex-1 flex flex-col min-h-0">
        {loadingMensagens ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">Envie uma mensagem para iniciar.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {mensagens.map((m) => {
              const isEu = m.user_id === user?.id;
              const nomeRemetente = isEu
                ? (profileLogado?.nome?.trim() || "Você")
                : m.user_id === solicitanteId
                  ? (nomeCliente || "Cliente")
                  : (nomeEmpresa || nomeProfissional || "Empresa");
              const visualizado = isEu && leituraOutro != null && new Date(m.created_at).getTime() <= leituraOutro;
              return (
                <div key={m.id} className={`flex ${isEu ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      isEu
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    <p className="text-[10px] font-medium opacity-90 mb-0.5">{nomeRemetente}</p>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <span className={`text-[10px] ${isEu ? "opacity-80" : "text-muted-foreground"}`}>
                        {format(new Date(m.created_at), "HH:mm", { locale: ptBR })}
                      </span>
                      {isEu && (
                        <span className={visualizado ? "opacity-100" : "opacity-50"}>
                          <CheckCheck className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="shrink-0 p-2.5 border-t border-border bg-background">
          <div className="flex gap-2 items-end">
            <Textarea
              placeholder="Mensagem..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleEnviar();
                }
              }}
              className="min-h-[40px] max-h-28 resize-none text-sm py-2.5 rounded-xl"
              rows={2}
              disabled={enviarMensagem.isPending}
            ></Textarea>
            <Button
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={handleEnviar}
              disabled={!texto.trim() || enviarMensagem.isPending}
            >
              {enviarMensagem.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversaOrcamentoPage;
