import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface AdminRouteGuardProps {
  children: ReactNode;
}

const AdminRouteGuard = ({ children }: AdminRouteGuardProps) => {
  const location = useLocation();
  const { user, loading } = useAuth();

  const { data: isAdmin = false, isLoading } = useQuery({
    queryKey: ["is-admin-user", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      const { count, error } = await supabase
        .from("rel_cidade_admin")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (error) return false;
      return (count ?? 0) > 0;
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
  });

  if (loading || (user && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f6]">
        <span className="text-sm text-gray-500">Carregando...</span>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/cidade/governador-valadares" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export default AdminRouteGuard;
