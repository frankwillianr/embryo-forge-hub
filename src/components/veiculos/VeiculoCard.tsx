import { Car, Fuel, Gauge, Calendar, Star } from "lucide-react";

interface VeiculoCardProps {
  veiculo: {
    id: string;
    titulo: string;
    preco: number;
    quilometragem: number;
    ano_fabricacao: number;
    ano_modelo: number;
    combustivel: string;
    condicao: string;
    destaque: boolean;
    marca: { nome: string } | null;
    modelo: { nome: string } | null;
    imagens: { imagem_url: string; ordem: number }[] | null;
  };
  onClick: () => void;
}

const combustivelLabels: Record<string, string> = {
  gasolina: "Gasolina",
  etanol: "Etanol",
  flex: "Flex",
  diesel: "Diesel",
  eletrico: "Elétrico",
  hibrido: "Híbrido",
  gnv: "GNV",
};

const VeiculoCard = ({ veiculo, onClick }: VeiculoCardProps) => {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatKm = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  const primeiraImagem = veiculo.imagens?.sort((a, b) => a.ordem - b.ordem)[0];

  return (
    <button
      onClick={onClick}
      className="w-full bg-card rounded-xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow text-left"
    >
      <div className="flex">
        {/* Imagem */}
        <div className="relative w-32 h-32 flex-shrink-0 bg-muted">
          {primeiraImagem ? (
            <img
              src={primeiraImagem.imagem_url}
              alt={veiculo.titulo}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Car className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
          {veiculo.destaque && (
            <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-current" />
              Destaque
            </div>
          )}
          {veiculo.condicao === "novo" && (
            <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              Novo
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 p-3 flex flex-col justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {veiculo.marca?.nome} {veiculo.modelo?.nome}
            </p>
            <h3 className="font-semibold text-sm text-foreground line-clamp-1 mt-0.5">
              {veiculo.titulo}
            </h3>
          </div>

          {/* Specs */}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {veiculo.ano_fabricacao}/{veiculo.ano_modelo}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Gauge className="h-3 w-3" />
              {formatKm(veiculo.quilometragem)} km
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Fuel className="h-3 w-3" />
              {combustivelLabels[veiculo.combustivel] || veiculo.combustivel}
            </span>
          </div>

          {/* Preço */}
          <div className="mt-2">
            <span className="text-base font-bold text-primary">
              {formatPrice(veiculo.preco)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};

export default VeiculoCard;
