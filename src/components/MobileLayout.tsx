import { Outlet } from "react-router-dom";

const MobileLayout = () => {
  return (
    <div className="max-w-[1200px] mx-auto min-h-screen">
      <Outlet />
    </div>
  );
};

export default MobileLayout;
