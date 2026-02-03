import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
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
      className="flex-shrink-0 w-72 bg-card rounded-xl overflow-hidden shadow-md cursor-pointer hover:shadow-lg transition-shadow"
    >
      {/* Imagem */}
      <div className="aspect-video w-full bg-muted overflow-hidden">
        {primeiraImagem ? (
          <img
            src={primeiraImagem}
            alt={jornal.titulo}
            className="w-full h-full object-cover"
          />
        ) : jornal.video_url ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <span className="text-4xl">▶️</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <span className="text-muted-foreground text-sm">Sem imagem</span>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-3 space-y-1">
        <h3 className="font-semibold text-foreground line-clamp-2 text-sm leading-tight">
          {jornal.titulo}
        </h3>
        <p className="text-muted-foreground text-xs line-clamp-2">
          {jornal.descricao}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(jornal.created_at), "dd MMM, HH:mm", { locale: ptBR })}
          </span>
          {jornal.fonte && (
            <span className="text-[10px] text-primary truncate max-w-[100px]">
              {jornal.fonte}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default JornalCard;
