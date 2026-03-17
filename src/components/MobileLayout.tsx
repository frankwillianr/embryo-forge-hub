import { Outlet, useLocation } from "react-router-dom";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { useRef } from "react";

const MobileLayout = () => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Only enable swipe-back on sub-pages (not the main cidade page)
  const isSubPage = /^\/cidade\/[^/]+\/.+/.test(location.pathname);
  
  useSwipeBack(isSubPage ? { containerRef } : { threshold: Infinity, containerRef });

  return (
    <div ref={containerRef} className="max-w-[1200px] mx-auto min-h-screen bg-background">
      <Outlet />
    </div>
  );
};

export default MobileLayout;
