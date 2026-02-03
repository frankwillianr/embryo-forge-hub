import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import type { Jornal } from "@/types/jornal";

interface JornalCardProps {
  jornal: Jornal;
  cidadeSlug?: string;
}

const JornalCard = ({ jornal, cidadeSlug }: JornalCardProps) => {
  const navigate = useNavigate();
  const primeiraImagem = jornal.imagens?.[0]?.imagem_url;
  
  const handleClick = () => {
    navigate(`/cidade/${cidadeSlug}/jornal/${jornal.id}`);
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
            alt={jornal.titulo}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : jornal.video_url ? (
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
      <div className="pt-3 space-y-1">
        <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wide">
          {format(new Date(jornal.created_at), "dd MMM", { locale: ptBR })}
          {jornal.fonte && <span className="ml-2">· {jornal.fonte}</span>}
        </p>
        <h3 className="font-medium text-foreground line-clamp-2 text-[15px] leading-snug tracking-tight">
          {jornal.titulo}
        </h3>
      </div>
    </div>
  );
};

export default JornalCard;
