import { Vaga, tipoContratoLabels, modalidadeLabels } from "@/types/vagas";
import { Briefcase, Building2, Laptop, MapPin, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface VagaCardProps {
  vaga: Vaga;
  onClick?: () => void;
  segmentoLabel?: string;
  SegmentoIcon?: LucideIcon;
}

const VagaCard = ({ vaga, onClick, segmentoLabel, SegmentoIcon }: VagaCardProps) => {
  const Icon = SegmentoIcon || Briefcase;
  const descricaoTruncada =
    vaga.descricao.length > 650 ? `${vaga.descricao.slice(0, 650).trimEnd()}...` : vaga.descricao;
  const ModalidadeIcon = vaga.modalidade === "remoto" ? Laptop : vaga.modalidade === "hibrido" ? Workflow : MapPin;

  return (
    <div
      className="rounded-2xl border border-border/60 bg-card p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/25 active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 ring-1 ring-primary/15">
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-[15px] text-foreground leading-tight">
              {vaga.titulo}
            </h3>
            {vaga.salario && (
              <p className="text-[13px] font-semibold text-emerald-600 whitespace-nowrap">
                {vaga.salario}
              </p>
            )}
          </div>

          <p className="text-[13px] text-muted-foreground mt-1 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span>{vaga.empresa}</span>
          </p>

          <p className="text-[12px] leading-relaxed text-muted-foreground/90 mt-2 whitespace-pre-line break-words line-clamp-5">
            {descricaoTruncada}
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground/90">
              <Briefcase className="h-3.5 w-3.5 text-primary/80" />
              {tipoContratoLabels[vaga.tipo_contrato]}
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground/90">
              <ModalidadeIcon className="h-3.5 w-3.5 text-primary/80" />
              {modalidadeLabels[vaga.modalidade]}
            </span>

            {segmentoLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                <Icon className="h-3.5 w-3.5" />
                {segmentoLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VagaCard;
