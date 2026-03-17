import { Outlet, useLocation } from "react-router-dom";
import { useSwipeBack } from "@/hooks/useSwipeBack";

const MobileLayout = () => {
  const location = useLocation();
  
  // Only enable swipe-back on sub-pages (not the main cidade page)
  const isSubPage = /^\/cidade\/[^/]+\/.+/.test(location.pathname);
  
  useSwipeBack(isSubPage ? {} : { threshold: Infinity });

  return (
    <div className="max-w-[1200px] mx-auto min-h-screen">
      <Outlet />
    </div>
  );
};

export default MobileLayout;
