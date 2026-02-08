import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Import icons
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

// Serviços em destaque (3)
const servicosDestaque = [
  { id: "veiculos", nome: "Veículos", icon: veiculosIcon },
  { id: "desapega", nome: "Desapega", icon: desapegaIcon },
  { id: "influenciadores", nome: "Influenciadores", icon: salaoIcon },
];

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

      {/* Serviços em Destaque - 3 cards premium */}
      <div className="px-5 mb-5">
        <div className="grid grid-cols-3 gap-3">
          {/* Veículos */}
          <button
            onClick={() => handleClick("veiculos")}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-4 pb-3 transition-all active:scale-95 group shadow-lg"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/20 rounded-full blur-2xl" />
            <img 
              src={veiculosIcon} 
              alt="Veículos"
              className="w-11 h-11 mb-2 group-hover:scale-110 transition-transform object-contain drop-shadow-lg"
            />
            <span className="text-[11px] font-semibold text-white block">
              Veículos
            </span>
            <span className="text-[9px] text-white/60">Compra e venda</span>
          </button>

          {/* Desapega */}
          <button
            onClick={() => handleClick("desapega")}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#E80560] to-[#c70450] p-4 pb-3 transition-all active:scale-95 group shadow-lg"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/20 rounded-full blur-2xl" />
            <img 
              src={desapegaIcon} 
              alt="Desapega"
              className="w-11 h-11 mb-2 group-hover:scale-110 transition-transform object-contain drop-shadow-lg"
            />
            <span className="text-[11px] font-semibold text-white block">
              Desapega
            </span>
            <span className="text-[9px] text-white/70">Marketplace</span>
          </button>

          {/* Influenciadores */}
          <button
            onClick={() => handleClick("influenciadores")}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#331D4A] to-[#4a2c6a] p-4 pb-3 transition-all active:scale-95 group shadow-lg"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/30 rounded-full blur-2xl" />
            <img 
              src={salaoIcon} 
              alt="Influenciadores"
              className="w-11 h-11 mb-2 group-hover:scale-110 transition-transform object-contain drop-shadow-lg"
            />
            <span className="text-[11px] font-semibold text-white block">
              Influencers
            </span>
            <span className="text-[9px] text-white/60">Parcerias</span>
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
