import { useNavigate } from "react-router-dom";

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

const allServicos = [
  { id: "veiculos", nome: "Veículos", icon: veiculosIcon },
  { id: "desapega", nome: "Desapega", icon: desapegaIcon },
  { id: "entregador", nome: "Entregador", icon: entregadorIcon },
  { id: "salao", nome: "Salão", icon: salaoIcon },
  { id: "reparos", nome: "Reparos", icon: reparosIcon },
  { id: "limpeza", nome: "Limpeza", icon: limpezaIcon },
  { id: "pet", nome: "Pet", icon: petIcon },
  { id: "obras", nome: "Obras", icon: obrasIcon },
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
              className="flex flex-col items-center justify-center bg-muted/60 hover:bg-muted rounded-xl py-2.5 px-2 transition-all active:scale-95 group"
            >
              {/* Icon */}
              <img 
                src={item.icon} 
                alt={item.nome}
                className="w-10 h-10 mb-1 group-hover:scale-110 transition-transform object-contain"
              />
              
              {/* Nome */}
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
