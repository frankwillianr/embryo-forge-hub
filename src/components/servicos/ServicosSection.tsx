import { useNavigate } from "react-router-dom";

interface ServicosSectionProps {
  cidadeSlug?: string;
}

const allServicos = [
  { id: "veiculos", nome: "Veículos", emoji: "🚗" },
  { id: "desapega", nome: "Desapega", emoji: "🛍️" },
  { id: "entregador", nome: "Entregador", emoji: "🛵" },
  { id: "salao", nome: "Salão", emoji: "💇‍♀️" },
  { id: "reparos", nome: "Reparos", emoji: "🔧" },
  { id: "limpeza", nome: "Limpeza", emoji: "✨" },
  { id: "pet", nome: "Pet", emoji: "🐕" },
  { id: "obras", nome: "Obras", emoji: "🏗️" },
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
              {/* Emoji */}
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                {item.emoji}
              </span>
              
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
