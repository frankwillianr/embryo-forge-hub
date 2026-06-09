import AdminSidebar from "./AdminSidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState } from "react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <AdminSidebar
        isCollapsed={isSidebarCollapsed}
        onCollapsedChange={setIsSidebarCollapsed}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="fixed z-50 lg:hidden bg-white"
        style={{
          top: "calc(max(env(safe-area-inset-top, 0px), var(--ion-safe-area-top, 0px)) + 5rem)",
          right: "calc(max(env(safe-area-inset-right, 0px), var(--ion-safe-area-right, 0px)) + 1rem)",
        }}
        onClick={() => window.dispatchEvent(new Event("admin:toggle-sidebar"))}
        aria-label="Abrir menu admin"
      >
        <Menu className="h-4 w-4" />
      </Button>
      
      {/* Main Content */}
      <main className={isSidebarCollapsed ? "min-h-screen lg:ml-20" : "min-h-screen lg:ml-64"}>
        <div className="p-6 pt-20 lg:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
