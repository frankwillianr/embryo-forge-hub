import { Outlet } from "react-router-dom";

const MobileLayout = () => (
  <div className="max-w-[500px] mx-auto min-h-screen">
    <Outlet />
  </div>
);

export default MobileLayout;
