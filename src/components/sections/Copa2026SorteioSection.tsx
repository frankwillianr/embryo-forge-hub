import { ChevronRight, Gift, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import CopaCountdown from "@/components/CopaCountdown";
import camisaBrasil from "@/assets/copa-2026-camisa.jpg";

interface Copa2026SorteioSectionProps {
  cidadeSlug?: string;
}

const Copa2026SorteioSection = ({ cidadeSlug }: Copa2026SorteioSectionProps) => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const sorteioPath = `/cidade/${cidadeSlug || "gv"}/copa-2026-sorteio`;

  const handleParticipar = () => {
    if (!cidadeSlug) return;
    if (!user) {
      navigate(`/cidade/${cidadeSlug}/auth?redirect=${encodeURIComponent(sorteioPath)}`);
      return;
    }
    navigate(sorteioPath);
  };

  return (
    <section className="px-5 py-4">
      <div className="overflow-hidden rounded-[18px] border border-emerald-500/20 bg-[#082f24] text-white shadow-sm">
        <div className="grid grid-cols-[1fr_122px] min-h-[164px]">
          <div className="flex min-w-0 flex-col justify-between gap-3 p-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-yellow-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-normal text-emerald-950">
                <Trophy className="h-3 w-3" />
                Sorteio GV City
              </div>
              <h2 className="text-lg font-extrabold leading-tight">
                Camisa original da Seleção Brasileira 2026
              </h2>
              <p className="mt-1.5 text-xs leading-snug text-white/80">
                Sorteio dia 09/06, às 15h. O comprovante será verificado antes. Assista à Copa do Mundo com estilo,
                garantido pelo GV City.
              </p>
              <div className="mt-2">
                <CopaCountdown compact />
              </div>
            </div>
            <Button
              type="button"
              onClick={handleParticipar}
              disabled={loading || !cidadeSlug}
              className="h-10 w-fit gap-2 rounded-xl bg-yellow-300 px-4 text-emerald-950 hover:bg-yellow-200"
            >
              <Gift className="h-4 w-4" />
              Participar
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative min-h-full overflow-hidden">
            <img
              src={camisaBrasil}
              alt="Camisa do Brasil sorteada"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#082f24] via-transparent to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Copa2026SorteioSection;
