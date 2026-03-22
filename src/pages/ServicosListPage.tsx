import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import BottomNavBar from "@/components/navigation/BottomNavBar";
import ServicosSection from "@/components/servicos/ServicosSection";
import servicosBanner from "@/assets/servicos-banner.jpg";

const ServicosListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useSwipeBack({ onBack: () => navigate(`/cidade/${slug}`) });

  return (
    <div id="swipe-back-page" className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold flex-1">Onde ir & Serviços</h1>
      </header>

      <div className="relative h-52 overflow-hidden border-b border-border">
        <img src={servicosBanner} alt="Onde ir e serviços" className="w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/35 to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(15,165,133,0.38),transparent_45%)]" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3 backdrop-blur-md shadow-lg">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90">
              <Briefcase className="h-3.5 w-3.5" />
              Onde ir & Serviços
            </div>
            <h2 className="mt-2 text-[22px] leading-tight font-black text-white">Onde ir & Serviços</h2>
            <p className="mt-1 text-xs text-white/80">Encontre serviços, empresas e profissionais da cidade.</p>
          </div>
        </div>
      </div>

      <ServicosSection cidadeSlug={slug} showHighlights={false} />

      <BottomNavBar slug={slug} active="servicos" />
    </div>
  );
};

export default ServicosListPage;
