import { useState } from "react";
import { Briefcase, Bus, MapPin, Lightbulb } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuickAccessCardsProps {
  cidadeSlug?: string;
  onMapClick?: () => void;
}

const cards = [
  {
    id: "mapa",
    title: "Mapa",
    subtitle: "Explorar cidade",
    icon: MapPin,
    gradient: "from-sky-600 to-cyan-500",
    bgPattern: "bg-gradient-to-br",
  },
  {
    id: "vagas",
    title: "Vagas de Emprego",
    subtitle: "Encontre oportunidades",
    icon: Briefcase,
    gradient: "from-orange-500 to-amber-400",
    bgPattern: "bg-gradient-to-br",
  },
  {
    id: "onibus",
    title: "Horario de Onibus",
    subtitle: "Confira os horarios",
    icon: Bus,
    gradient: "from-blue-500 to-cyan-400",
    bgPattern: "bg-gradient-to-br",
  },
];

const QuickAccessCards = ({ cidadeSlug, onMapClick }: QuickAccessCardsProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sugestao, setSugestao] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = (id: string) => {
    if (id === "mapa") {
      goCityMap();
    } else if (id === "vagas") {
      navigate(`/cidade/${cidadeSlug}/vagas`);
    } else if (id === "onibus") {
      navigate(`/cidade/${cidadeSlug}/onibus`);
    }
  };

  const goCityMap = () => {
    if (onMapClick) {
      onMapClick();
      return;
    }
    if (!cidadeSlug) return;
    navigate(`/cidade/${cidadeSlug}?tab=maps`);
  };

  const handleEnviarSugestao = async () => {
    const texto = sugestao.trim();
    if (!texto) return;

    if (!user) {
      const redirect = encodeURIComponent(`/cidade/${cidadeSlug}`);
      navigate(`/cidade/${cidadeSlug}/auth?redirect=${redirect}`);
      return;
    }

    try {
      setIsSubmitting(true);

      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData?.id) {
        toast.error("Nao foi possivel identificar a cidade para enviar a sugestao.");
        return;
      }

      const { error } = await supabase.from("rel_cidade_dica_sugestao").insert({
        cidade_id: cidadeData.id,
        user_id: user.id,
        mensagem: texto,
        status: "nova",
      });

      if (error) throw error;

      setSugestao("");
      setConfirmOpen(true);
    } catch (error) {
      console.error("[QuickAccessCards] erro ao enviar sugestao", error);
      const message = error instanceof Error ? error.message : "Erro inesperado";
      toast.error(`Erro ao enviar sugestao: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="px-4 py-4">
      <div className="grid grid-cols-3 gap-2">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleClick(card.id)}
            className={`aspect-square rounded-2xl ${card.bgPattern} ${card.gradient} p-2.5 flex flex-col justify-between text-white shadow-lg hover:shadow-xl transition-all active:scale-95 relative overflow-hidden`}
          >
            <div className="absolute -right-3 -bottom-3 opacity-20">
              <card.icon className="w-14 h-14" strokeWidth={1} />
            </div>

            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <card.icon className="w-4 h-4 text-white" />
            </div>

            <div className="text-left relative z-10">
              <h3 className="text-[10px] font-bold leading-tight">{card.title}</h3>
              <p className="text-[8px] opacity-80 mt-0.5 line-clamp-1">{card.subtitle}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5 mb-3 flex items-center justify-center">
        <div className="flex w-20 flex-col gap-2">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">Enviar dica e sugestão</h3>
            <p className="text-[11px] text-muted-foreground">Sua opinião ajuda a melhorar o app.</p>
          </div>
        </div>

        <Textarea
          value={sugestao}
          onChange={(e) => setSugestao(e.target.value)}
          placeholder="Digite sua dica ou sugestão..."
          className="min-h-[96px] text-sm resize-none"
          maxLength={600}
        />

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{sugestao.length}/600</span>
          <Button size="sm" onClick={handleEnviarSugestao} disabled={!sugestao.trim() || isSubmitting}>
            {isSubmitting ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-[calc(100%-20px)] max-w-sm">
          <DialogHeader>
            <DialogTitle>Dica enviada</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Obrigado! Recebemos sua sugestão.
          </p>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setConfirmOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default QuickAccessCards;
