import { Vaga, tipoContratoLabels, modalidadeLabels } from "@/types/vagas";

interface VagaCardProps {
  vaga: Vaga;
  onClick?: () => void;
}

const VagaCard = ({ vaga, onClick }: VagaCardProps) => {
  return (
    <div 
      className="py-4 border-b border-border/40 last:border-0 cursor-pointer active:opacity-70 transition-opacity"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[15px] text-foreground leading-tight">
            {vaga.titulo}
          </h3>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {vaga.empresa}
          </p>
          <p className="text-[12px] text-muted-foreground/70 mt-1.5">
            {tipoContratoLabels[vaga.tipo_contrato]} · {modalidadeLabels[vaga.modalidade]}
          </p>
        </div>
        
        {vaga.salario && (
          <p className="text-[13px] font-medium text-primary whitespace-nowrap">
            {vaga.salario}
          </p>
        )}
      </div>
    </div>
  );
};

export default VagaCard;
