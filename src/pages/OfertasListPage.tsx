import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { ArrowLeft, Search, BadgePercent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ofertasBanner from "@/assets/ofertas-banner.jpg";

const TODAS_CATEGORIAS = [
  { id: "todas", nome: "Todas", icone: "🏷️" },
  { id: "beleza", nome: "Beleza", icone: "💇" },
  { id: "servicos", nome: "Serviços", icone: "🛠️" },
  { id: "saude", nome: "Saúde", icone: "🏥" },
  { id: "comercio", nome: "Comércio", icone: "🛍️" },
  { id: "veiculos", nome: "Veículos", icone: "🚗" },
  { id: "profissionais", nome: "Profissionais", icone: "👔" },
  { id: "pets", nome: "Pets", icone: "🐶" },
];

const CATEGORIA_MAP: Record<string, string[]> = {
  beleza: ["salao", "barbeiro", "manicure", "estetica", "maquiagem", "sobrancelha", "depilacao"],
  servicos: ["reparos", "eletricista", "encanador", "obras", "limpeza", "dedetizacao", "chaveiro", "pintor", "marceneiro", "serralheria", "vidraceiro", "ar-condicionado", "jardinagem", "mudancas", "diarista", "costura"],
  profissionais: ["advogado", "contador", "despachante", "engenheiro", "arquiteto", "corretor", "fotografo", "aulas", "idiomas", "informatica", "eventos"],
  saude: ["clinica", "dentista", "psicologo", "fisioterapeuta", "nutricionista", "personal", "academia", "massagista", "farmacia"],
  comercio: ["desapega", "lojas", "promocoes", "restaurantes", "entregador", "moda", "eletronicos"],
  veiculos: ["mecanico", "lava-jato", "auto-pecas", "guincho", "funilaria", "borracharia", "vistoria", "motorista"],
  pets: ["veterinario", "pet", "petshop", "adestrador", "hotel-pet", "passeador"],
};

const categoriasMeta: Record<string, { nome: string; icone: string }> = {
  entregador: { nome: "Entregador", icone: "🚴" },
  motorista: { nome: "Motorista", icone: "🚗" },
  mudancas: { nome: "Mudanças", icone: "🚚" },
  salao: { nome: "Salão", icone: "💇" },
  manicure: { nome: "Manicure", icone: "💅" },
  barbeiro: { nome: "Barbeiro", icone: "✂️" },
  reparos: { nome: "Reparos", icone: "🔧" },
  eletricista: { nome: "Eletricista", icone: "⚡" },
  encanador: { nome: "Encanador", icone: "🔧" },
  pintor: { nome: "Pintor", icone: "🎨" },
  chaveiro: { nome: "Chaveiro", icone: "🔑" },
  vidraceiro: { nome: "Vidraceiro", icone: "🪟" },
  limpeza: { nome: "Limpeza", icone: "✨" },
  diarista: { nome: "Diarista", icone: "🏠" },
  dedetizacao: { nome: "Dedetização", icone: "🐛" },
  obras: { nome: "Obras", icone: "🏗️" },
  serralheria: { nome: "Serralheria", icone: "🔩" },
  marceneiro: { nome: "Marceneiro", icone: "🪑" },
  jardinagem: { nome: "Jardinagem", icone: "🌳" },
  pet: { nome: "Pet", icone: "🐕" },
  informatica: { nome: "Informática", icone: "💻" },
  "ar-condicionado": { nome: "Ar Condicionado", icone: "❄️" },
  personal: { nome: "Personal", icone: "💪" },
  nutricionista: { nome: "Nutrição", icone: "🍎" },
  massagista: { nome: "Massagem", icone: "💆" },
  aulas: { nome: "Aulas", icone: "📚" },
  fotografo: { nome: "Fotógrafo", icone: "📸" },
  eventos: { nome: "Eventos", icone: "🎉" },
  costura: { nome: "Costura", icone: "🧵" },
};

const OfertasListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  useSwipeBack({ onBack: () => navigate(`/cidade/${slug}`) });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("todas");

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

  const { data: ofertas, isLoading } = useQuery({
    queryKey: ["todas-ofertas", cidade?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome, categoria, banner_oferta_url, descricao")
        .eq("cidade_id", cidade!.id)
        .eq("status", "ativo")
        .not("banner_oferta_url", "is", null)
        .order("nome", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!cidade?.id,
  });

  const ofertasFiltradas = useMemo(() => {
    if (!ofertas) return [];
    return ofertas.filter((oferta) => {
      const matchSearch = !searchTerm || oferta.nome.toLowerCase().includes(searchTerm.toLowerCase());
      if (categoriaAtiva === "todas") return matchSearch;
      const dbCats = CATEGORIA_MAP[categoriaAtiva] || [];
      return dbCats.includes(oferta.categoria) && matchSearch;
    });
  }, [ofertas, categoriaAtiva, searchTerm]);

  return (
    <div id="swipe-back-page" className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Mural de ofertas</h1>
      </header>

      <div className="relative h-52 overflow-hidden border-b border-border">
        <img src={ofertasBanner} alt="Ofertas" className="w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/35 to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,160,46,0.42),transparent_45%)]" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3 backdrop-blur-md shadow-lg">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90">
              <BadgePercent className="h-3.5 w-3.5" />
              Promoções da cidade
            </div>
            <h2 className="mt-2 text-[22px] leading-tight font-black text-white">Mural de Ofertas</h2>
            <p className="mt-1 text-xs text-white/80">Descontos e oportunidades para você economizar hoje.</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border bg-card/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ofertas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border-b border-border bg-card/30">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-4 py-3 w-max">
            {TODAS_CATEGORIAS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaAtiva(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  categoriaAtiva === cat.id
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                <span>{cat.icone}</span>
                <span>{cat.nome}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : ofertasFiltradas.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {ofertasFiltradas.map((oferta) => {
              const meta = categoriasMeta[oferta.categoria] || { nome: oferta.categoria, icone: "📦" };
              return (
                <button
                  key={oferta.id}
                  onClick={() => navigate(`/cidade/${slug}/servicos/${oferta.categoria}/${oferta.id}`)}
                  className="flex flex-col rounded-2xl overflow-hidden bg-card border border-border/50 shadow-sm hover:shadow-lg transition-all active:scale-[0.97] text-left"
                >
                  <div className="relative aspect-[4/3] w-full">
                    <img src={oferta.banner_oferta_url!} alt={oferta.nome} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-background/85 backdrop-blur-sm px-2 py-0.5 rounded-full">
                      <span className="text-xs">{meta.icone}</span>
                      <span className="text-[10px] font-medium text-foreground">{meta.nome}</span>
                    </div>
                  </div>
                  <div className="p-2.5 flex-1">
                    <h3 className="text-[13px] font-semibold text-foreground line-clamp-2 leading-tight">{oferta.nome}</h3>
                    <span className="inline-block mt-1.5 text-[10px] font-semibold text-primary">Ver oferta →</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BadgePercent className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-foreground mb-1">Nenhuma oferta nessa categoria</h3>
            <p className="text-sm text-muted-foreground mb-6">Seja o primeiro a anunciar aqui!</p>
            <button
              onClick={() => navigate(`/cidade/${slug}/empresa/novo`)}
              className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Coloque sua empresa aqui
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default OfertasListPage;
