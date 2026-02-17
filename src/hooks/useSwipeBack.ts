import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface UseSwipeBackOptions {
  edgeWidth?: number;   // px from left edge to start detecting
  threshold?: number;   // px to trigger back
  onBack?: () => void;  // custom back action (default: navigate(-1))
}

export function useSwipeBack({ edgeWidth = 30, threshold = 80, onBack }: UseSwipeBackOptions = {}) {
  const navigate = useNavigate();
  const startX = useRef(0);
  const startY = useRef(0);
  const isEdgeSwipe = useRef(false);
  const overlay = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch.clientX <= edgeWidth) {
        isEdgeSwipe.current = true;
        startX.current = touch.clientX;
        startY.current = touch.clientY;

        // Create visual indicator
        if (!overlay.current) {
          const div = document.createElement("div");
          div.style.cssText = `
            position: fixed; top: 0; left: 0; bottom: 0; width: 0;
            background: linear-gradient(to right, rgba(0,0,0,0.08), transparent);
            z-index: 9999; pointer-events: none; transition: none;
          `;
          document.body.appendChild(div);
          overlay.current = div;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isEdgeSwipe.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = Math.abs(touch.clientY - startY.current);

      // Cancel if scrolling vertically
      if (dy > dx) {
        cleanup();
        return;
      }

      if (dx > 0 && overlay.current) {
        const progress = Math.min(dx / threshold, 1);
        overlay.current.style.width = `${dx}px`;
        overlay.current.style.opacity = String(progress);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isEdgeSwipe.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX.current;

      if (dx >= threshold) {
        if (onBack) {
          onBack();
        } else {
          navigate(-1);
        }
      }
      cleanup();
    };

    const cleanup = () => {
      isEdgeSwipe.current = false;
      if (overlay.current) {
        overlay.current.remove();
        overlay.current = null;
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      cleanup();
    };
  }, [navigate, edgeWidth, threshold, onBack]);
}
