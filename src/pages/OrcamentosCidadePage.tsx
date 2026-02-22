import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, FileText, Loader2, Plus, List, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const CATEGORIAS_OPTIONS = Object.entries(CATEGORIA_LABEL).sort((a, b) =>
  a[1].localeCompare(b[1], "pt-BR")
);

const OrcamentosCidadePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");

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
    queryKey: ["orcamentos-cidade", cidade?.id, categoriaFiltro],
    queryFn: async () => {
      if (!cidade?.id) return [];
      let query = supabase
        .from("solicitacao_orcamento")
        .select("id, categoria, descricao, status, created_at, cep, nome_solicitante_censurado, bairro, user_id")
        .eq("cidade_id", cidade.id)
        .order("created_at", { ascending: false });
      if (categoriaFiltro !== "todas") {
        query = query.eq("categoria", categoriaFiltro);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!cidade?.id,
  });

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate">Orçamentos solicitados</h1>
          <p className="text-xs text-muted-foreground">{cidade?.nome}</p>
        </div>
        {user && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/cidade/${slug}/minhas-solicitacoes-orcamento`)}
          >
            <List className="h-4 w-4 mr-1" />
            Minhas
          </Button>
        )}
        <Button size="sm" onClick={() => navigate(`/cidade/${slug}/solicitar-orcamento`)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova
        </Button>
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
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : solicitacoes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-2">
              {categoriaFiltro === "todas"
                ? "Nenhuma solicitação de orçamento na cidade."
                : "Nenhuma solicitação nesta categoria."}
            </p>
            <Button onClick={() => navigate(`/cidade/${slug}/solicitar-orcamento`)}>
              <Plus className="h-4 w-4 mr-2" />
              Solicitar orçamento
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {solicitacoes.length} solicitação(ões)
            </p>
            {solicitacoes.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl border border-border bg-card text-left"
              >
                <p className="text-sm font-medium text-primary">
                  {CATEGORIA_LABEL[s.categoria] || s.categoria}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{s.descricao}</p>
                <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                  {s.bairro && <p>Bairro: {s.bairro}</p>}
                  {!s.bairro && s.cep && (
                    <p>Região: {String(s.cep).replace(/(\d{5})(\d{3})/, "$1-$2")}</p>
                  )}
                  <p>
                    {format(new Date(s.created_at), "dd/MM/yyyy", { locale: ptBR })} · Solicitado por{" "}
                    {s.nome_solicitante_censurado || "Anônimo"}
                  </p>
                </div>
                {user?.id !== s.user_id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-3 w-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    onClick={() =>
                      user
                        ? navigate(`/cidade/${slug}/orcamentos/${s.id}/enviar`)
                        : navigate(`/cidade/${slug}/auth?redirect=${encodeURIComponent(`/cidade/${slug}/orcamentos`)}`)
                    }
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                    Enviar orçamento
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrcamentosCidadePage;
