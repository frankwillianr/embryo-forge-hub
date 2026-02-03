import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bike,
  Scissors,
  Wrench,
  Sparkles,
  Dog,
  Hammer,
  Zap,
  Droplets,
  PaintBucket,
  TreeDeciduous,
  Car,
  Truck,
  GraduationCap,
  Camera,
  PartyPopper,
  Hand,
  Shirt,
  Home,
  Dumbbell,
  Apple,
  HeartPulse,
  Key,
  Square,
  Factory,
  Armchair,
  Monitor,
  Wind,
  Bug,
  User,
  ShoppingBag,
} from "lucide-react";

interface ServicoCategoria {
  id: string;
  nome: string;
  icon: React.ElementType;
  color: string;
}

const categorias: ServicoCategoria[] = [
  // Destaques (mostrados na home)
  { id: "veiculos", nome: "Veículos", icon: Car, color: "bg-blue-500" },
  { id: "desapega", nome: "Desapega", icon: ShoppingBag, color: "bg-pink-500" },
  
  // Entregas e transporte
  { id: "entregador", nome: "Entregador", icon: Bike, color: "bg-orange-500" },
  { id: "motorista", nome: "Motorista", icon: Car, color: "bg-slate-600" },
  { id: "mudancas", nome: "Mudanças", icon: Truck, color: "bg-amber-600" },
  
  // Beleza e estética
  { id: "salao", nome: "Salão", icon: Scissors, color: "bg-purple-500" },
  { id: "manicure", nome: "Manicure", icon: Hand, color: "bg-pink-400" },
  { id: "barbeiro", nome: "Barbeiro", icon: Scissors, color: "bg-gray-700" },
  
  // Casa e reparos
  { id: "reparos", nome: "Reparos", icon: Wrench, color: "bg-slate-500" },
  { id: "eletricista", nome: "Eletricista", icon: Zap, color: "bg-yellow-500" },
  { id: "encanador", nome: "Encanador", icon: Droplets, color: "bg-blue-400" },
  { id: "pintor", nome: "Pintor", icon: PaintBucket, color: "bg-indigo-500" },
  { id: "chaveiro", nome: "Chaveiro", icon: Key, color: "bg-zinc-600" },
  { id: "vidraceiro", nome: "Vidraceiro", icon: Square, color: "bg-cyan-500" },
  
  // Limpeza e organização
  { id: "limpeza", nome: "Limpeza", icon: Sparkles, color: "bg-cyan-500" },
  { id: "diarista", nome: "Diarista", icon: Home, color: "bg-teal-500" },
  { id: "dedetizacao", nome: "Dedetização", icon: Bug, color: "bg-red-600" },
  
  // Construção
  { id: "obras", nome: "Obras", icon: Hammer, color: "bg-emerald-500" },
  { id: "serralheria", nome: "Serralheria", icon: Factory, color: "bg-gray-600" },
  { id: "marceneiro", nome: "Marceneiro", icon: Armchair, color: "bg-amber-700" },
  
  // Jardim e externo
  { id: "jardinagem", nome: "Jardinagem", icon: TreeDeciduous, color: "bg-green-500" },
  
  // Pet
  { id: "pet", nome: "Pet", icon: Dog, color: "bg-amber-500" },
  
  // Tecnologia
  { id: "informatica", nome: "Informática", icon: Monitor, color: "bg-blue-600" },
  { id: "ar-condicionado", nome: "Ar Cond.", icon: Wind, color: "bg-sky-500" },
  
  // Saúde e bem-estar
  { id: "personal", nome: "Personal", icon: Dumbbell, color: "bg-red-500" },
  { id: "nutricionista", nome: "Nutrição", icon: Apple, color: "bg-green-600" },
  { id: "massagista", nome: "Massagem", icon: HeartPulse, color: "bg-rose-400" },
  
  // Educação e eventos
  { id: "aulas", nome: "Aulas", icon: GraduationCap, color: "bg-violet-500" },
  { id: "fotografo", nome: "Fotógrafo", icon: Camera, color: "bg-fuchsia-500" },
  { id: "eventos", nome: "Eventos", icon: PartyPopper, color: "bg-yellow-400" },
  
  // Outros
  { id: "costura", nome: "Costura", icon: Shirt, color: "bg-pink-600" },
];

const ServicosListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCategorias = categorias.filter((cat) =>
    cat.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClick = (servicoId: string) => {
    if (servicoId === "veiculos") {
      navigate(`/cidade/${slug}/veiculos`);
    } else if (servicoId === "desapega") {
      navigate(`/cidade/${slug}/desapega`);
    } else {
      navigate(`/cidade/${slug}/servicos/${servicoId}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/cidade/${slug}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Serviços</h1>
      </header>

      {/* Search */}
      <div className="p-4 border-b border-border bg-card/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar serviço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid de categorias */}
      <main className="flex-1 p-4">
        {filteredCategorias.length > 0 ? (
          <div className="grid grid-cols-4 gap-4">
            {filteredCategorias.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleClick(cat.id)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div
                    className={`w-14 h-14 rounded-full ${cat.color} flex items-center justify-center transition-transform group-active:scale-95 shadow-lg shadow-black/10`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-[11px] font-medium text-foreground/80 text-center leading-tight">
                    {cat.nome}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">
              Nenhum serviço encontrado
            </h3>
            <p className="text-sm text-muted-foreground">
              Tente buscar por outro termo
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ServicosListPage;
