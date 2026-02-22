import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone } from "lucide-react";
import type { Banner } from "@/types/banner";

interface BannerCarouselProps {
  banners: Banner[];
  cidadeSlug?: string;
}

const SLIDE_WIDTH_PERCENT = 78;
const PEEK_PERCENT = (100 - SLIDE_WIDTH_PERCENT) / 2;

const BannerCarousel = ({ banners, cidadeSlug }: BannerCarouselProps) => {
  const isInfinite = banners.length >= 2;
  const infiniteBanners = isInfinite ? [...banners, ...banners, ...banners] : banners;
  const totalSlides = infiniteBanners.length;
  const middleStart = isInfinite ? banners.length : 0;

  const [currentIndex, setCurrentIndex] = useState(middleStart);
  const [isJumping, setIsJumping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.offsetWidth));
    ro.observe(el);
    setContainerWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const nextSlide = useCallback(() => {
    if (isInfinite) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }
  }, [isInfinite, banners.length]);

  const prevSlide = useCallback(() => {
    if (isInfinite) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    }
  }, [isInfinite, banners.length]);

  // Scroll infinito: ao chegar nas bordas do bloco do meio, repõe sem transição
  useEffect(() => {
    if (!isInfinite || isDragging) return;
    const t = setTimeout(() => {
      if (currentIndex >= 2 * banners.length) {
        setIsJumping(true);
        setCurrentIndex(banners.length);
        const t2 = setTimeout(() => setIsJumping(false), 50);
        return () => clearTimeout(t2);
      }
      if (currentIndex < banners.length) {
        setIsJumping(true);
        setCurrentIndex(2 * banners.length - 1);
        const t2 = setTimeout(() => setIsJumping(false), 50);
        return () => clearTimeout(t2);
      }
    }, 520);
    return () => clearTimeout(t);
  }, [currentIndex, isInfinite, isDragging, banners.length]);

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

  const logicalIndex = currentIndex % banners.length;
  const currentBanner = banners[logicalIndex];

  const handleBannerClick = (bannerId: string) => {
    if (Math.abs(translateX) < 10) {
      navigate(`/cidade/${cidadeSlug}/banner/${bannerId}`);
    }
  };

  const GAP = 8;
  const slideWidthPx = containerWidth * (SLIDE_WIDTH_PERCENT / 100);
  const peekPx = containerWidth * (PEEK_PERCENT / 100);
  // Centralizar o slide ativo: ele começa em peekPx para mostrar pedaço à esquerda e à direita
  const transformPx = peekPx - currentIndex * (slideWidthPx + GAP) + translateX;

  return (
    <div className="px-4 py-5">
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Track: slides alinhados; transform centraliza o ativo (peek dos dois lados) */}
        <div
          className={`flex ${isDragging || isJumping ? "" : "transition-transform duration-500 ease-out"}`}
          style={{
            width: totalSlides * slideWidthPx + (totalSlides - 1) * GAP,
            gap: GAP,
            transform: `translateX(${transformPx}px)`,
            cursor: isDragging ? "grabbing" : "grab",
          }}
        >
          {infiniteBanners.map((banner, idx) => (
            <div
              key={`${banner.id}-${idx}`}
              className="flex-shrink-0 select-none"
              style={{ width: slideWidthPx }}
              onClick={() => handleBannerClick(banner.id)}
            >
              <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden shadow-md">
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

        {/* Botão Saiba Mais - no card central (só no slide ativo visualmente) */}
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none w-[78%] flex justify-start px-3 box-border"
          style={{ maxWidth: "calc(78vw - 1rem)" }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (currentBanner) {
                navigate(`/cidade/${cidadeSlug}/banner/${currentBanner.id}`);
              }
            }}
            className="pointer-events-auto flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white/90 text-[10px] font-medium hover:bg-black/60 transition-colors"
          >
            Saiba mais
          </button>
        </div>
      </div>

      {/* Linha abaixo do carrossel: dots à esquerda, Anunciar à direita */}
      <div className="flex items-center justify-between gap-3 pt-3 px-0.5">
        {banners.length > 1 ? (
          <div className="flex justify-start gap-1.5">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(isInfinite ? middleStart + index : index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === logicalIndex
                    ? "bg-primary/70 w-4"
                    : "bg-muted-foreground/20 w-1.5 hover:bg-muted-foreground/40"
                }`}
                aria-label={`Ir para slide ${index + 1}`}
              />
            ))}
          </div>
        ) : (
          <span />
        )}
        <button
          onClick={() => navigate(`/cidade/${cidadeSlug}/banner/novo`)}
          className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Megaphone className="h-3.5 w-3.5" />
          Anunciar
        </button>
      </div>
    </div>
  );
};

export default BannerCarousel;
