import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CATEGORIAS_SERVICO } from "@/lib/categoriasServico";

const ConversaOrcamentoPage = () => {
  const { slug, conversaId } = useParams<{ slug: string; conversaId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
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

  const chatIniciado = (mensagens?.length ?? 0) > 0;
  const solicitanteId = conversaComSolicitacao?.solicitacao?.user_id;
  const profissionalId = conversaComSolicitacao?.user_id;
  const cidadeIdSol = conversaComSolicitacao?.solicitacao?.cidade_id;
  const categoriaSol = conversaComSolicitacao?.solicitacao?.categoria;
  const idsParaNome = chatIniciado && solicitanteId && profissionalId ? [solicitanteId, profissionalId] : [];

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
  const nomeCliente = solicitanteId ? nomePorId[solicitanteId] : null;
  const nomeProfissional = profissionalId ? nomePorId[profissionalId] : null;

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

  return (
    <div className="min-h-screen bg-background flex flex-col pb-safe">
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card/95 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}/orcamentos`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base truncate">Conversa · Orçamento</h1>
          <p className="text-xs text-muted-foreground truncate">
            {CATEGORIAS_SERVICO[solicitacao.categoria] || solicitacao.categoria}
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-4 gap-4 max-w-xl mx-auto w-full">
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-4">
            <span className="text-xs font-medium text-primary uppercase tracking-wide">
              {CATEGORIAS_SERVICO[solicitacao.categoria] || solicitacao.categoria}
            </span>
            <p className="text-sm text-foreground mt-2 leading-relaxed">{solicitacao.descricao}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-3 text-xs text-muted-foreground">
              {solicitacao.bairro && <span>Bairro: {solicitacao.bairro}</span>}
              {!solicitacao.bairro && solicitacao.cep && (
                <span>Região: {String(solicitacao.cep).replace(/(\d{5})(\d{3})/, "$1-$2")}</span>
              )}
              <span>·</span>
              <span>
                Cliente: {chatIniciado && nomeCliente ? nomeCliente : (solicitacao.nome_solicitante_censurado || "Anônimo")}
              </span>
              {chatIniciado && (
                <>
                  <span>·</span>
                  <span>Empresa respondendo: {nomeEmpresa || "—"}</span>
                </>
              )}
              <span>·</span>
              <span>{format(new Date(solicitacao.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border bg-muted/30 overflow-hidden">
          {loadingMensagens ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : mensagens.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
              <p className="text-xs text-muted-foreground/80 mt-1">Envie uma mensagem para iniciar o diálogo.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mensagens.map((m) => {
                const isEu = m.user_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${isEu ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        isEu
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-card border border-border rounded-bl-md text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`text-[10px] mt-1 ${isEu ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {format(new Date(m.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}

          <div className="p-3 border-t border-border bg-card">
            <div className="flex gap-2 items-end">
              <Textarea
                placeholder="Digite sua mensagem..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleEnviar();
                  }
                }}
                className="min-h-[44px] max-h-32 resize-none text-sm py-3 rounded-xl"
                rows={2}
                disabled={enviarMensagem.isPending}
              />
              <Button
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
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
    </div>
  );
};

export default ConversaOrcamentoPage;
