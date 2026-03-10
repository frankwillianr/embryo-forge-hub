import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Car, ShoppingBag, ChevronRight, Briefcase, Gift } from "lucide-react";

// Import icons para grid
import veiculosIcon from "@/assets/icons/veiculos.png";
import desapegaIcon from "@/assets/icons/desapega.png";
import entregadorIcon from "@/assets/icons/entregador.png";
import salaoIcon from "@/assets/icons/salao.png";
import reparosIcon from "@/assets/icons/reparos.png";
import limpezaIcon from "@/assets/icons/limpeza.png";
import petIcon from "@/assets/icons/pet.png";
import obrasIcon from "@/assets/icons/obras.png";

interface ServicosSectionProps {
  cidadeSlug?: string;
}

type Servico = { id: string; nome: string; icon?: string; emoji?: string };

// Mapeamento: categoria do app → categorias no banco
const categoriaBancoMap: Record<string, string[]> = {
  beleza: ["salao", "barbeiro", "manicure", "estetica", "maquiagem", "sobrancelha", "depilacao"],
  servicos: ["reparos", "eletricista", "encanador", "obras", "limpeza", "dedetizacao", "chaveiro", "pintor", "marceneiro", "serralheria", "vidraceiro", "ar-condicionado", "jardinagem", "mudancas", "diarista", "costura"],
  profissionais: ["advogado", "contador", "despachante", "engenheiro", "arquiteto", "corretor", "fotografo", "aulas", "idiomas", "informatica", "eventos"],
  saude: ["clinica", "dentista", "psicologo", "fisioterapeuta", "nutricionista", "personal", "academia", "massagista", "farmacia"],
  comercio: ["desapega", "lojas", "promocoes", "restaurantes", "entregador", "moda", "eletronicos"],
  veiculos: ["mecanico", "lava-jato", "auto-pecas", "guincho", "funilaria", "borracharia", "vistoria", "motorista"],
  pets: ["veterinario", "pet", "petshop", "adestrador", "hotel-pet", "passeador"],
};

