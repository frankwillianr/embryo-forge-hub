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

const allServicos = [
  {
    id: "veiculos",
    nome: "Veículos",
    icon: Car,
    emoji: "🚗",
    isNew: false,
  },
  {
    id: "desapega",
    nome: "Desapega",
    icon: ShoppingBag,
    emoji: "🛍️",
    isNew: true,
  },
  {
    id: "entregador",
    nome: "Entregador",
    icon: Bike,
    emoji: "🛵",
    isNew: false,
  },
  {
    id: "salao",
    nome: "Salão",
    icon: Scissors,
    emoji: "💇‍♀️",
    isNew: false,
  },
  {
    id: "reparos",
    nome: "Reparos",
    icon: Wrench,
    emoji: "🔧",
    isNew: false,
  },
  {
    id: "limpeza",
    nome: "Limpeza",
    icon: Sparkles,
    emoji: "✨",
    isNew: false,
  },
  {
    id: "pet",
    nome: "Pet",
    icon: Dog,
    emoji: "🐕",
    isNew: false,
  },
  {
    id: "obras",
    nome: "Obras",
    icon: Hammer,
    emoji: "🏗️",
    isNew: false,
  },
];

const ServicosSection = ({ cidadeSlug }: ServicosSectionProps) => {
  const navigate = useNavigate();

  const handleClick = (servicoId: string) => {
    if (servicoId === "veiculos") {
      navigate(`/cidade/${cidadeSlug}/veiculos`);
    } else if (servicoId === "desapega") {
      navigate(`/cidade/${cidadeSlug}/desapega`);
    } else {
      navigate(`/cidade/${cidadeSlug}/servicos/${servicoId}`);
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

      {/* Grid de Categorias - Estilo iFood */}
      <div className="px-5">
        <div className="grid grid-cols-4 gap-2">
          {allServicos.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className="relative flex flex-col items-center justify-center bg-muted/60 hover:bg-muted rounded-2xl p-3 pt-4 pb-3 transition-all active:scale-95 group"
            >
              {/* Badge Novo */}
              {item.isNew && (
                <span className="absolute -top-1 -left-1 bg-accent text-accent-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                  Novo
                </span>
              )}
              
              {/* Emoji grande */}
              <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                {item.emoji}
              </span>
              
              {/* Nome */}
              <span className="text-[11px] font-medium text-foreground text-center leading-tight">
                {item.nome}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServicosSection;
