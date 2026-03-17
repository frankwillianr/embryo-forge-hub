import {
  ReactElement,
  cloneElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Location, useLocation, useNavigate, useNavigationType } from "react-router-dom";

type Direction = 1 | -1;

interface AnimatedRoutesProps {
  children: ReactElement<{ location?: Location }>;
}

const PAGE_EASING = [0.22, 0.61, 0.36, 1] as const;
const PAGE_DURATION_SECONDS = 0.3;
const SWIPE_THRESHOLD = 80;

const pageVariants = {
  initial: ({ direction, width }: { direction: Direction; width: number }) => ({
    x: direction === 1 ? width : -Math.round(width * 0.3),
  }),
  animate: {
    x: 0,
    transition: {
      duration: PAGE_DURATION_SECONDS,
      ease: PAGE_EASING,
    },
  },
  exit: ({ direction, width }: { direction: Direction; width: number }) => ({
    x: direction === 1 ? -Math.round(width * 0.18) : width,
    transition: {
      duration: PAGE_DURATION_SECONDS,
      ease: PAGE_EASING,
    },
  }),
};

function useNavigationDirection(locationKey: string): Direction {
  const navigationType = useNavigationType();
  const stackRef = useRef<string[]>([]);
  const stackIndexRef = useRef(0);
  const [direction, setDirection] = useState<Direction>(1);

  useEffect(() => {
    const stack = stackRef.current;

    if (!locationKey) return;

    if (stack.length === 0) {
      stack.push(locationKey);
      stackIndexRef.current = 0;
      setDirection(1);
      return;
    }

    if (navigationType === "PUSH") {
      if (stackIndexRef.current < stack.length - 1) {
        stack.splice(stackIndexRef.current + 1);
      }
      stack.push(locationKey);
      stackIndexRef.current = stack.length - 1;
      setDirection(1);
      return;
    }

    if (navigationType === "REPLACE") {
      stack[stackIndexRef.current] = locationKey;
      setDirection(1);
      return;
    }

    const existingIndex = stack.indexOf(locationKey);
    if (existingIndex !== -1) {
      setDirection(existingIndex < stackIndexRef.current ? -1 : 1);
      stackIndexRef.current = existingIndex;
      return;
    }

    stack.splice(stackIndexRef.current + 1);
    stack.push(locationKey);
    stackIndexRef.current = stack.length - 1;
    setDirection(-1);
  }, [locationKey, navigationType]);

  return direction;
}

