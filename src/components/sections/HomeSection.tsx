import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BannerCarousel from "@/components/BannerCarousel";
import type { Banner } from "@/types/banner";

const HomeSection = () => {
  // Busca banners ativos para a data de hoje
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["banners-hoje"],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];

      // Busca IDs de banners que tem exibição agendada para hoje
      const { data: diasData, error: diasError } = await supabase
        .from("rel_banner_dias")
        .select("banner_id")
        .eq("data_exibicao", hoje)
        .eq("utilizado", false);

      if (diasError) throw diasError;

      if (!diasData || diasData.length === 0) return [];

      const bannerIds = diasData.map((d) => d.banner_id);

      // Busca os banners ativos
      const { data: bannersData, error: bannersError } = await supabase
        .from("banner")
        .select("*")
        .in("id", bannerIds)
        .eq("ativo", true);

      if (bannersError) throw bannersError;

      return (bannersData as Banner[]) || [];
    },
  });

  return (
    <div className="space-y-4">
      {/* Carrossel de Anúncios */}
      {isLoading ? (
        <div className="aspect-[16/9] w-full bg-muted animate-pulse" />
      ) : banners.length > 0 ? (
        <BannerCarousel banners={banners} />
      ) : (
        <div className="aspect-[16/9] w-full bg-muted flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Nenhum anúncio hoje</p>
        </div>
      )}

      {/* Conteúdo adicional da Home */}
      <div className="p-4">
        <p className="text-muted-foreground">Conteúdo da cidade virá aqui</p>
      </div>
    </div>
  );
};

export default HomeSection;