// Categorias de serviços
const categorias: Array<{ id: string; titulo: string; emoji: string; servicos: Servico[] }> = [
  {
    id: "beleza",
    titulo: "Beleza",
    emoji: "💇",
    servicos: [
      { id: "salao", nome: "Salão", icon: salaoIcon },
      { id: "barbeiro", nome: "Barbeiro", emoji: "💈" },
      { id: "manicure", nome: "Manicure", emoji: "💅" },
      { id: "estetica", nome: "Estética", emoji: "✨" },
      { id: "maquiagem", nome: "Maquiagem", emoji: "💄" },
      { id: "sobrancelha", nome: "Sobrancelha", emoji: "🪮" },
      { id: "depilacao", nome: "Depilação", emoji: "🌸" },
    ],
  },
  {
    id: "servicos",
    titulo: "Serviços",
    emoji: "🛠️",
    servicos: [
      { id: "reparos", nome: "Reparos", icon: reparosIcon },
      { id: "eletricista", nome: "Eletricista", emoji: "⚡" },
      { id: "encanador", nome: "Encanador", emoji: "🚿" },
      { id: "obras", nome: "Obras", icon: obrasIcon },
      { id: "limpeza", nome: "Limpeza", icon: limpezaIcon },
      { id: "dedetizacao", nome: "Dedetização", emoji: "🪲" },
      { id: "chaveiro", nome: "Chaveiro", emoji: "🔑" },
      { id: "pintor", nome: "Pintor", emoji: "🎨" },
      { id: "marceneiro", nome: "Marceneiro", emoji: "🪑" },
      { id: "serralheria", nome: "Serralheria", emoji: "⚙️" },
      { id: "vidraceiro", nome: "Vidraceiro", emoji: "🪟" },
      { id: "ar-condicionado", nome: "Ar Cond.", emoji: "❄️" },
      { id: "jardinagem", nome: "Jardinagem", emoji: "🌳" },
      { id: "mudancas", nome: "Mudanças", emoji: "🚚" },
      { id: "diarista", nome: "Diarista", emoji: "🏠" },
      { id: "costura", nome: "Costura", emoji: "🧵" },
    ],
  },
  {
    id: "profissionais",
    titulo: "Profissionais",
    emoji: "👔",
    servicos: [
      { id: "advogado", nome: "Advogado", emoji: "⚖️" },
      { id: "contador", nome: "Contador", emoji: "📊" },
      { id: "despachante", nome: "Despachante", emoji: "📄" },
      { id: "engenheiro", nome: "Engenheiro", emoji: "🏗️" },
      { id: "arquiteto", nome: "Arquiteto", emoji: "📐" },
      { id: "corretor", nome: "Corretor", emoji: "🏡" },
      { id: "fotografo", nome: "Fotógrafo", emoji: "📷" },
      { id: "aulas", nome: "Aulas", emoji: "📚" },
      { id: "idiomas", nome: "Idiomas", emoji: "🌎" },
      { id: "informatica", nome: "Informática", emoji: "💻" },
      { id: "eventos", nome: "Eventos", emoji: "🎉" },
    ],
  },
  {
    id: "saude",
    titulo: "Saúde",
    emoji: "🏥",
    servicos: [
      { id: "clinica", nome: "Clínica", emoji: "🏥" },
      { id: "dentista", nome: "Dentista", emoji: "🦷" },
      { id: "psicologo", nome: "Psicólogo", emoji: "🧠" },
      { id: "fisioterapeuta", nome: "Fisio", emoji: "🦴" },
      { id: "nutricionista", nome: "Nutrição", emoji: "🍎" },
      { id: "personal", nome: "Personal", emoji: "🏋️" },
      { id: "academia", nome: "Academia", emoji: "💪" },
      { id: "massagista", nome: "Massagem", emoji: "💆" },
      { id: "farmacia", nome: "Farmácia", emoji: "💊" },
    ],
  },
  {
    id: "comercio",
    titulo: "Comércio",
    emoji: "🛍️",
    servicos: [
      { id: "desapega", nome: "Marketplace local", icon: desapegaIcon },
      { id: "lojas", nome: "Lojas", emoji: "🏪" },
      { id: "promocoes", nome: "Promoções", emoji: "🏷️" },
      { id: "restaurantes", nome: "Restaurantes", emoji: "🍽️" },
      { id: "entregador", nome: "Delivery", icon: entregadorIcon },
      { id: "moda", nome: "Moda", emoji: "👗" },
      { id: "eletronicos", nome: "Eletrônicos", emoji: "📱" },
    ],
  },
  {
    id: "veiculos",
    titulo: "Veículos",
    emoji: "🚗",
    servicos: [
      { id: "mecanico", nome: "Mecânico", emoji: "🔧" },
      { id: "lava-jato", nome: "Lava Jato", emoji: "🚿" },
      { id: "auto-pecas", nome: "Auto Peças", emoji: "⚙️" },
      { id: "guincho", nome: "Guincho", emoji: "🏗️" },
      { id: "funilaria", nome: "Funilaria", emoji: "🔨" },
      { id: "borracharia", nome: "Borracharia", emoji: "🔄" },
      { id: "vistoria", nome: "Vistoria", emoji: "📋" },
      { id: "motorista", nome: "Motorista", emoji: "🚙" },
    ],
  },
  {
    id: "pets",
    titulo: "Pets",
    emoji: "🐶",
    servicos: [
      { id: "veterinario", nome: "Veterinário", emoji: "🩺" },
      { id: "pet", nome: "Banho e Tosa", icon: petIcon },
      { id: "petshop", nome: "Pet Shop", emoji: "🐾" },
      { id: "adestrador", nome: "Adestrador", emoji: "🦮" },
      { id: "hotel-pet", nome: "Hotel Pet", emoji: "🏨" },
      { id: "passeador", nome: "Passeador", emoji: "🦮" },
    ],
  },
];

