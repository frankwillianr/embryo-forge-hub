import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Search,
  Briefcase,
  UtensilsCrossed,
  ShoppingBag,
  Wrench,
  Stethoscope,
  Truck,
  GraduationCap,
  Building2,
  Laptop,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VagaCard from "@/components/vagas/VagaCard";
import { Vaga } from "@/types/vagas";
import vagasBanner from "@/assets/vagas-banner.jpg";

type SegmentoId =
  | "all"
  | "administrativo"
  | "vendas"
  | "tecnologia"
  | "saude"
  | "servicos"
  | "alimentacao"
  | "logistica"
  | "educacao"
  | "outros";

const SEGMENTOS: Array<{
  id: Exclude<SegmentoId, "all">;
  label: string;
  Icon: LucideIcon;
  keywords: string[];
}> = [
  {
    id: "administrativo",
    label: "Administrativo",
    Icon: Building2,
    keywords: ["administrativo", "assistente", "secretaria", "financeiro", "rh", "recepcionista"],
  },
  {
    id: "vendas",
    label: "Vendas",
    Icon: ShoppingBag,
    keywords: ["vendas", "vendedor", "comercial", "atendente", "caixa", "balconista"],
  },
  {
    id: "tecnologia",
    label: "Tecnologia",
    Icon: Laptop,
    keywords: ["ti", "tecnologia", "sistema", "desenvolvedor", "programador", "suporte", "informatica"],
  },
  {
    id: "saude",
    label: "Saúde",
    Icon: Stethoscope,
    keywords: ["saude", "enfermagem", "tecnico de enfermagem", "clinica", "odont", "farmacia", "fisioterapia"],
  },
  {
    id: "servicos",
    label: "Serviços",
    Icon: Wrench,
    keywords: ["servico", "manutencao", "limpeza", "eletricista", "encanador", "tecnico", "auxiliar"],
  },
  {
    id: "alimentacao",
    label: "Alimentação",
    Icon: UtensilsCrossed,
    keywords: ["cozinha", "restaurante", "garcom", "garçon", "bar", "padaria", "confeitaria", "cozinheiro"],
  },
  {
    id: "logistica",
    label: "Logística",
    Icon: Truck,
    keywords: ["motorista", "entrega", "logistica", "estoque", "almoxarifado", "expedicao"],
  },
  {
    id: "educacao",
    label: "Educação",
    Icon: GraduationCap,
    keywords: ["professor", "educacao", "escola", "aula", "instrutor", "pedagog"],
  },
  {
    id: "outros",
    label: "Outros",
    Icon: Users,
    keywords: [],
  },
];

const inferirSegmento = (vaga: Vaga): Exclude<SegmentoId, "all"> => {
  const texto = `${vaga.titulo} ${vaga.empresa} ${vaga.descricao ?? ""} ${vaga.requisitos ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const segmento of SEGMENTOS) {
    if (segmento.id === "outros") continue;
    if (segmento.keywords.some((k) => texto.includes(k))) return segmento.id;
  }

  return "outros";
};

const VagasListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [segmentoSelecionado, setSegmentoSelecionado] = useState<SegmentoId>("all");

  const { data: cidade } = useQuery({
    queryKey: ["cidade", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: vagas, isLoading } = useQuery({
    queryKey: ["vagas", cidade?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vagas")
        .select("*")
        .eq("cidade_id", cidade?.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Vaga[];
    },
    enabled: !!cidade?.id,
  });

  const vagasComSegmento = useMemo(() => {
    return (vagas || []).map((vaga) => ({
      vaga,
      segmentoId: inferirSegmento(vaga),
    }));
  }, [vagas]);

  const contagemPorSegmento = useMemo(() => {
    const counts: Record<SegmentoId, number> = {
      all: vagasComSegmento.length,
      administrativo: 0,
      vendas: 0,
      tecnologia: 0,
      saude: 0,
      servicos: 0,
      alimentacao: 0,
      logistica: 0,
      educacao: 0,
      outros: 0,
    };

    vagasComSegmento.forEach(({ segmentoId }) => {
      counts[segmentoId] += 1;
    });

    return counts;
  }, [vagasComSegmento]);

  const vagasFiltradas = useMemo(() => {
    return vagasComSegmento.filter(({ vaga, segmentoId }) => {
      const busca = searchTerm.trim().toLowerCase();
      const bateBusca =
        !busca ||
        vaga.titulo.toLowerCase().includes(busca) ||
        vaga.empresa.toLowerCase().includes(busca) ||
        vaga.descricao.toLowerCase().includes(busca);

      const bateSegmento = segmentoSelecionado === "all" || segmentoId === segmentoSelecionado;
      return bateBusca && bateSegmento;
    });
  }, [vagasComSegmento, searchTerm, segmentoSelecionado]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(`/cidade/${slug}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">Vagas de Emprego</h1>
      </header>

      <div className="relative h-52 overflow-hidden border-b border-border">
        <img src={vagasBanner} alt="Vagas de Emprego" className="w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/35 to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,160,46,0.38),transparent_45%)]" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3 backdrop-blur-md shadow-lg">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90">
              <Briefcase className="h-3.5 w-3.5" />
              Oportunidades da cidade
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <h2 className="text-[22px] leading-tight font-black text-white">Vagas de Emprego</h2>
              <div className="h-8 min-w-8 px-2 rounded-full bg-white/20 border border-white/30 text-xs font-semibold text-white flex items-center justify-center">
                {contagemPorSegmento.all}
              </div>
            </div>
            <p className="mt-1 text-xs text-white/80">Veja vagas abertas e anuncie oportunidades locais.</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Buscar cargo, empresa ou habilidade"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
        <Button onClick={() => navigate(`/cidade/${slug}/vagas/nova`)} className="rounded-xl">
          Anunciar
        </Button>
      </div>

      <div className="overflow-x-auto scrollbar-hide px-4 pb-3">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setSegmentoSelecionado("all")}
            className={`h-9 px-3 rounded-full text-xs font-medium border transition-colors ${
              segmentoSelecionado === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos ({contagemPorSegmento.all})
          </button>

          {SEGMENTOS.map(({ id, label, Icon }) => {
            const ativo = segmentoSelecionado === id;
            return (
              <button
                key={id}
                onClick={() => setSegmentoSelecionado(id)}
                className={`h-9 px-3 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  ativo
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
                <span>({contagemPorSegmento[id]})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-8">
        {isLoading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-muted/30 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : vagasFiltradas.length > 0 ? (
          <div className="space-y-3">
            {vagasFiltradas.map(({ vaga, segmentoId }) => {
              const meta = SEGMENTOS.find((s) => s.id === segmentoId);
              return (
                <VagaCard
                  key={vaga.id}
                  vaga={vaga}
                  segmentoLabel={meta?.label}
                  SegmentoIcon={meta?.Icon}
                  onClick={() => navigate(`/cidade/${slug}/vagas/${vaga.id}`)}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Briefcase className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-[15px] text-muted-foreground">
              {searchTerm || segmentoSelecionado !== "all"
                ? "Nenhuma vaga encontrada com esses filtros"
                : "Nenhuma vaga disponível"}
            </p>
            {!searchTerm && segmentoSelecionado === "all" && (
              <button
                onClick={() => navigate(`/cidade/${slug}/vagas/nova`)}
                className="mt-3 text-[15px] text-primary font-medium"
              >
                Publicar vaga
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VagasListPage;
