import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone } from "lucide-react";
import type { Banner } from "@/types/banner";

interface BannerCarouselProps {
  banners: Banner[];
  cidadeSlug?: string;
}

const BannerCarousel = ({ banners, cidadeSlug }: BannerCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  // Auto-scroll every 4 seconds (pausado durante drag)
  useEffect(() => {
    if (banners.length <= 1 || isDragging) return;

    const interval = setInterval(nextSlide, 4000);
    return () => clearInterval(interval);
  }, [banners.length, nextSlide, isDragging]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setTranslateX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    setTranslateX(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const threshold = 50; // pixels necessários para mudar de slide
    
    if (translateX > threshold) {
      prevSlide();
    } else if (translateX < -threshold) {
      nextSlide();
    }
    
    setTranslateX(0);
  };

  // Mouse handlers (para desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setTranslateX(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - startX;
    setTranslateX(diff);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const threshold = 50;
    
    if (translateX > threshold) {
      prevSlide();
    } else if (translateX < -threshold) {
      nextSlide();
    }
    
    setTranslateX(0);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleMouseUp();
    }
  };

  if (banners.length === 0) {
    return null;
  }

  const handleBannerClick = (bannerId: string) => {
    // Só navega se não foi um drag
    if (Math.abs(translateX) < 10) {
      navigate(`/cidade/${cidadeSlug}/banner/${bannerId}`);
    }
  };

  // Calcular transform com drag offset
  const baseTransform = -currentIndex * 100;
  const dragOffset = containerRef.current 
    ? (translateX / containerRef.current.offsetWidth) * 100 
    : 0;

  return (
    <div className="p-5">
      <div 
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-[20px] touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Slides Container */}
        <div
          className={`flex ${isDragging ? '' : 'transition-transform duration-500 ease-out'}`}
          style={{ 
            transform: `translateX(${baseTransform + dragOffset}%)`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="w-full flex-shrink-0 select-none"
              onClick={() => handleBannerClick(banner.id)}
            >
              <div className="aspect-[16/9] w-full">
                <img
                  src={banner.imagem_url}
                  alt={banner.titulo}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Botão Saiba Mais - canto esquerdo */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const currentBanner = banners[currentIndex];
            if (currentBanner) {
              navigate(`/cidade/${cidadeSlug}/banner/${currentBanner.id}`);
            }
          }}
          className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white/80 text-[10px] font-medium hover:bg-black/60 transition-colors"
        >
          Saiba mais
        </button>

        {/* Botão Anunciar - canto direito */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/cidade/${cidadeSlug}/banner/novo`);
          }}
          className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white/80 text-[10px] font-medium hover:bg-black/60 transition-colors"
        >
          <Megaphone className="h-3 w-3" />
          Anunciar
        </button>
      </div>

      {/* Dots Indicator - abaixo da imagem */}
      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-3">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? "bg-primary/70 w-4"
                  : "bg-muted-foreground/20 w-1.5 hover:bg-muted-foreground/40"
              }`}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerCarousel;