// Lista completa para autocomplete
const todosServicosAutocomplete = [
  { id: "veiculos", nome: "Veículos" },
  { id: "desapega", nome: "Marketplace local" },
  { id: "influenciadores", nome: "Influenciadores" },
  { id: "entregador", nome: "Entregador / Delivery" },
  { id: "salao", nome: "Salão de Beleza" },
  { id: "reparos", nome: "Reparos" },
  { id: "limpeza", nome: "Limpeza" },
  { id: "pet", nome: "Banho e Tosa / Pet" },
  { id: "obras", nome: "Obras e Construção" },
  { id: "eletricista", nome: "Eletricista" },
  { id: "encanador", nome: "Encanador" },
  { id: "mecanico", nome: "Mecânico" },
  { id: "pintor", nome: "Pintor" },
  { id: "jardinagem", nome: "Jardineiro / Jardinagem" },
  { id: "personal", nome: "Personal Trainer" },
  { id: "fotografo", nome: "Fotógrafo" },
  { id: "idiomas", nome: "Idiomas" },
  { id: "dentista", nome: "Dentista" },
  { id: "psicologo", nome: "Psicólogo" },
  { id: "barbeiro", nome: "Barbeiro" },
  { id: "manicure", nome: "Manicure" },
  { id: "advogado", nome: "Advogado" },
  { id: "contador", nome: "Contador" },
  { id: "veterinario", nome: "Veterinário" },
];

