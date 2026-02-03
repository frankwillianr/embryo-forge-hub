import { useNavigate } from "react-router-dom";
import { 
  Car, 
  ShoppingBag, 
  Bike, 
  Scissors, 
  Wrench, 
  Sparkles, 
  Dog, 
  Hammer 
} from "lucide-react";

interface ServicosSectionProps {
  cidadeSlug?: string;
}

const destaques = [
  {
    id: "veiculos",
    nome: "Veículos",
    descricao: "Compra e venda",
    icon: Car,
    gradient: "from-blue-500 to-blue-600",
  },
  {
    id: "desapega",
    nome: "Desapega",
    descricao: "Brechó local",
    icon: ShoppingBag,
    gradient: "from-pink-500 to-rose-500",
  },
];

const categorias = [
  { id: "entregador", nome: "Entregador", icon: Bike, color: "bg-orange-500" },
  { id: "salao", nome: "Salão", icon: Scissors, color: "bg-purple-500" },
  { id: "reparos", nome: "Reparos", icon: Wrench, color: "bg-slate-500" },
  { id: "limpeza", nome: "Limpeza", icon: Sparkles, color: "bg-cyan-500" },
  { id: "pet", nome: "Pet", icon: Dog, color: "bg-amber-500" },
  { id: "obras", nome: "Obras", icon: Hammer, color: "bg-emerald-500" },
];

const ServicosSection = ({ cidadeSlug }: ServicosSectionProps) => {
  const navigate = useNavigate();

  const handleClick = (servicoId: string) => {
    if (servicoId === "veiculos") {
      navigate(`/cidade/${cidadeSlug}/veiculos`);
    } else {
      console.log(`Clicou em ${servicoId}`);
    }
  };

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Serviços
          </h2>
          <p className="text-[12px] text-muted-foreground/70">
            Encontre o que precisa na sua cidade
          </p>
        </div>
        <button
          onClick={() => navigate(`/cidade/${cidadeSlug}/servicos`)}
          className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
        >
          Ver todos
        </button>
      </div>

      {/* Destaques - 2 cards grandes */}
      <div className="px-5 mb-5">
        <div className="grid grid-cols-2 gap-3">
          {destaques.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${item.gradient} p-4 text-left transition-transform active:scale-[0.98]`}
              >
                <div className="relative z-10">
                  <Icon className="h-7 w-7 text-white/90 mb-2" />
                  <h3 className="text-white font-semibold text-[15px]">
                    {item.nome}
                  </h3>
                  <p className="text-white/70 text-[11px]">{item.descricao}</p>
                </div>
                {/* Decoração */}
                <div className="absolute -right-4 -bottom-4 opacity-20">
                  <Icon className="h-24 w-24 text-white" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Categorias - 6 bolinhas (3x2) */}
      <div className="px-5">
        <div className="grid grid-cols-3 gap-x-4 gap-y-5">
          {categorias.map((cat) => {
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
                <span className="text-[11px] font-medium text-foreground/80 text-center">
                  {cat.nome}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ServicosSection;
