import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import type { AloPrefeitura } from "@/types/aloPrefeitura";

interface AloPrefeituraCardProps {
  item: AloPrefeitura;
  cidadeSlug?: string;
}

const AloPrefeituraCard = ({ item, cidadeSlug }: AloPrefeituraCardProps) => {
  const navigate = useNavigate();
  const primeiraImagem = item.imagens?.[0]?.imagem_url;
  
  const handleClick = () => {
    navigate(`/cidade/${cidadeSlug}/alo-prefeitura/${item.id}`);
  };

  return (
    <div 
      onClick={handleClick}
      className="flex-shrink-0 w-64 cursor-pointer group"
    >
      {/* Imagem com cantos arredondados suaves */}
      <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted/50">
        {primeiraImagem ? (
          <img
            src={primeiraImagem}
            alt={item.titulo}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : item.video_url ? (
          <div className="w-full h-full flex items-center justify-center bg-muted/30">
            <div className="w-12 h-12 rounded-full bg-foreground/10 flex items-center justify-center">
              <Play className="h-5 w-5 text-foreground/60 ml-0.5" />
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted/30 to-muted/60" />
        )}
      </div>

      {/* Conteúdo minimalista */}
      <div className="pt-2.5 space-y-0.5">
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
          {format(new Date(item.created_at), "dd MMM", { locale: ptBR })}
        </p>
        <h3 className="font-medium text-foreground line-clamp-2 text-[13px] leading-tight tracking-tight">
          {item.titulo}
        </h3>
        {item.descricao && (
          <p className="text-[11px] text-muted-foreground/70 line-clamp-1 leading-snug mt-0.5">
            {item.descricao}
          </p>
        )}
      </div>
    </div>
  );
};

export default AloPrefeituraCard;
