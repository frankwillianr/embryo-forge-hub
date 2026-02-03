import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BannerCarousel from "@/components/BannerCarousel";
import JornalHorizontalList from "@/components/jornal/JornalHorizontalList";
import type { Banner } from "@/types/banner";

interface HomeSectionProps {
  cidadeSlug?: string;
}

const HomeSection = ({ cidadeSlug }: HomeSectionProps) => {
  // Busca banners ativos para a data de hoje e cidade específica
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["banners-hoje", cidadeSlug],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];

      // Primeiro busca a cidade pelo slug
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return [];

      // Busca banners vinculados à cidade
      const { data: relData, error: relError } = await supabase
        .from("rel_cidade_banner")
        .select("banner_id")
        .eq("cidade_id", cidadeData.id);

      if (relError) throw relError;
      if (!relData || relData.length === 0) return [];

      const bannerIdsDaCidade = relData.map((r) => r.banner_id);

      // Busca IDs de banners que tem exibição agendada para hoje
      const { data: diasData, error: diasError } = await supabase
        .from("rel_banner_dias")
        .select("banner_id")
        .eq("data_exibicao", hoje)
        .eq("utilizado", false)
        .in("banner_id", bannerIdsDaCidade);

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

      // Shuffle array (ordem aleatória)
      const shuffled = [...(bannersData || [])].sort(() => Math.random() - 0.5);

      return shuffled as Banner[];
    },
    enabled: !!cidadeSlug,
  });

  return (
    <div>
      {/* Carrossel de Anúncios */}
      {isLoading ? (
        <div className="aspect-[16/9] w-full bg-muted animate-pulse" />
      ) : banners.length > 0 ? (
        <BannerCarousel banners={banners} cidadeSlug={cidadeSlug} />
      ) : (
        <div className="aspect-[16/9] w-full bg-muted flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Nenhum anúncio hoje</p>
        </div>
      )}

      {/* Jornal da Cidade */}
      <JornalHorizontalList cidadeSlug={cidadeSlug} />
    </div>
  );
};

export default HomeSection;
