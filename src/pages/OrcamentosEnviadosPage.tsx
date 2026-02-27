import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CATEGORIAS_SERVICO } from "@/lib/categoriasServico";

type SolicitacaoRow = {
  categoria: string;
  descricao: string;
  created_at: string;
} | null;
type ConversaComSolicitacao = {
  id: string;
  solicitacao_id: string;
  user_id: string;
  updated_at: string;
  solicitacao_orcamento: SolicitacaoRow;
};

const OrcamentosEnviadosPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const { data: conversas = [], isLoading } = useQuery({
    queryKey: ["conversas-enviados", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("solicitacao_orcamento_conversa")
        .select("id, solicitacao_id, user_id, updated_at, solicitacao_orcamento(categoria, descricao, created_at)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ConversaComSolicitacao[];
    },
    enabled: !!user?.id,
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Orçamentos enviados</h1>
          <p className="text-xs text-muted-foreground">Suas propostas e conversas</p>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : conversas.length === 0 ? (
          <div className="text-center py-12">
            <Send className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Você ainda não enviou orçamentos.</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em &quot;Enviar orçamento&quot; nos pedidos da cidade para começar.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate(`/cidade/${slug}/orcamentos`)}>
              Ver orçamentos
            </Button>
          </div>
        ) : (
          conversas.map((c) => {
            const sol = c.solicitacao_orcamento;
            return (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/cidade/${slug}/orcamentos/conversa/${c.id}`)}
              className="w-full p-4 rounded-xl border border-border bg-card text-left hover:bg-muted/30 transition-colors"
            >
              <p className="text-sm font-medium text-primary">
                {CATEGORIAS_SERVICO[sol?.categoria || ""] || sol?.categoria}
              </p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sol?.descricao}</p>
              <p className="text-[10px] text-muted-foreground mt-2">
                Última atividade: {format(new Date(c.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            </button>
          ); })
        )}
      </div>
    </div>
  );
};

export default OrcamentosEnviadosPage;
