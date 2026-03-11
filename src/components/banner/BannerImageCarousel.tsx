import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface BannerImageCarouselProps {
  images: string[];
}

const BannerImageCarousel = ({ images }: BannerImageCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) return null;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setTranslateX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startX;
    setTranslateX(diff);
  };

  const handleTouchEnd = () => {
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

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setTranslateX(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTranslateX(e.clientX - startX);
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

  const baseTransform = -currentIndex * 100;
  const dragOffset = containerRef.current 
    ? (translateX / containerRef.current.offsetWidth) * 100 
    : 0;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">Galeria</h3>
      
      <div 
        ref={containerRef}
        className="relative overflow-hidden rounded-xl touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Slides */}
        <div
          className={`flex ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
          style={{ 
            transform: `translateX(${baseTransform + dragOffset}%)`,
            cursor: images.length > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
          }}
        >
          {images.map((url, index) => (
            <div key={index} className="w-full flex-shrink-0">
              <div className="aspect-[4/3] w-full">
                <img
                  src={url}
                  alt={`Imagem ${index + 1}`}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prevSlide(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextSlide(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Dots */}
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? "bg-primary w-4"
                  : "bg-muted-foreground/30 w-1.5 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      )}

      {/* Thumbnail cards */}
      {images.length > 1 && (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-1">
            {images.map((url, index) => (
              <button
                key={`thumb-${index}`}
                onClick={() => setCurrentIndex(index)}
                className={`relative flex-shrink-0 w-16 h-12 rounded-md overflow-hidden border transition-all ${
                  index === currentIndex
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50"
                }`}
                aria-label={`Ir para imagem ${index + 1}`}
              >
                <img
                  src={url}
                  alt={`Miniatura ${index + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BannerImageCarousel;