// Componente de banner carrossel
const BannerCarousel = ({
  banners,
  cidadeSlug,
}: {
  banners: Array<{ id: string; nome: string; banner_oferta_url: string; categoria: string }>;
  cidadeSlug?: string;
}) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoPlay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 4000);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    startAutoPlay();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [banners.length, startAutoPlay]);

  if (banners.length === 0) return null;

  const banner = banners[currentIndex];

  return (
    <div className="px-5 mb-4">
      <button
        onClick={() => navigate(`/cidade/${cidadeSlug}/servicos/${banner.categoria}/${banner.id}`)}
        className="w-full relative rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] transition-transform"
      >
        <img
          src={banner.banner_oferta_url}
          alt={banner.nome}
          className="w-full h-28 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
          <span className="text-white text-xs font-semibold drop-shadow-sm line-clamp-1">
            {banner.nome}
          </span>
          {banners.length > 1 && (
            <div className="flex gap-1">
              {banners.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === currentIndex ? "w-4 bg-white" : "w-1 bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </button>
    </div>
  );
};

const ServicosSection = ({ cidadeSlug }: ServicosSectionProps) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("beleza");
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const tabRefsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const isScrollingByUserRef = useRef(false);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userInteractedRef = useRef(false);

  const categoriaAtual = categorias.find((c) => c.id === categoriaSelecionada) || categorias[0];

  // Buscar cidade_id pelo slug
  const { data: cidade } = useQuery({
    queryKey: ["cidade", cidadeSlug],
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

  // Buscar todas empresas ativas com banner de oferta
  const { data: todasOfertas } = useQuery({
    queryKey: ["servicos-banners", cidade?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome, categoria, banner_oferta_url")
        .eq("cidade_id", cidade!.id)
        .eq("status", "ativo")
        .not("banner_oferta_url", "is", null);

      if (error) throw error;
      return data || [];
    },
    enabled: !!cidade?.id,
  });

  // Filtrar banners pela categoria selecionada
  const bannersCategoria = useMemo(() => {
    if (!todasOfertas) return [];
    const categoriasDB = categoriaBancoMap[categoriaSelecionada] || [];
    return todasOfertas.filter(
      (o) => categoriasDB.includes(o.categoria) && o.banner_oferta_url
    ) as Array<{ id: string; nome: string; banner_oferta_url: string; categoria: string }>;
  }, [todasOfertas, categoriaSelecionada]);

  // Filtra serviços para autocomplete
  const servicosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return todosServicosAutocomplete.filter((s) =>
      s.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const handleClick = (servicoId: string) => {
    if (servicoId === "veiculos") {
      navigate(`/cidade/${cidadeSlug}/veiculos`);
    } else if (servicoId === "desapega") {
      navigate(`/cidade/${cidadeSlug}/desapega`);
    } else if (servicoId === "doacoes") {
      navigate(`/cidade/${cidadeSlug}/doacoes`);
    } else {
      navigate(`/cidade/${cidadeSlug}/servicos/${servicoId}`);
    }
  };

  const handleSelectServico = (servicoId: string) => {
    setSearchTerm("");
    setIsSearchFocused(false);
    handleClick(servicoId);
  };

  const handleGridScroll = useCallback(() => {
    const el = gridScrollRef.current;
    if (!el || isScrollingByUserRef.current) return;
    const w = el.offsetWidth;
    const index = Math.round(el.scrollLeft / w);
    const i = Math.max(0, Math.min(index, categorias.length - 1));
    if (categorias[i] && categorias[i].id !== categoriaSelecionada) {
      setCategoriaSelecionada(categorias[i].id);
    }
  }, [categoriaSelecionada]);

  const handleTabClick = useCallback((catId: string) => {
    const index = categorias.findIndex((c) => c.id === catId);
    if (index < 0) return;
    setCategoriaSelecionada(catId);
    const el = gridScrollRef.current;
    if (el) {
      isScrollingByUserRef.current = true;
      el.scrollTo({ left: index * el.offsetWidth, behavior: "smooth" });
      setTimeout(() => { isScrollingByUserRef.current = false; }, 400);
    }
    // Pausa autoplay por 10s após interação manual
    userInteractedRef.current = true;
    setTimeout(() => { userInteractedRef.current = false; }, 10_000);
  }, []);

  useEffect(() => {
    const el = gridScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleGridScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleGridScroll);
  }, [handleGridScroll]);

  // Ao mudar a categoria, centraliza a aba no container SEM rolar a página
  useEffect(() => {
    const index = categorias.findIndex((c) => c.id === categoriaSelecionada);
    const tabEl = tabRefsRef.current[index];
    const container = tabsScrollRef.current;
    if (!tabEl || !container) return;
    const tabLeft = tabEl.offsetLeft;
    const tabWidth = tabEl.offsetWidth;
    const containerWidth = container.offsetWidth;
    const targetScroll = tabLeft - containerWidth / 2 + tabWidth / 2;
    container.scrollTo({ left: targetScroll, behavior: "smooth" });
  }, [categoriaSelecionada]);

  // Auto-avança categoria a cada 5s infinitamente; pausa 10s após interação do usuário
  useEffect(() => {
    const start = () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      autoPlayRef.current = setInterval(() => {
        if (userInteractedRef.current) return;
        setCategoriaSelecionada((prev) => {
          const idx = categorias.findIndex((c) => c.id === prev);
          const next = (idx + 1) % categorias.length;
          const nextId = categorias[next].id;
          const el = gridScrollRef.current;
          if (el) {
            isScrollingByUserRef.current = true;
            el.scrollTo({ left: next * el.offsetWidth, behavior: "smooth" });
            setTimeout(() => { isScrollingByUserRef.current = false; }, 600);
          }
          return nextId;
        });
      }, 5000);
    };
    start();
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, []);

  return (
    <div className="pt-6 pb-2">
      {/* Header com busca integrada */}
      <div className="px-5 mb-5">
        <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5 mb-0.5">
          <Briefcase className="h-4 w-4 text-primary" />
          Serviços
        </h2>
        <p className="text-[12px] text-muted-foreground/70 mb-3">
          Profissionais e empresas para o que você precisar.
        </p>

        {/* Campo de Busca */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar serviço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-muted/60 transition-all"
          />
          {isSearchFocused && searchTerm.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border/60 rounded-2xl shadow-xl z-50 max-h-[200px] overflow-y-auto">
              {servicosFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum resultado</p>
              ) : (
                <div className="py-1">
                  {servicosFiltrados.map((servico) => (
                    <button
                      key={servico.id}
                      onMouseDown={() => handleSelectServico(servico.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <span>{servico.nome}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Destaques */}
      <div className="px-5 mb-[15px]">
        <div className="grid grid-cols-3" style={{ gap: "15px" }}>
          <button
            onClick={() => handleClick("veiculos")}
            className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 p-3 flex flex-col gap-2 text-white shadow-md active:scale-[0.97] transition-transform relative overflow-hidden"
          >
            <div className="absolute -right-2 -bottom-2 opacity-15">
              <Car className="w-12 h-12" strokeWidth={1} />
            </div>
            <Car className="w-5 h-5 text-white/80" />
            <span className="text-[11px] font-semibold relative z-10">Veículos</span>
          </button>

          <button
            onClick={() => handleClick("desapega")}
            className="rounded-2xl bg-gradient-to-br from-pink-500 to-rose-400 p-3 flex flex-col gap-2 text-white shadow-md active:scale-[0.97] transition-transform relative overflow-hidden"
          >
            <div className="absolute -right-2 -bottom-2 opacity-15">
              <ShoppingBag className="w-12 h-12" strokeWidth={1} />
            </div>
            <ShoppingBag className="w-5 h-5 text-white/80" />
            <span className="text-[11px] font-semibold relative z-10">Marketplace local</span>
          </button>

          <button
            onClick={() => handleClick("doacoes")}
            className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 p-3 flex flex-col gap-2 text-white shadow-md active:scale-[0.97] transition-transform relative overflow-hidden"
          >
            <div className="absolute -right-2 -bottom-2 opacity-15">
              <Gift className="w-12 h-12" strokeWidth={1} />
            </div>
            <Gift className="w-5 h-5 text-white/80" />
            <span className="text-[11px] font-semibold relative z-10">Doações</span>
          </button>
        </div>
      </div>

      {/* Categorias - Tabs + banner + grid (sempre visíveis) */}
      <div ref={tabsScrollRef} className="overflow-x-auto scrollbar-hide mt-[15px] mb-[15px] scroll-smooth">
        <div className="flex px-5 border-b border-border/30" style={{ gap: "15px" }}>
          {categorias.map((cat, index) => (
            <button
              key={cat.id}
              ref={(el) => { tabRefsRef.current[index] = el; }}
              onClick={() => handleTabClick(cat.id)}
              className={`flex-shrink-0 flex items-center gap-1 px-4 pb-2.5 text-[13px] font-medium transition-all relative ${
                categoriaSelecionada === cat.id
                  ? "text-foreground"
                  : "text-muted-foreground/60"
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.titulo}</span>
              {categoriaSelecionada === cat.id && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <BannerCarousel
        key={categoriaSelecionada}
        banners={bannersCategoria}
        cidadeSlug={cidadeSlug}
      />

      {/* Grid de serviços */}
      <div
        ref={gridScrollRef}
        className="overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory scroll-smooth"
        style={{ scrollSnapType: "x mandatory" }}
      >
        <div className="flex" style={{ width: `${categorias.length * 100}%` }}>
          {categorias.map((cat) => (
            <div
              key={cat.id}
              className="flex-shrink-0 snap-start px-5 pb-2"
              style={{ width: `${100 / categorias.length}%`, minWidth: `${100 / categorias.length}%` }}
            >
              <div className="grid grid-cols-4 gap-y-4 gap-x-3">
                {cat.servicos.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleClick(item.id)}
                    className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    {item.icon ? (
                      <img
                        src={item.icon}
                        alt={item.nome}
                        className="w-11 h-11 object-contain mix-blend-multiply dark:mix-blend-screen dark:invert"
                      />
                    ) : (
                      <span className="text-[32px] leading-none">{item.emoji}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground text-center leading-tight line-clamp-2">
                      {item.nome}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServicosSection;