const AnimatedRoutes = ({ children }: AnimatedRoutesProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const direction = useNavigationDirection(location.key);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth || 390);

  // Swipe state refs
  const pageRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);
  const isLocked = useRef(false);
  const currentDx = useRef(0);
  const backdropRef = useRef<HTMLDivElement>(null);
  const isAnimatingOut = useRef(false);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth || 390);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const canSwipeBack = useMemo(() => {
    return /^\/cidade\/[^/]+\/.+/.test(location.pathname);
  }, [location.pathname]);

  const routesWithLocation = useMemo(
    () => cloneElement(children, { location }),
    [children, location]
  );

  // --- Swipe back touch handling ---

  const showBackdrop = useCallback(() => {
    if (backdropRef.current) return;
    const wrapper = document.getElementById("animated-routes-wrapper");
    if (!wrapper) return;

    const bd = document.createElement("div");
    bd.className = "swipe-back-backdrop";
    bd.style.cssText = `
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background: var(--background, #fff);
      overflow: hidden;
    `;
    // Fake previous page skeleton
    bd.innerHTML = `
      <div style="transform:scale(0.94);transform-origin:center;width:100%;height:100%;transition:none;">
        <div style="
          padding:14px 20px; padding-top:max(14px, env(safe-area-inset-top));
          display:flex; align-items:center; gap:12px;
          border-bottom:1px solid rgba(128,128,128,0.1);
        ">
          <div style="width:32px;height:32px;border-radius:50%;background:rgba(128,128,128,0.08);"></div>
          <div style="flex:1;">
            <div style="height:11px;width:90px;border-radius:5px;background:rgba(128,128,128,0.08);margin-bottom:6px;"></div>
            <div style="height:8px;width:55px;border-radius:4px;background:rgba(128,128,128,0.06);"></div>
          </div>
        </div>
        <div style="padding:16px 20px; display:flex; flex-direction:column; gap:14px;">
          <div style="height:180px;border-radius:16px;background:rgba(128,128,128,0.05);"></div>
          <div style="display:flex;gap:12px;">
            <div style="height:100px;flex:1;border-radius:14px;background:rgba(128,128,128,0.05);"></div>
            <div style="height:100px;flex:1;border-radius:14px;background:rgba(128,128,128,0.05);"></div>
          </div>
          <div style="height:9px;width:55%;border-radius:4px;background:rgba(128,128,128,0.07);"></div>
          <div style="height:9px;width:35%;border-radius:4px;background:rgba(128,128,128,0.05);"></div>
          <div style="height:120px;border-radius:14px;background:rgba(128,128,128,0.04);margin-top:4px;"></div>
        </div>
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.08);pointer-events:none;transition:none;" data-scrim="1"></div>
      </div>
    `;

    wrapper.insertBefore(bd, wrapper.firstChild);
    backdropRef.current = bd;
  }, []);

  const updateBackdrop = useCallback((dx: number) => {
    if (!backdropRef.current) return;
    const w = window.innerWidth;
    const progress = Math.min(dx / w, 1);

    // Scale previous page 0.94 → 1.0
    const inner = backdropRef.current.firstElementChild as HTMLElement;
    if (inner) {
      const scale = 0.94 + 0.06 * progress;
      inner.style.transform = `scale(${scale})`;
    }

    // Fade scrim
    const scrim = backdropRef.current.querySelector("[data-scrim]") as HTMLElement;
    if (scrim) {
      scrim.style.background = `rgba(0,0,0,${0.08 * (1 - progress)})`;
    }
  }, []);

  const removeBackdrop = useCallback(() => {
    if (backdropRef.current) {
      backdropRef.current.remove();
      backdropRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!canSwipeBack) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isAnimatingOut.current) return;
      const touch = e.touches[0];
      isSwiping.current = true;
      isLocked.current = false;
      currentDx.current = 0;
      startX.current = touch.clientX;
      startY.current = touch.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping.current || isAnimatingOut.current) return;
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

        // Setup visual layers
        showBackdrop();
        const page = pageRef.current;
        if (page) {
          page.style.transition = "none";
          page.style.willChange = "transform";
          page.style.boxShadow = "-6px 0 28px rgba(0,0,0,0.12)";
          page.style.zIndex = "2";
        }
      }

      if (dx > 0) {
        currentDx.current = dx;
        const page = pageRef.current;
        if (page) {
          page.style.transform = `translateX(${dx}px)`;
        }
        updateBackdrop(dx);
      }
    };

    const handleTouchEnd = () => {
      if (!isSwiping.current || !isLocked.current) {
        resetPage();
        return;
      }

      const dx = currentDx.current;

      if (dx >= SWIPE_THRESHOLD) {
        // Animate out then navigate
        isAnimatingOut.current = true;
        const w = window.innerWidth;
        const page = pageRef.current;
        if (page) {
          page.style.transition = "transform 0.22s cubic-bezier(0.15, 0, 0.2, 1)";
          page.style.transform = `translateX(${w}px)`;
        }
        // Finish backdrop animation
        updateBackdrop(w);

        setTimeout(() => {
          removeBackdrop();
          isAnimatingOut.current = false;
          // Reset page style before navigate so AnimatePresence doesn't glitch
          const p = pageRef.current;
          if (p) {
            p.style.transition = "";
            p.style.transform = "";
            p.style.willChange = "";
            p.style.boxShadow = "";
            p.style.zIndex = "";
          }
          navigate(-1);
        }, 230);
      } else {
        // Snap back
        const page = pageRef.current;
        if (page) {
          page.style.transition = "transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease";
          page.style.transform = "translateX(0)";
          page.style.boxShadow = "none";
        }
        // Reset backdrop
        if (backdropRef.current) {
          const inner = backdropRef.current.firstElementChild as HTMLElement;
          if (inner) {
            inner.style.transition = "transform 0.2s ease";
            inner.style.transform = "scale(0.94)";
          }
          const scrim = backdropRef.current.querySelector("[data-scrim]") as HTMLElement;
          if (scrim) {
            scrim.style.transition = "background 0.2s ease";
            scrim.style.background = "rgba(0,0,0,0.08)";
          }
        }
        setTimeout(() => resetPage(), 210);
      }
    };

    const resetPage = () => {
      isSwiping.current = false;
      isLocked.current = false;
      currentDx.current = 0;
      const page = pageRef.current;
      if (page) {
        page.style.transition = "";
        page.style.transform = "";
        page.style.willChange = "";
        page.style.boxShadow = "";
        page.style.zIndex = "";
      }
      removeBackdrop();
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      resetPage();
    };
  }, [canSwipeBack, navigate, showBackdrop, updateBackdrop, removeBackdrop]);

  return (
    <div id="animated-routes-wrapper" className="relative min-h-screen overflow-x-hidden">
      <AnimatePresence initial={false} custom={direction} mode="sync">
        <motion.div
          ref={pageRef}
          key={location.key}
          custom={{ direction, width: viewportWidth }}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="min-h-screen"
          style={{ background: "var(--background, #fff)" }}
        >
          {routesWithLocation}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AnimatedRoutes;
