import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Car, ShoppingBag, Users, Bike, Scissors, Wrench, Sparkles, PawPrint, HardHat } from "lucide-react";
import { Input } from "@/components/ui/input";

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

// Outros serviços (2 linhas de 4 = 8 itens)
const outrosServicos = [
  { id: "entregador", nome: "Entregador", icon: entregadorIcon },
  { id: "salao", nome: "Salão", icon: salaoIcon },
  { id: "reparos", nome: "Reparos", icon: reparosIcon },
  { id: "limpeza", nome: "Limpeza", icon: limpezaIcon },
  { id: "pet", nome: "Pet", icon: petIcon },
  { id: "obras", nome: "Obras", icon: obrasIcon },
];

const ServicosSection = ({ cidadeSlug }: ServicosSectionProps) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const handleClick = (servicoId: string) => {
    if (servicoId === "veiculos") {
      navigate(`/cidade/${cidadeSlug}/veiculos`);
    } else if (servicoId === "desapega") {
      navigate(`/cidade/${cidadeSlug}/desapega`);
    } else {
      navigate(`/cidade/${cidadeSlug}/servicos/${servicoId}`);
    }
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      navigate(`/cidade/${cidadeSlug}/servicos?q=${encodeURIComponent(searchTerm)}`);
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

      {/* Serviços em Destaque - 3 cards estilo QuickAccess */}
      <div className="px-5 mb-5">
        <div className="grid grid-cols-3 gap-2">
          {/* Veículos */}
          <button
            onClick={() => handleClick("veiculos")}
            className="aspect-square rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 p-2.5 flex flex-col justify-between text-white shadow-lg hover:shadow-xl transition-all active:scale-95 relative overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute -right-3 -bottom-3 opacity-20">
              <Car className="w-14 h-14" strokeWidth={1} />
            </div>
            
            {/* Icon */}
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            
            {/* Text */}
            <div className="text-left relative z-10">
              <h3 className="text-[10px] font-bold leading-tight">Veículos</h3>
              <p className="text-[8px] opacity-80 mt-0.5 line-clamp-1">Compra e venda</p>
            </div>
          </button>

          {/* Desapega */}
          <button
            onClick={() => handleClick("desapega")}
            className="aspect-square rounded-2xl bg-gradient-to-br from-pink-500 to-rose-400 p-2.5 flex flex-col justify-between text-white shadow-lg hover:shadow-xl transition-all active:scale-95 relative overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute -right-3 -bottom-3 opacity-20">
              <ShoppingBag className="w-14 h-14" strokeWidth={1} />
            </div>
            
            {/* Icon */}
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            
            {/* Text */}
            <div className="text-left relative z-10">
              <h3 className="text-[10px] font-bold leading-tight">Desapega</h3>
              <p className="text-[8px] opacity-80 mt-0.5 line-clamp-1">Marketplace</p>
            </div>
          </button>

          {/* Influenciadores */}
          <button
            onClick={() => handleClick("influenciadores")}
            className="aspect-square rounded-2xl bg-gradient-to-br from-purple-600 to-violet-400 p-2.5 flex flex-col justify-between text-white shadow-lg hover:shadow-xl transition-all active:scale-95 relative overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute -right-3 -bottom-3 opacity-20">
              <Users className="w-14 h-14" strokeWidth={1} />
            </div>
            
            {/* Icon */}
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            
            {/* Text */}
            <div className="text-left relative z-10">
              <h3 className="text-[10px] font-bold leading-tight">Influencers</h3>
              <p className="text-[8px] opacity-80 mt-0.5 line-clamp-1">Parcerias</p>
            </div>
          </button>
        </div>
      </div>

      {/* Campo de Busca */}
      <div className="px-5 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="O que você está procurando?"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 bg-muted/50 border-0 rounded-xl h-11"
          />
        </div>
      </div>

      {/* Grid de Outros Serviços - 4 colunas, 2 linhas */}
      <div className="px-5">
        <div className="grid grid-cols-4 gap-2">
          {outrosServicos.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className="flex flex-col items-center justify-center bg-muted/60 hover:bg-muted rounded-xl py-2.5 px-2 transition-all active:scale-95 group"
            >
              <img 
                src={item.icon} 
                alt={item.nome}
                className="w-10 h-10 mb-1 group-hover:scale-110 transition-transform object-contain mix-blend-multiply dark:mix-blend-screen dark:invert"
              />
              <span className="text-[10px] font-medium text-foreground text-center leading-tight">
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
