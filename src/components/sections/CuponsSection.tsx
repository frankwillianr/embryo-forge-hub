import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tag, Lock, Copy, Check, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function getTodayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diaAnterior(dataStr: string): string {
  const [y, m, d] = dataStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function diasConsecutivos(datas: string[]): number {
  if (datas.length === 0) return 0;
  const sorted = [...datas].sort((a, b) => b.localeCompare(a));
  const today = getTodayLocal();
  if (sorted[0] !== today) return 0;
  let count = 1;
  let prev = today;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === diaAnterior(prev)) {
      count++;
      prev = sorted[i];
    } else break;
  }
  return count;
}

type CupomCidadeRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  codigo?: string;
  codigo_censurado: string;
  checkins_necessarios: number;
};

type CupomEmpresaRow = {
  id: string;
  nome: string;
  categoria: string;
  cupom_nome: string;
  cupom_valor: number | null;
  cupom_tipo: string | null;
};

type CupomItem =
  | { tipo: "cidade"; data: CupomCidadeRow }
  | { tipo: "empresa"; data: CupomEmpresaRow };

interface CuponsSectionProps {
  cidadeSlug?: string;
}

const CuponsSection = ({ cidadeSlug }: CuponsSectionProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: cidade } = useQuery({
    queryKey: ["cidade-id-cupons", cidadeSlug],
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

  const { data: checkins = [] } = useQuery({
    queryKey: ["checkins", user?.id, cidade?.id],
    queryFn: async () => {
      if (!user?.id || !cidade?.id) return [];
      const { data, error } = await supabase
        .from("checkin")
        .select("data")
        .eq("user_id", user.id)
        .eq("cidade_id", cidade.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data || []).map((r) => r.data as string);
    },
    enabled: !!user?.id && !!cidade?.id,
  });

  const { data: cuponsCidade = [], isLoading: loadingCupons } = useQuery({
    queryKey: ["cupons", cidade?.id, !!user],
    queryFn: async () => {
      if (!cidade?.id) return [];
      if (user) {
        const { data, error } = await supabase
          .from("cupom")
          .select("id, titulo, descricao, codigo, codigo_censurado, checkins_necessarios")
          .eq("cidade_id", cidade.id)
          .eq("ativo", true)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as CupomCidadeRow[];
      }
      const { data, error } = await supabase
        .from("cupom_public")
        .select("id, titulo, descricao, codigo_censurado, checkins_necessarios")
        .eq("cidade_id", cidade.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((r) => ({ ...r, codigo: "" })) as CupomCidadeRow[];
    },
    enabled: !!cidade?.id,
  });

  const { data: cuponsEmpresa = [], isLoading: loadingEmpresas } = useQuery({
    queryKey: ["cupons-empresa", cidade?.id],
    queryFn: async () => {
      if (!cidade?.id) return [];
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome, categoria, cupom_nome, cupom_valor, cupom_tipo")
        .eq("cidade_id", cidade.id)
        .eq("status", "ativo")
        .not("cupom_nome", "is", null);
      if (error) throw error;
      return (data || []) as CupomEmpresaRow[];
    },
    enabled: !!cidade?.id,
  });

  const itensCupom: CupomItem[] = useMemo(() => {
    const empresaItens: CupomItem[] = cuponsEmpresa.map((e) => ({ tipo: "empresa" as const, data: e }));
    const cidadeItens: CupomItem[] = cuponsCidade.map((c) => ({ tipo: "cidade" as const, data: c }));
    return [...empresaItens, ...cidadeItens];
  }, [cuponsEmpresa, cuponsCidade]);

  const isLoading = loadingCupons || loadingEmpresas;
  const consecutivos = diasConsecutivos(checkins);
  const cuponsBloqueados = !user || consecutivos < 7;

  const handleCopy = (e: React.MouseEvent, id: string, codigo: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(codigo);
    setCopiedId(id);
    toast({ title: "Cupom copiado!" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDesconto = (valor: number | null, tipo: string | null) => {
    if (valor == null) return "";
    if (tipo === "porcentagem") return `${valor}% off`;
    return `R$ ${valor.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} off`;
  };

  return (
    <div className="py-6">
      <div className="flex items-center justify-between px-5 mb-1">
        <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Tag className="h-4 w-4 text-emerald-600" />
          </div>
          Cupons de desconto
        </h2>
        <button
          onClick={() => navigate(`/cidade/${cidadeSlug}/cupons`)}
          className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
        >
          Ver todos
        </button>
      </div>
      <p className="text-[12px] text-muted-foreground/70 px-5 mb-3">
        Check-ins consecutivos para desbloquear
      </p>

      <div className="overflow-x-auto scrollbar-hide relative">
        {cuponsBloqueados && (
          <div
            className="absolute inset-0 z-10 cursor-not-allowed"
            aria-hidden
          />
        )}
        <div
          className={`flex gap-3 px-5 pb-2 transition-[filter] ${cuponsBloqueados ? "blur-[2px] pointer-events-none select-none" : ""}`}
        >
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-56 h-28 rounded-xl bg-muted/50 animate-pulse" />
            ))
          ) : itensCupom.length === 0 ? (
            <div className="flex-shrink-0 w-56 cupom-ticket">
              <div className="cupom-ticket-main flex flex-col items-center justify-center text-center">
                <Tag className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum cupom nesta cidade</p>
                <p className="text-[10px] text-muted-foreground/80 mt-1">Toque em Ver todos para conferir</p>
              </div>
              <div className="cupom-ticket-stub">
                <span className="cupom-ticket-stub-text">CUPOM</span>
              </div>
            </div>
          ) : (
            itensCupom.map((item) => {
              if (item.tipo === "empresa") {
                const e = item.data;
                const descontoTexto = formatDesconto(e.cupom_valor, e.cupom_tipo);
                return (
                  <button
                    key={`emp-${e.id}`}
                    type="button"
                    onClick={() => navigate(`/cidade/${cidadeSlug}/servicos/${e.categoria}/${e.id}`)}
                    className="flex-shrink-0 w-56 cupom-ticket text-left hover:opacity-90 transition-opacity"
                  >
                    <div className="cupom-ticket-main">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium text-sm text-foreground truncate">{e.nome}</span>
                      </div>
                      <p className="text-xs text-primary font-medium mt-1.5">{e.cupom_nome}</p>
                      {descontoTexto && (
                        <p className="text-xs text-muted-foreground mt-0.5">{descontoTexto}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/80 mt-2">Toque para ver a empresa</p>
                    </div>
                    <div className="cupom-ticket-stub">
                      <span className="cupom-ticket-stub-text">{e.cupom_nome}</span>
                    </div>
                  </button>
                );
              }
              const c = item.data;
              const desbloqueado = !!user && consecutivos >= (c.checkins_necessarios ?? 7);
              const codigoExibir = desbloqueado && c.codigo ? c.codigo : (c.codigo_censurado || "••••••••");
              return (
                <div
                  key={`cid-${c.id}`}
                  className="flex-shrink-0 w-56 cupom-ticket"
                >
                  <div className="cupom-ticket-main">
                    <h3 className="font-medium text-sm text-foreground truncate">{c.titulo}</h3>
                    {c.descricao && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.descricao}</p>
                    )}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {codigoExibir}
                      </code>
                      {desbloqueado && c.codigo ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(ev) => handleCopy(ev, c.id, c.codigo!)}
                        >
                          {copiedId === c.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          {user
                            ? `${(c.checkins_necessarios ?? 7) - consecutivos} check-ins`
                            : "7 check-ins"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="cupom-ticket-stub">
                    <span className="cupom-ticket-stub-text">{codigoExibir}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CuponsSection;
