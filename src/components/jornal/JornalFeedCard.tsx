import { useState, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Play } from "lucide-react";
import { type Jornal, parseImagens } from "@/types/jornal";

interface JornalFeedCardProps {
  jornal: Jornal;
  cidadeSlug?: string;
}

const JornalFeedCard = ({ jornal, cidadeSlug }: JornalFeedCardProps) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);

  const imagens = parseImagens(jornal.imagens);
  const hasMultipleImages = imagens.length > 1;
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultipleImages) return;
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !hasMultipleImages) return;
    const diff = e.touches[0].clientX - startX;
    setTranslateX(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging || !hasMultipleImages) return;
    setIsDragging(false);
    
    const threshold = 50;
    if (translateX > threshold && currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    } else if (translateX < -threshold && currentImageIndex < imagens.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    }
    setTranslateX(0);
  };

  const handleCardClick = () => {
    navigate(`/cidade/${cidadeSlug}/jornal/${jornal.id}`);
  };

  const handleDoubleTap = () => {
    setIsLiked(true);
  };

  const descricao = (jornal.descricao || "").replace(/\\n/g, '\n');
  const shouldTruncate = descricao.length > 100;

  return (
    <article className="border-b border-border/50">
      {/* Header - perfil estilo Instagram */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent p-[2px]">
            <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
              <span className="text-xs font-semibold text-foreground">
                {jornal.fonte?.charAt(0)?.toUpperCase() || "J"}
              </span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-foreground leading-tight">
              {jornal.fonte || "Jornal da Cidade"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(jornal.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </div>
        <button className="p-2 -mr-2">
          <MoreHorizontal className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Imagem/Carrossel */}
      <div 
        ref={containerRef}
        className="relative aspect-square w-full overflow-hidden bg-muted/30"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleTap}
      >
        {imagens.length > 0 ? (
          <>
            <div 
              className={`flex h-full ${isDragging ? '' : 'transition-transform duration-300'}`}
              style={{
                transform: `translateX(calc(-${currentImageIndex * 100}% + ${translateX}px))`
              }}
            >
              {imagens.map((url, index) => (
                <div key={index} className="w-full h-full flex-shrink-0">
                  <img
                    src={url}
                    alt={`${jornal.titulo} - ${index + 1}`}
                    className="w-full h-full object-cover"
                    onClick={handleCardClick}
                  />
                </div>
              ))}
            </div>
            
            {/* Indicadores de imagem */}
            {hasMultipleImages && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
                {imagens.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      index === currentImageIndex
                        ? "w-1.5 bg-primary"
                        : "w-1.5 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : jornal.video_url ? (
          <div 
            className="w-full h-full flex items-center justify-center bg-muted/50 cursor-pointer"
            onClick={handleCardClick}
          >
            <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur flex items-center justify-center">
              <Play className="h-8 w-8 text-white ml-1" fill="white" />
            </div>
          </div>
        ) : (
          <div 
            className="w-full h-full bg-gradient-to-br from-muted/40 to-muted/80 cursor-pointer"
            onClick={handleCardClick}
          />
        )}
      </div>

      {/* Ações estilo Instagram */}
      <div className="px-3 pt-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsLiked(!isLiked)}
              className="active:scale-90 transition-transform"
            >
              <Heart 
                className={`h-6 w-6 ${isLiked ? 'text-red-500 fill-red-500' : 'text-foreground'}`} 
              />
            </button>
            <button 
              onClick={handleCardClick}
              className="active:scale-90 transition-transform"
            >
              <MessageCircle className="h-6 w-6 text-foreground" />
            </button>
            <button className="active:scale-90 transition-transform">
              <Send className="h-5 w-5 text-foreground" />
            </button>
          </div>
          <button 
            onClick={() => setIsSaved(!isSaved)}
            className="active:scale-90 transition-transform"
          >
            <Bookmark 
              className={`h-6 w-6 ${isSaved ? 'text-foreground fill-foreground' : 'text-foreground'}`} 
            />
          </button>
        </div>

        {/* Curtidas */}
        <div className="mt-2">
          <span className="text-[13px] font-semibold text-foreground">
            {jornal.likes_count || 0} curtidas
          </span>
        </div>

        {/* Título e descrição */}
        <div className="mt-1 pb-3">
          <p className="text-[13px] text-foreground leading-relaxed">
            <span className="font-semibold mr-1.5">{jornal.fonte || "Jornal"}</span>
            <span className="font-medium">{jornal.titulo}</span>
            {descricao && (
              <>
                {" "}
                {shouldTruncate && !showFullText ? (
                  <>
                    <span className="text-muted-foreground">
                      {descricao.slice(0, 100)}...
                    </span>
                    <button 
                      onClick={() => setShowFullText(true)}
                      className="text-muted-foreground/70 ml-1"
                    >
                      mais
                    </button>
                  </>
                ) : (
                  <span className="text-muted-foreground">{descricao}</span>
                )}
              </>
            )}
          </p>
        </div>
      </div>
    </article>
  );
};

export default JornalFeedCard;
