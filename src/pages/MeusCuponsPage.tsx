import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Tag, Copy, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function formatCPF(val: string | null | undefined): string {
  if (!val) return "";
  const d = String(val).replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function getTodayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type RowCidade = {
  tipo: "cidade";
  id: string;
  validade: string;
  cupom: { titulo: string; descricao: string | null; codigo: string } | null;
};

type RowEmpresa = {
  tipo: "empresa";
  id: string;
  empresa_id: string;
  validade: string;
  empresa: { nome: string; cupom_nome: string; cupom_valor: number | null; cupom_tipo: string | null; categoria: string } | null;
};

type Row = RowCidade | RowEmpresa;

function formatDesconto(valor: number | null, tipo: string | null): string {
  if (valor == null) return "";
  if (tipo === "porcentagem") return `${valor}% off`;
  return `R$ ${valor.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} off`;
}

const MeusCuponsPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();

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

  const { data: cupons = [], isLoading } = useQuery({
    queryKey: ["meus-cupons", user?.id, cidade?.id],
    queryFn: async (): Promise<Row[]> => {
      if (!user?.id || !cidade?.id) return [];
      const hoje = getTodayLocal();
      const rows: Row[] = [];

      const { data: listCidade, error: errCidade } = await supabase
        .from("usuario_cupom")
        .select("id, cupom_id, validade")
        .eq("user_id", user.id)
        .eq("cidade_id", cidade.id)
        .gte("validade", hoje)
        .order("validade", { ascending: true });
      if (errCidade) throw errCidade;
      if (listCidade?.length) {
        const ids = listCidade.map((r) => r.cupom_id);
        const { data: cuponsData, error: errCupom } = await supabase
          .from("cupom")
          .select("id, titulo, descricao, codigo")
          .in("id", ids);
        if (errCupom) throw errCupom;
        const byId = (cuponsData || []).reduce(
          (acc, c) => ({ ...acc, [c.id]: c }),
          {} as Record<string, { titulo: string; descricao: string | null; codigo: string }>
        );
        listCidade.forEach((r) => {
          rows.push({
            tipo: "cidade",
            id: r.id,
            validade: r.validade,
            cupom: byId[r.cupom_id] || null,
          });
        });
      }

      const { data: listEmpresa, error: errEmpresa } = await supabase
        .from("usuario_cupom_empresa")
        .select("id, empresa_id, validade")
        .eq("user_id", user.id)
        .eq("cidade_id", cidade.id)
        .gte("validade", hoje)
        .order("validade", { ascending: true });
      if (errEmpresa) throw errEmpresa;
      if (listEmpresa?.length) {
        const ids = listEmpresa.map((r) => r.empresa_id);
        const { data: empresasData, error: errEmp } = await supabase
          .from("rel_cidade_servico_empresa")
          .select("id, nome, cupom_nome, cupom_valor, cupom_tipo, categoria")
          .in("id", ids);
        if (errEmp) throw errEmp;
        const empById = (empresasData || []).reduce(
          (acc, e) => ({ ...acc, [e.id]: e }),
          {} as Record<string, { nome: string; cupom_nome: string; cupom_valor: number | null; cupom_tipo: string | null; categoria: string }>
        );
        listEmpresa.forEach((r) => {
          rows.push({
            tipo: "empresa",
            id: r.id,
            empresa_id: r.empresa_id,
            validade: r.validade,
            empresa: empById[r.empresa_id] || null,
          });
        });
      }

      rows.sort((a, b) => a.validade.localeCompare(b.validade));
      return rows;
    },
    enabled: !!user?.id && !!cidade?.id,
  });

  const handleCopy = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    toast({ title: "Código copiado!" });
  };

  if (!user) {
    navigate(`/cidade/${slug}/auth?redirect=${encodeURIComponent(`/cidade/${slug}/meus-cupons`)}`, { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate">Meus cupons</h1>
          <p className="text-xs text-muted-foreground">{cidade?.nome}</p>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : cupons.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Você ainda não pegou nenhum cupom.</p>
            <p className="text-xs text-muted-foreground mt-1">Na home, desbloqueie cupons com check-ins e toque em &quot;Pegar cupom&quot;.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate(`/cidade/${slug}`)}
            >
              Ver cupons
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {cupons.map((uc) => (
              <div key={uc.id} className="relative w-full cupom-ticket">
                <div className="cupom-ticket-main">
                  {uc.tipo === "cidade" ? (
                    <>
                      <h3 className="font-medium text-sm text-foreground">
                        {uc.cupom?.titulo || "Cupom"}
                      </h3>
                      {uc.cupom?.descricao && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {uc.cupom.descricao}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Válido até {new Date(uc.validade + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          {uc.cupom?.codigo || "—"}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => uc.cupom?.codigo && handleCopy(uc.cupom.codigo)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium text-sm text-foreground">{uc.empresa?.nome || "Empresa"}</span>
                      </div>
                      <p className="text-xs text-primary font-medium mt-1.5">{uc.empresa?.cupom_nome || "—"}</p>
                      {uc.empresa && formatDesconto(uc.empresa.cupom_valor, uc.empresa.cupom_tipo) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDesconto(uc.empresa.cupom_valor, uc.empresa.cupom_tipo)}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Válido até {new Date(uc.validade + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => uc.empresa && navigate(`/cidade/${slug}/servicos/${uc.empresa.categoria}/${uc.empresa_id}`)}
                      >
                        Ver empresa
                      </Button>
                    </>
                  )}
                </div>
                <div className="cupom-ticket-stub">
                  <span className="cupom-ticket-stub-text">
                    {uc.tipo === "cidade" ? (uc.cupom?.codigo || "—") : (uc.empresa?.cupom_nome || "—")}
                  </span>
                </div>
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                  style={{ mixBlendMode: "multiply", opacity: 0.4 }}
                  aria-hidden
                >
                  <span className="text-[10px] font-mono text-foreground/90 rotate-[-18deg] whitespace-nowrap">
                    CPF: {formatCPF(profile?.cpf)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeusCuponsPage;
