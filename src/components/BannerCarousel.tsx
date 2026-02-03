import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Banner } from "@/types/banner";

interface BannerCarouselProps {
  banners: Banner[];
}

const BannerCarousel = ({ banners }: BannerCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  // Auto-scroll every 4 seconds
  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(nextSlide, 4000);
    return () => clearInterval(interval);
  }, [banners.length, nextSlide]);

  if (banners.length === 0) {
    return null;
  }

  const handleBannerClick = (bannerId: string) => {
    navigate(`/banner/${bannerId}`);
  };

  return (
    <div className="relative w-full overflow-hidden">
      {/* Slides Container */}
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="w-full flex-shrink-0 cursor-pointer"
            onClick={() => handleBannerClick(banner.id)}
          >
            <div className="aspect-[16/9] w-full">
              <img
                src={banner.imagem_url}
                alt={banner.titulo}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Dots Indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? "bg-primary w-4"
                  : "bg-white/60 hover:bg-white/80"
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
