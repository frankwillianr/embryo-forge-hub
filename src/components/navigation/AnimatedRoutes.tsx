import { PointerEvent as ReactPointerEvent, ReactElement, cloneElement, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, PanInfo, motion, useDragControls } from "framer-motion";
import { Location, useLocation, useNavigate, useNavigationType } from "react-router-dom";

type Direction = 1 | -1;

interface AnimatedRoutesProps {
  children: ReactElement<{ location?: Location }>;
}

const EDGE_START_PX = 28;
const SWIPE_BACK_THRESHOLD_RATIO = 0.3;
const PAGE_EASING = [0.22, 0.61, 0.36, 1] as const;
const PAGE_DURATION_SECONDS = 0.3;

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

    if (!locationKey) {
      return;
    }

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
  const dragControls = useDragControls();
  const direction = useNavigationDirection(location.key);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth || 390);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth || 390);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const canSwipeBack = useMemo(() => {
    const isCidadeSubpage = /^\/cidade\/[^/]+\/.+/.test(location.pathname);
    if (!isCidadeSubpage) return false;
    return window.history.length > 1;
  }, [location.pathname]);

  const routesWithLocation = useMemo(
    () => cloneElement(children, { location }),
    [children, location]
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canSwipeBack) return;
    if (event.pointerType === "mouse") return;
    if (event.clientX > EDGE_START_PX) return;
    dragControls.start(event);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!canSwipeBack) return;

    const deltaX = Math.max(info.offset.x, 0);
    const threshold = window.innerWidth * SWIPE_BACK_THRESHOLD_RATIO;
    if (deltaX >= threshold) {
      navigate(-1);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <AnimatePresence initial={false} custom={direction} mode="sync">
        <motion.div
          key={location.key}
          custom={{ direction, width: viewportWidth }}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          drag={canSwipeBack ? "x" : false}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ left: 0, right: viewportWidth }}
          dragElastic={0.03}
          dragMomentum={false}
          dragSnapToOrigin
          onPointerDown={handlePointerDown}
          onDragEnd={handleDragEnd}
          transformTemplate={(_, generatedTransform) => {
            const hasTranslate = /translate[XY]\(/.test(generatedTransform);
            const isAtOrigin = /translateX\(0(px)?\)/.test(generatedTransform);
            if (!hasTranslate || isAtOrigin) {
              return "none";
            }
            return generatedTransform;
          }}
          className="min-h-screen"
        >
          {routesWithLocation}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AnimatedRoutes;
