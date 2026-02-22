import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileText, Inbox, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIA_LABEL: Record<string, string> = {
  eletricista: "Eletricista",
  encanador: "Encanador",
  pintor: "Pintor",
  reparos: "Reparos",
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
  salao: "Salão",
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

type SolicitacaoRow = {
  id: string;
  categoria: string;
  descricao: string | null;
  status: string;
  created_at: string;
  cep: string | null;
  nome_solicitante_censurado: string | null;
  bairro: string | null;
  user_id: string | null;
};

interface SolicitarOrcamentoSectionProps {
  cidadeSlug?: string;
}

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const SolicitarOrcamentoSection = ({ cidadeSlug }: SolicitarOrcamentoSectionProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [modalSolicitacao, setModalSolicitacao] = useState<SolicitacaoRow | null>(null);

  const { data: cidade } = useQuery({
    queryKey: ["cidade-id", cidadeSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cidadeSlug,
  });

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ["orcamentos-home", cidade?.id],
    queryFn: async () => {
      if (!cidade?.id) return [];
      const { data, error } = await supabase
        .from("solicitacao_orcamento")
        .select("id, categoria, descricao, status, created_at, cep, nome_solicitante_censurado, bairro, user_id")
        .eq("cidade_id", cidade.id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
    enabled: !!cidade?.id,
  });

  const { data: unreadCounts } = useQuery({
    queryKey: ["orcamento-unread-counts", user?.id],
    queryFn: async () => {
      if (!user?.id) return { recebidos: 0, enviados: 0 };
      const { data, error } = await supabase.rpc("get_orcamento_unread_counts", {
        p_user_id: user.id,
      });
      if (error) throw error;
      if (data && typeof data === "object" && "recebidos" in data && "enviados" in data)
        return data as { recebidos: number; enviados: number };
      const row = Array.isArray(data) ? data[0] : data;
      const fromRow = (row as { get_orcamento_unread_counts?: { recebidos: number; enviados: number } } | null)
        ?.get_orcamento_unread_counts;
      return fromRow ?? { recebidos: 0, enviados: 0 };
    },
    enabled: !!user?.id,
  });
  const recebidosBadge = unreadCounts?.recebidos ?? 0;
  const enviadosBadge = unreadCounts?.enviados ?? 0;

  return (
    <div className="py-6">
      <div className="flex items-center justify-between px-5 mb-1">
        <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-primary" />
          Orçamentos solicitados
        </h2>
        <button
          onClick={() => navigate(`/cidade/${cidadeSlug}/orcamentos`)}
          className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
        >
          Ver todos
        </button>
      </div>
      <p className="text-[12px] text-muted-foreground/70 px-5 mb-3">
        Solicitações da cidade — empresas podem enviar propostas
      </p>

      {/* Carrossel horizontal */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-5 pb-2">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-56 h-28 rounded-xl bg-muted/50 animate-pulse" />
            ))
          ) : solicitacoes.length > 0 ? (
            <>
              {solicitacoes.map((s) => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setModalSolicitacao(s)}
                  onKeyDown={(e) => e.key === "Enter" && setModalSolicitacao(s)}
                  className="flex-shrink-0 w-56 p-3 rounded-xl border border-border bg-card text-left flex flex-col cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <p className="text-xs font-medium text-primary">
                    {CATEGORIA_LABEL[s.categoria] || s.categoria}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.descricao}</p>
                  <div className="text-[10px] text-muted-foreground/80 mt-2 space-y-0.5">
                    {s.bairro && <p>Bairro: {s.bairro}</p>}
                    {!s.bairro && s.cep && (
                      <p>Região: {String(s.cep).replace(/(\d{5})(\d{3})/, "$1-$2")}</p>
                    )}
                    <p>{format(new Date(s.created_at), "dd/MM/yyyy", { locale: ptBR })} · Solicitado por {s.nome_solicitante_censurado || "Anônimo"}</p>
                  </div>
                  {user?.id !== s.user_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 w-full text-xs h-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (user) navigate(`/cidade/${cidadeSlug}/orcamentos/${s.id}/enviar`);
                        else navigate(`/cidade/${cidadeSlug}/auth?redirect=${encodeURIComponent(`/cidade/${cidadeSlug}/orcamentos`)}`);
                      }}
                    >
                      <Send className="h-3 w-3 mr-1 opacity-70" />
                      Enviar orçamento
                    </Button>
                  )}
                </div>
              ))}
              {/* Card sutil: Solicitar orçamento */}
              <button
                onClick={() =>
                  user
                    ? navigate(`/cidade/${cidadeSlug}/solicitar-orcamento`)
                    : navigate(`/cidade/${cidadeSlug}/auth?redirect=${encodeURIComponent(`/cidade/${cidadeSlug}/solicitar-orcamento`)}`)
                }
                className="flex-shrink-0 w-40 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 hover:bg-muted/40 transition-colors py-4"
              >
                <Plus className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Solicitar orçamento</span>
              </button>
            </>
          ) : (
            /* Sem solicitações: só o botão sutil */
            <button
              onClick={() =>
                user
                  ? navigate(`/cidade/${cidadeSlug}/solicitar-orcamento`)
                  : navigate(`/cidade/${cidadeSlug}/auth?redirect=${encodeURIComponent(`/cidade/${cidadeSlug}/solicitar-orcamento`)}`)
              }
              className="flex-shrink-0 w-48 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 hover:bg-muted/40 transition-colors py-6"
            >
              <FileText className="h-8 w-8 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground text-center px-2">
                Nenhuma solicitação ainda
              </span>
              <span className="text-xs text-primary font-medium">Solicitar orçamento</span>
            </button>
          )}
        </div>
      </div>

      {/* Botão sutil abaixo do carrossel (sempre visível) */}
      <div className="px-5 mt-3">
        <button
          onClick={() =>
            user
              ? navigate(`/cidade/${cidadeSlug}/solicitar-orcamento`)
              : navigate(`/cidade/${cidadeSlug}/auth?redirect=${encodeURIComponent(`/cidade/${cidadeSlug}/solicitar-orcamento`)}`)
          }
          className="text-xs font-medium text-primary hover:underline"
        >
          + Solicitar orçamento
        </button>
      </div>

      {/* Orçamentos recebidos / enviados (só para logado) */}
      {user && cidadeSlug && (
        <div className="flex gap-3 px-5 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-9 border-border bg-card relative"
            onClick={() => navigate(`/cidade/${cidadeSlug}/orcamentos/recebidos`)}
          >
            <Inbox className="h-3.5 w-3 mr-1.5 shrink-0" />
            <span className="truncate">Orçamentos recebidos</span>
            {recebidosBadge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1">
                {recebidosBadge > 99 ? "99+" : recebidosBadge}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-9 border-border bg-card relative"
            onClick={() => navigate(`/cidade/${cidadeSlug}/orcamentos/enviados`)}
          >
            <Send className="h-3.5 w-3 mr-1.5 shrink-0" />
            <span className="truncate">Orçamentos enviados</span>
            {enviadosBadge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1">
                {enviadosBadge > 99 ? "99+" : enviadosBadge}
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Modal com dados completos do orçamento */}
      <Dialog open={!!modalSolicitacao} onOpenChange={(open) => !open && setModalSolicitacao(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {modalSolicitacao ? CATEGORIA_LABEL[modalSolicitacao.categoria] || modalSolicitacao.categoria : ""}
            </DialogTitle>
          </DialogHeader>
          {modalSolicitacao && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">Descrição</p>
                <p className="text-foreground whitespace-pre-wrap">{modalSolicitacao.descricao || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Status</p>
                  <p className="text-foreground">{STATUS_LABEL[modalSolicitacao.status] || modalSolicitacao.status}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Data</p>
                  <p className="text-foreground">{format(new Date(modalSolicitacao.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                {modalSolicitacao.bairro && (
                  <div>
                    <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Bairro</p>
                    <p className="text-foreground">{modalSolicitacao.bairro}</p>
                  </div>
                )}
                {modalSolicitacao.cep && (
                  <div>
                    <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-0.5">CEP</p>
                    <p className="text-foreground font-mono">{String(modalSolicitacao.cep).replace(/(\d{5})(\d{3})/, "$1-$2")}</p>
                  </div>
                )}
                <div className={modalSolicitacao.bairro || modalSolicitacao.cep ? "col-span-2" : ""}>
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-0.5">Solicitado por</p>
                  <p className="text-foreground">{modalSolicitacao.nome_solicitante_censurado || "Anônimo"}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-row gap-2 sm:gap-2">
            {modalSolicitacao && user?.id !== modalSolicitacao.user_id && (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  setModalSolicitacao(null);
                  if (user) navigate(`/cidade/${cidadeSlug}/orcamentos/${modalSolicitacao.id}/enviar`);
                  else navigate(`/cidade/${cidadeSlug}/auth?redirect=${encodeURIComponent(`/cidade/${cidadeSlug}/orcamentos`)}`);
                }}
              >
                <Send className="h-3.5 w-3 mr-1.5" />
                Enviar orçamento
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setModalSolicitacao(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SolicitarOrcamentoSection;
