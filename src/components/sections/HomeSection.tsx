import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BannerCarousel from "@/components/BannerCarousel";
import JornalHorizontalList from "@/components/jornal/JornalHorizontalList";
import AloPrefeituraHorizontalList from "@/components/aloPrefeitura/AloPrefeituraHorizontalList";
import ServicosSection from "@/components/servicos/ServicosSection";
import OfertasSection from "@/components/ofertas/OfertasSection";
import QuickAccessCards from "@/components/sections/QuickAccessCards";
import EventosSection from "@/components/eventos/EventosSection";
import CinemaHorizontalList from "@/components/cinema/CinemaHorizontalList";
import OnibusHorizontalList from "@/components/onibus/OnibusHorizontalList";
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
    <div className="pb-4">
      {/* Carrossel de Anúncios */}
      {isLoading ? (
        <div className="aspect-[16/9] w-full bg-muted animate-pulse m-5 rounded-[20px]" />
      ) : banners.length > 0 ? (
        <BannerCarousel banners={banners} cidadeSlug={cidadeSlug} />
      ) : (
        <div className="aspect-[16/9] w-full bg-muted flex items-center justify-center mx-5 rounded-[20px]">
          <p className="text-muted-foreground text-sm">Nenhum anúncio hoje</p>
        </div>
      )}

      {/* Jornal da Cidade */}
      <JornalHorizontalList cidadeSlug={cidadeSlug} />

      {/* Separador Linha Dupla */}
      <div className="flex items-center justify-center my-10">
        <div className="flex flex-col gap-2 w-20">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>
      </div>

      {/* Serviços */}
      <ServicosSection cidadeSlug={cidadeSlug} />

      {/* Separador Linha Dupla */}
      <div className="flex items-center justify-center my-10">
        <div className="flex flex-col gap-2 w-20">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>
      </div>

      {/* Ofertas da Cidade */}
      <OfertasSection cidadeSlug={cidadeSlug} />

      {/* Separador Linha Dupla */}
      <div className="flex items-center justify-center my-10">
        <div className="flex flex-col gap-2 w-20">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>
      </div>

      {/* Alô Prefeitura */}
      <AloPrefeituraHorizontalList cidadeSlug={cidadeSlug} />

      {/* Separador Linha Dupla */}
      <div className="flex items-center justify-center my-10">
        <div className="flex flex-col gap-2 w-20">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>
      </div>

      {/* Quick Access Cards */}
      <QuickAccessCards cidadeSlug={cidadeSlug} />

      {/* Separador Linha Dupla */}
      <div className="flex items-center justify-center my-10">
        <div className="flex flex-col gap-2 w-20">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>
      </div>

      {/* Cinema */}
      <CinemaHorizontalList cidadeSlug={cidadeSlug} />

      {/* Separador Linha Dupla */}
      <div className="flex items-center justify-center my-10">
        <div className="flex flex-col gap-2 w-20">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>
      </div>

      {/* Shows e Eventos */}
      <EventosSection cidadeSlug={cidadeSlug} />

    </div>
  );
};

export default HomeSection;
