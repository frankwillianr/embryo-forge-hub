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
import { Building2 } from "lucide-react";

const CATEGORIA_LABEL: Record<string, string> = {
  eletricista: "Eletricista",
  encanador: "Encanador",
  pintor: "Pintor",
  reparos: "Reparos em geral",
  obras: "Obras / Reformas",
  limpeza: "Limpeza",
  diarista: "Diarista",
  dedetizacao: "Dedetização",
  chaveiro: "Chaveiro",
  marceneiro: "Marceneiro",
  serralheria: "Serralheria",
  vidraceiro: "Vidraceiro",
  "ar-condicionado": "Ar condicionado",
  jardinagem: "Jardinagem",
  mudancas: "Mudanças",
  salao: "Salão de beleza",
  barbeiro: "Barbeiro",
  manicure: "Manicure",
  dentista: "Dentista",
  veterinario: "Veterinário",
  mecanico: "Mecânico",
  "lava-jato": "Lava jato",
  advogado: "Advogado",
  contador: "Contador",
  fotografo: "Fotógrafo",
  eventos: "Eventos / Festas",
  outros: "Outros",
};

const EnviarOrcamentoPage = () => {
  const { slug, solicitacaoId } = useParams<{ slug: string; solicitacaoId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [texto, setTexto] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(
        `/cidade/${slug}/auth?redirect=${encodeURIComponent(`/cidade/${slug}/orcamentos/${solicitacaoId}/enviar`)}`,
        { replace: true }
      );
    }
  }, [user, authLoading, navigate, slug, solicitacaoId]);

  const { data: solicitacao, isLoading: loadingSolicitacao } = useQuery({
    queryKey: ["solicitacao-orcamento", solicitacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacao_orcamento")
        .select("id, categoria, descricao, created_at, bairro, cep, nome_solicitante_censurado, cidade_id, user_id")
        .eq("id", solicitacaoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!solicitacaoId && !!user,
  });

  // Verifica se o usuário tem empresa ativa nessa categoria (na mesma cidade) para poder enviar orçamento
  const categoriaSolicitacao = solicitacao?.categoria;
  const cidadeIdSolicitacao = solicitacao?.cidade_id;
  const { data: empresasNaCategoria = [] } = useQuery({
    queryKey: ["minha-empresa-ativa-categoria", user?.id, cidadeIdSolicitacao, categoriaSolicitacao],
    queryFn: async () => {
      if (!user?.id || !cidadeIdSolicitacao || !categoriaSolicitacao) return [];
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id")
        .eq("cidade_id", cidadeIdSolicitacao)
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .or(`categoria.eq.${categoriaSolicitacao},categorias_adicionais.cs.{"${categoriaSolicitacao}"}`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!cidadeIdSolicitacao && !!categoriaSolicitacao,
  });
  const podeEnviarOrcamento = (empresasNaCategoria?.length ?? 0) > 0;

  const { data: conversa } = useQuery({
    queryKey: ["orcamento-conversa", solicitacaoId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacao_orcamento_conversa")
        .select("id")
        .eq("solicitacao_id", solicitacaoId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!solicitacaoId && !!user?.id,
  });

  const { data: mensagens = [], isLoading: loadingMensagens } = useQuery({
    queryKey: ["orcamento-mensagens", conversa?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacao_orcamento_mensagem")
        .select("id, user_id, body, created_at")
        .eq("conversa_id", conversa!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!conversa?.id,
  });

  const chatIniciado = (mensagens?.length ?? 0) > 0;
  const solicitanteId = solicitacao?.user_id;
  const { data: perfilSolicitante } = useQuery({
    queryKey: ["profile-solicitante-orcamento", solicitanteId],
    queryFn: async () => {
      if (!solicitanteId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("id", solicitanteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: chatIniciado && !!solicitanteId,
  });
  const nomeCliente = (perfilSolicitante as { nome?: string } | null)?.nome?.trim() || null;

  const { data: minhaEmpresaNome } = useQuery({
    queryKey: ["minha-empresa-nome-orcamento", user?.id, cidadeIdSolicitacao, categoriaSolicitacao],
    queryFn: async () => {
      if (!user?.id || !cidadeIdSolicitacao || !categoriaSolicitacao) return null;
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome")
        .eq("cidade_id", cidadeIdSolicitacao)
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .or(`categoria.eq.${categoriaSolicitacao},categorias_adicionais.cs.{"${categoriaSolicitacao}"}`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: chatIniciado && !!user?.id && !!cidadeIdSolicitacao && !!categoriaSolicitacao,
  });
  const nomeEmpresaRespondendo = (minhaEmpresaNome as { nome?: string } | null)?.nome?.trim() || null;

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => {
    scrollToBottom();
  }, [mensagens.length]);

  const enviarMensagem = useMutation({
    mutationFn: async (body: string) => {
      if (!user?.id) throw new Error("Não autenticado");
      let convId = conversa?.id;
      if (!convId) {
        const { data: nova, error: errConv } = await supabase
          .from("solicitacao_orcamento_conversa")
          .insert({ solicitacao_id: solicitacaoId!, user_id: user.id })
          .select("id")
          .single();
        if (errConv) throw errConv;
        convId = nova.id;
      }
      const { error } = await supabase
        .from("solicitacao_orcamento_mensagem")
        .insert({ conversa_id: convId, user_id: user.id, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setTexto("");
      queryClient.invalidateQueries({ queryKey: ["orcamento-conversa", solicitacaoId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["orcamento-mensagens"] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos-cidade"] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos-home"] });
    },
  });

  const handleEnviar = () => {
    const t = texto.trim();
    if (!t || enviarMensagem.isPending || !podeEnviarOrcamento) return;
    enviarMensagem.mutate(t);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadingSolicitacao || !solicitacao) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-safe">
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card/95 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}/orcamentos`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base truncate">Enviar orçamento</h1>
          <p className="text-xs text-muted-foreground truncate">{CATEGORIA_LABEL[solicitacao.categoria] || solicitacao.categoria}</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-4 gap-4 max-w-xl mx-auto w-full">
        {/* Card da solicitação */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-4">
            <span className="text-xs font-medium text-primary uppercase tracking-wide">
              {CATEGORIA_LABEL[solicitacao.categoria] || solicitacao.categoria}
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
                  <span>Empresa respondendo: {nomeEmpresaRespondendo || "—"}</span>
                </>
              )}
              <span>·</span>
              <span>{format(new Date(solicitacao.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border bg-muted/30 overflow-hidden">
          {loadingMensagens ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : mensagens.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-sm text-muted-foreground">Envie sua proposta ou perguntas aqui.</p>
              <p className="text-xs text-muted-foreground/80 mt-1">O solicitante poderá responder e continuar o diálogo.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mensagens.map((m) => {
                const isEu = m.user_id === user?.id;
                return (
                  <div
                    key={m.id}
                    className={`flex ${isEu ? "justify-end" : "justify-start"}`}
                  >
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

          {/* Campo de texto + enviar OU CTA para cadastrar empresa */}
          <div className="p-3 border-t border-border bg-card">
            {!podeEnviarOrcamento ? (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-center">
                <Building2 className="h-10 w-10 mx-auto text-amber-600 mb-2" />
                <p className="text-sm font-medium text-foreground mb-1">
                  Cadastre sua empresa para enviar orçamentos
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Você ainda não tem uma empresa ativa em{" "}
                  <strong>{CATEGORIAS_SERVICO[solicitacao.categoria] || solicitacao.categoria}</strong>.
                  Entre no guia de serviços e comece a atender pedidos como este.
                </p>
                <Button
                  size="sm"
                  className="w-full bg-[#331D4A] hover:bg-[#331D4A]/90"
                  onClick={() => navigate(`/cidade/${slug}/servicos/${solicitacao.categoria}/novo`)}
                >
                  Cadastrar minha empresa
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 items-end">
                <Textarea
                  placeholder="Digite seu orçamento ou mensagem..."
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnviarOrcamentoPage;
