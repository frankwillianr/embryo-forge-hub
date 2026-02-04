import { Briefcase, MapPin, Clock, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Vaga, tipoContratoLabels, modalidadeLabels } from "@/types/vagas";

interface VagaCardProps {
  vaga: Vaga;
  onClick?: () => void;
}

const VagaCard = ({ vaga, onClick }: VagaCardProps) => {
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground line-clamp-1">{vaga.titulo}</h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <Building2 className="w-3.5 h-3.5" />
              <span className="line-clamp-1">{vaga.empresa}</span>
            </div>
            
            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="secondary" className="text-xs">
                {tipoContratoLabels[vaga.tipo_contrato]}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <MapPin className="w-3 h-3 mr-1" />
                {modalidadeLabels[vaga.modalidade]}
              </Badge>
            </div>
            
            {/* Salary if available */}
            {vaga.salario && (
              <p className="text-sm font-medium text-primary mt-2">
                {vaga.salario}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VagaCard;
