import { RefObject, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface UseSwipeBackOptions {
  edgeWidth?: number;   // px from left edge to start detecting
  threshold?: number;   // px to trigger back
  onBack?: () => void;  // custom back action (default: navigate(-1))
  containerRef?: RefObject<HTMLElement | null>;
}

export function useSwipeBack({
  edgeWidth = 30,
  threshold = 80,
  onBack,
  containerRef,
}: UseSwipeBackOptions = {}) {
  const navigate = useNavigate();
  const startX = useRef(0);
  const startY = useRef(0);
  const isEdgeSwipe = useRef(false);
  const isDragging = useRef(false);
  const overlay = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const getContainer = () => containerRef?.current ?? document.getElementById("root");

    const resetContainerStyles = () => {
      const container = getContainer();
      if (!container) return;
      container.style.transform = "";
      container.style.transition = "";
      container.style.boxShadow = "";
      container.style.willChange = "";
    };

    const moveContainer = (dx: number) => {
      const container = getContainer();
      if (!container) return;
      const progress = Math.min(dx / threshold, 1);
      container.style.willChange = "transform";
      container.style.transition = "none";
      container.style.transform = `translate3d(${dx}px, 0, 0)`;
      container.style.boxShadow = `-12px 0 28px rgba(0,0,0,${0.08 + progress * 0.1})`;
    };

    const animateContainer = (toX: number, onDone?: () => void) => {
      const container = getContainer();
      if (!container) {
        onDone?.();
        return;
      }

      const finish = () => {
        container.removeEventListener("transitionend", finish);
        onDone?.();
      };

      container.addEventListener("transitionend", finish);
      container.style.transition = "transform 210ms cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 210ms ease";
      container.style.transform = `translate3d(${toX}px, 0, 0)`;
      container.style.boxShadow = toX > 0 ? "-12px 0 28px rgba(0,0,0,0.16)" : "";
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch.clientX <= edgeWidth) {
        isEdgeSwipe.current = true;
        isDragging.current = false;
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
      if (dy > Math.max(dx, 0)) {
        cleanup();
        return;
      }

      if (dx > 0 && overlay.current) {
        isDragging.current = true;
        const progress = Math.min(dx / threshold, 1);
        overlay.current.style.width = `${dx}px`;
        overlay.current.style.opacity = String(progress);
        moveContainer(dx);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isEdgeSwipe.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX.current;

      if (dx >= threshold && isDragging.current) {
        animateContainer(window.innerWidth, () => {
          if (onBack) {
            onBack();
          } else if (window.history.length > 1) {
            navigate(-1);
          }
          requestAnimationFrame(() => resetContainerStyles());
        });
      } else if (isDragging.current) {
        animateContainer(0, () => resetContainerStyles());
      } else {
        resetContainerStyles();
      }

      cleanup();
    };

    const cleanup = () => {
      isEdgeSwipe.current = false;
      isDragging.current = false;
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
      resetContainerStyles();
      cleanup();
    };
  }, [navigate, edgeWidth, threshold, onBack, containerRef]);
}
