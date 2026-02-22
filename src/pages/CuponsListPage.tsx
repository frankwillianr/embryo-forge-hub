import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Tag, Lock, Copy, Check, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CATEGORIAS_SERVICO } from "@/lib/categoriasServico";

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
  categoria: string | null;
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

const CATEGORIAS_OPTIONS = Object.entries(CATEGORIAS_SERVICO).sort((a, b) =>
  a[1].localeCompare(b[1], "pt-BR")
);

const CuponsListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    queryKey: ["cupons-list", cidade?.id, !!user],
    queryFn: async () => {
      if (!cidade?.id) return [];
      if (user) {
        const { data, error } = await supabase
          .from("cupom")
          .select("id, titulo, descricao, codigo, codigo_censurado, checkins_necessarios, categoria")
          .eq("cidade_id", cidade.id)
          .eq("ativo", true)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as CupomCidadeRow[];
      }
      const { data, error } = await supabase
        .from("cupom_public")
        .select("id, titulo, descricao, codigo_censurado, checkins_necessarios, categoria")
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

  const consecutivos = diasConsecutivos(checkins);
  const cuponsBloqueados = !user || consecutivos < 7;

  const itensCupom: CupomItem[] = useMemo(() => {
    const empresaItens: CupomItem[] = cuponsEmpresa.map((e) => ({ tipo: "empresa" as const, data: e }));
    const cidadeItens: CupomItem[] = cuponsCidade.map((c) => ({ tipo: "cidade" as const, data: c }));
    return [...empresaItens, ...cidadeItens];
  }, [cuponsEmpresa, cuponsCidade]);

  const itensFiltrados =
    categoriaFiltro === "todas"
      ? itensCupom
      : itensCupom.filter((item) =>
          item.tipo === "cidade"
            ? (item.data as CupomCidadeRow).categoria === categoriaFiltro
            : true
        );

  const isLoading = loadingCupons || loadingEmpresas;

  const formatDesconto = (valor: number | null, tipo: string | null) => {
    if (valor == null) return "";
    if (tipo === "porcentagem") return `${valor}% off`;
    return `R$ ${valor.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} off`;
  };

  const handleCopy = (id: string, codigo: string) => {
    navigator.clipboard.writeText(codigo);
    setCopiedId(id);
    toast({ title: "Cupom copiado!" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate">Cupons de desconto</h1>
          <p className="text-xs text-muted-foreground">{cidade?.nome}</p>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Filtrar por categoria</label>
          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {CATEGORIAS_OPTIONS.map(([id, nome]) => (
                <SelectItem key={id} value={id}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : itensFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {categoriaFiltro === "todas"
                ? "Nenhum cupom disponível nesta cidade."
                : "Nenhum cupom nesta categoria."}
            </p>
          </div>
        ) : (
          <div className="relative space-y-3">
            {cuponsBloqueados && (
              <div
                className="absolute inset-0 z-10 cursor-not-allowed rounded-lg"
                aria-hidden
              />
            )}
            <div
              className={`space-y-3 transition-[filter] ${cuponsBloqueados ? "blur-[2px] pointer-events-none select-none" : ""}`}
            >
              {itensFiltrados.map((item) => {
                if (item.tipo === "empresa") {
                  const e = item.data;
                  const descontoTexto = formatDesconto(e.cupom_valor, e.cupom_tipo);
                  return (
                    <button
                      key={`emp-${e.id}`}
                      type="button"
                      onClick={() =>
                        slug &&
                        navigate(`/cidade/${slug}/servicos/${e.categoria}/${e.id}`)
                      }
                      className="w-full cupom-ticket text-left hover:opacity-90 transition-opacity flex-shrink-0"
                    >
                      <div className="cupom-ticket-main">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-medium text-sm text-foreground truncate">
                            {e.nome}
                          </span>
                        </div>
                        <p className="text-xs text-primary font-medium mt-1.5">
                          {e.cupom_nome}
                        </p>
                        {descontoTexto && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {descontoTexto}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/80 mt-2">
                          Toque para ver a empresa
                        </p>
                      </div>
                      <div className="cupom-ticket-stub">
                        <span className="cupom-ticket-stub-text">{e.cupom_nome}</span>
                      </div>
                    </button>
                  );
                }
                const c = item.data;
                const desbloqueado =
                  !!user && consecutivos >= (c.checkins_necessarios ?? 7);
                const codigoExibir =
                  desbloqueado && c.codigo
                    ? c.codigo
                    : (c.codigo_censurado || "••••••••");
                return (
                  <div key={`cid-${c.id}`} className="w-full cupom-ticket">
                    <div className="cupom-ticket-main">
                      <h3 className="font-medium text-sm text-foreground truncate">
                        {c.titulo}
                      </h3>
                      {c.categoria && (
                        <p className="text-xs text-primary mt-0.5">
                          {CATEGORIAS_SERVICO[c.categoria] || c.categoria}
                        </p>
                      )}
                      {c.descricao && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {c.descricao}
                        </p>
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
                            onClick={() => handleCopy(c.id, c.codigo!)}
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
                              ? `Faltam ${(c.checkins_necessarios ?? 7) - consecutivos} check-ins`
                              : "7 check-ins"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="cupom-ticket-stub">
                      <span className="cupom-ticket-stub-text">
                        {codigoExibir}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CuponsListPage;
