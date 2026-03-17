import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface UseSwipeBackOptions {
  threshold?: number;
  onBack?: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function useSwipeBack({
  threshold = 80,
  onBack,
  containerRef,
}: UseSwipeBackOptions = {}) {
  const navigate = useNavigate();
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);
  const isLocked = useRef(false);
  const currentDx = useRef(0);
  const prevPageLayer = useRef<HTMLDivElement | null>(null);
  const scrimLayer = useRef<HTMLDivElement | null>(null);

  const getContainer = useCallback(() => {
    return containerRef?.current || document.getElementById("swipe-back-page");
  }, [containerRef]);

  useEffect(() => {
    const screenW = () => window.innerWidth;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      isSwiping.current = true;
      isLocked.current = false;
      currentDx.current = 0;
      startX.current = touch.clientX;
      startY.current = touch.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = Math.abs(touch.clientY - startY.current);

      if (!isLocked.current) {
        const totalMove = Math.abs(dx) + dy;
        if (totalMove < 10) return;
        if (dy > Math.abs(dx) * 0.7 || dx < 0) {
          isSwiping.current = false;
          return;
        }
        isLocked.current = true;
        setupLayers();
      }

      // Prevent native scroll so WebView doesn't steal the horizontal gesture
      if (isLocked.current) {
        e.preventDefault();
      }

      if (dx > 0) {
        currentDx.current = dx;
        applyTransform(dx);
      }
    };

    const handleTouchEnd = () => {
      if (!isSwiping.current || !isLocked.current) {
        teardown();
        return;
      }

      const dx = currentDx.current;

      if (dx >= threshold) {
        animateOut();
      } else {
        animateBack();
      }
    };

    const setupLayers = () => {
      const container = getContainer();
      if (!container) return;

      const prev = document.createElement("div");
      prev.style.cssText = `
        position: fixed; inset: 0; z-index: 0;
        background: var(--background, hsl(0 0% 100%));
        transform: scale(0.92);
        transform-origin: center center;
        transition: none;
        border-radius: 8px;
        overflow: hidden;
      `;
      prev.innerHTML = `
        <div style="
          padding: 14px 20px; padding-top: max(14px, env(safe-area-inset-top));
          display: flex; align-items: center; gap: 12px;
          border-bottom: 1px solid rgba(128,128,128,0.12);
          background: var(--background, hsl(0 0% 100%));
        ">
          <div style="width:28px;height:28px;border-radius:8px;background:rgba(128,128,128,0.1);"></div>
          <div style="height:12px;width:100px;border-radius:6px;background:rgba(128,128,128,0.1);"></div>
        </div>
        <div style="padding: 20px; display:flex; flex-direction:column; gap:16px;">
          <div style="height:140px;border-radius:16px;background:rgba(128,128,128,0.06);"></div>
          <div style="display:flex; gap:12px;">
            <div style="height:90px;flex:1;border-radius:12px;background:rgba(128,128,128,0.06);"></div>
            <div style="height:90px;flex:1;border-radius:12px;background:rgba(128,128,128,0.06);"></div>
          </div>
          <div style="height:10px;width:60%;border-radius:4px;background:rgba(128,128,128,0.08);"></div>
          <div style="height:10px;width:40%;border-radius:4px;background:rgba(128,128,128,0.06);"></div>
        </div>
      `;

      const scrim = document.createElement("div");
      scrim.style.cssText = `
        position: fixed; inset: 0; z-index: 1;
        background: rgba(0,0,0,0.12);
        transition: none;
        pointer-events: none;
      `;

      const parent = container.parentElement || document.body;
      parent.insertBefore(prev, container);
      parent.insertBefore(scrim, container);
      prevPageLayer.current = prev;
      scrimLayer.current = scrim;

      container.style.transition = "none";
      container.style.willChange = "transform";
      container.style.position = "relative";
      container.style.zIndex = "2";
      container.style.background = "var(--background, hsl(0 0% 100%))";
      container.style.minHeight = "100vh";
      container.style.boxShadow = "-4px 0 25px rgba(0,0,0,0.15)";
    };

    const applyTransform = (dx: number) => {
      const container = getContainer();
      const w = screenW();
      const progress = Math.min(dx / w, 1);

      if (container) {
        container.style.transform = `translateX(${dx}px)`;
      }

      if (prevPageLayer.current) {
        const scale = 0.92 + 0.08 * progress;
        prevPageLayer.current.style.transform = `scale(${scale})`;
        prevPageLayer.current.style.borderRadius = `${8 * (1 - progress)}px`;
      }

      if (scrimLayer.current) {
        scrimLayer.current.style.background = `rgba(0,0,0,${0.12 * (1 - progress)})`;
      }
    };

    const animateOut = () => {
      const container = getContainer();
      const w = screenW();

      if (container) {
        container.style.transition = "transform 0.24s cubic-bezier(0.15, 0, 0.2, 1)";
        container.style.transform = `translateX(${w}px)`;
      }
      if (prevPageLayer.current) {
        prevPageLayer.current.style.transition = "transform 0.24s cubic-bezier(0.15, 0, 0.2, 1), border-radius 0.24s ease";
        prevPageLayer.current.style.transform = "scale(1)";
        prevPageLayer.current.style.borderRadius = "0px";
      }
      if (scrimLayer.current) {
        scrimLayer.current.style.transition = "background 0.24s ease";
        scrimLayer.current.style.background = "rgba(0,0,0,0)";
      }

      setTimeout(() => {
        removeLayers();
        if (onBack) {
          onBack();
        } else {
          navigate(-1);
        }
      }, 250);
    };

    const animateBack = () => {
      const container = getContainer();

      if (container) {
        container.style.transition = "transform 0.22s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.22s ease";
        container.style.transform = "translateX(0)";
        container.style.boxShadow = "none";
      }
      if (prevPageLayer.current) {
        prevPageLayer.current.style.transition = "transform 0.22s ease, border-radius 0.22s ease";
        prevPageLayer.current.style.transform = "scale(0.92)";
        prevPageLayer.current.style.borderRadius = "8px";
      }
      if (scrimLayer.current) {
        scrimLayer.current.style.transition = "background 0.22s ease";
        scrimLayer.current.style.background = "rgba(0,0,0,0.12)";
      }

      setTimeout(() => teardown(), 230);
    };

    const removeLayers = () => {
      if (prevPageLayer.current) {
        prevPageLayer.current.remove();
        prevPageLayer.current = null;
      }
      if (scrimLayer.current) {
        scrimLayer.current.remove();
        scrimLayer.current = null;
      }
    };

    const teardown = () => {
      isSwiping.current = false;
      isLocked.current = false;
      currentDx.current = 0;

      const container = getContainer();
      if (container) {
        container.style.transform = "";
        container.style.transition = "";
        container.style.willChange = "";
        container.style.boxShadow = "";
        container.style.position = "";
        container.style.zIndex = "";
        container.style.background = "";
        container.style.minHeight = "";
      }
      removeLayers();
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    // passive: false required for preventDefault() to work in WebView
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      teardown();
    };
  }, [navigate, threshold, onBack, getContainer]);
}
