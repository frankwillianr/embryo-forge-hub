import { Vaga, tipoContratoLabels, modalidadeLabels } from "@/types/vagas";
import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface VagaCardProps {
  vaga: Vaga;
  onClick?: () => void;
  segmentoLabel?: string;
  SegmentoIcon?: LucideIcon;
}

const VagaCard = ({ vaga, onClick, segmentoLabel, SegmentoIcon }: VagaCardProps) => {
  const Icon = SegmentoIcon || Briefcase;

  return (
    <div
      className="rounded-2xl border border-border/60 bg-card p-4 cursor-pointer transition-all hover:shadow-sm active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-[15px] text-foreground leading-tight">
              {vaga.titulo}
            </h3>
            {vaga.salario && (
              <p className="text-[13px] font-semibold text-primary whitespace-nowrap">
                {vaga.salario}
              </p>
            )}
          </div>

          <p className="text-[13px] text-muted-foreground mt-0.5">{vaga.empresa}</p>

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <Badge variant="secondary" className="text-[11px] font-medium">
              {tipoContratoLabels[vaga.tipo_contrato]}
            </Badge>
            <Badge variant="outline" className="text-[11px] font-medium">
              {modalidadeLabels[vaga.modalidade]}
            </Badge>
            {segmentoLabel && (
              <Badge variant="outline" className="text-[11px] font-medium">
                {segmentoLabel}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VagaCard;
