import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DesapegaCardProps {
  anuncio: {
    id: string;
    titulo: string;
    preco: number;
    created_at: string;
    imagens?: { id: string; url: string; ordem: number }[];
    categoria?: { id: string; nome: string; icone: string };
  };
  cidadeSlug: string;
}

const DesapegaCard = ({ anuncio, cidadeSlug }: DesapegaCardProps) => {
  const navigate = useNavigate();

  const primeiraImagem = anuncio.imagens?.sort((a, b) => a.ordem - b.ordem)[0];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const timeAgo = formatDistanceToNow(new Date(anuncio.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <button
      onClick={() => navigate(`/cidade/${cidadeSlug}/desapega/${anuncio.id}`)}
      className="group text-left"
    >
      {/* Imagem */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-muted mb-2">
        {primeiraImagem ? (
          <img
            src={primeiraImagem.url}
            alt={anuncio.titulo}
            className="w-full h-full object-cover transition-transform group-active:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">📦</span>
          </div>
        )}

        {/* Favorito */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log("Favoritar", anuncio.id);
          }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center transition-transform active:scale-90"
        >
          <Heart className="h-4 w-4 text-foreground" />
        </button>
      </div>

      {/* Info */}
      <div className="space-y-0.5">
        <p className="font-semibold text-primary text-[15px]">
          {formatPrice(anuncio.preco)}
        </p>
        <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
          {anuncio.titulo}
        </h3>
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </button>
  );
};

export default DesapegaCard;
