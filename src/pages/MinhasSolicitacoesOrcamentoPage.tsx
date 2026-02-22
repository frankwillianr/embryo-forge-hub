import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, FileText, Loader2, Plus, MoreVertical, Pencil, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

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

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  em_atendimento: "Em atendimento",
  fechado: "Fechado",
};

const MinhasSolicitacoesOrcamentoPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [solicitacaoIdToDelete, setSolicitacaoIdToDelete] = useState<string | null>(null);

  const { data: cidade } = useQuery({
    queryKey: ["cidade", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ["minhas-solicitacoes-orcamento", user?.id, cidade?.id],
    queryFn: async () => {
      if (!user?.id || !cidade?.id) return [];
      const { data, error } = await supabase
        .from("solicitacao_orcamento")
        .select("id, categoria, descricao, status, created_at, cep, bairro, endereco_complemento")
        .eq("user_id", user.id)
        .eq("cidade_id", cidade.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!cidade?.id,
  });

  const marcarFechado = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("solicitacao_orcamento")
        .update({ status: "fechado" })
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["minhas-solicitacoes-orcamento"] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos-home"] });
      toast({ title: "Solicitação marcada como fechada." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar.", description: err.message, variant: "destructive" });
    },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("solicitacao_orcamento")
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSolicitacaoIdToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["minhas-solicitacoes-orcamento"] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos-home"] });
      toast({ title: "Solicitação excluída." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao excluir.", description: err.message, variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4 text-center">
          Você precisa estar logado para ver suas solicitações de orçamento.
        </p>
        <Button onClick={() => navigate(`/cidade/${slug}/auth?redirect=${encodeURIComponent(`/cidade/${slug}/minhas-solicitacoes-orcamento`)}`)}>
          Fazer login
        </Button>
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
          <h1 className="font-bold text-lg">Minhas solicitações</h1>
          <p className="text-xs text-muted-foreground">{cidade?.nome}</p>
        </div>
        <Button size="sm" onClick={() => navigate(`/cidade/${slug}/solicitar-orcamento`)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova
        </Button>
      </header>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : solicitacoes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">Você ainda não enviou nenhuma solicitação de orçamento.</p>
            <Button onClick={() => navigate(`/cidade/${slug}/solicitar-orcamento`)}>
              <Plus className="h-4 w-4 mr-2" />
              Solicitar orçamento
            </Button>
          </div>
        ) : (
          solicitacoes.map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-xl border border-border bg-card text-left"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-sm font-medium text-foreground">
                  {CATEGORIA_LABEL[s.categoria] || s.categoria}
                </span>
                <div className="flex items-center gap-1">
                  <Badge variant={s.status === "fechado" ? "secondary" : "default"} className="text-xs">
                    {STATUS_LABEL[s.status] || s.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {s.status !== "fechado" && (
                        <DropdownMenuItem
                          onClick={() => marcarFechado.mutate(s.id)}
                          disabled={marcarFechado.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Marcar como fechado
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => navigate(`/cidade/${slug}/editar-solicitacao-orcamento/${s.id}`)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setSolicitacaoIdToDelete(s.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{s.descricao}</p>
              <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                {s.bairro && <p>Bairro: {s.bairro}</p>}
                {!s.bairro && s.cep && (
                  <p>Região: {String(s.cep).replace(/(\d{5})(\d{3})/, "$1-$2")}</p>
                )}
                {s.endereco_complemento && (
                  <p>Endereço/ref.: {s.endereco_complemento}</p>
                )}
                <p>{format(new Date(s.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <AlertDialog open={!!solicitacaoIdToDelete} onOpenChange={(open) => !open && setSolicitacaoIdToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A solicitação será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => solicitacaoIdToDelete && excluir.mutate(solicitacaoIdToDelete)}
              disabled={excluir.isPending}
            >
              {excluir.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MinhasSolicitacoesOrcamentoPage;
