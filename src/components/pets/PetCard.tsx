import { MapPin, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Pet } from "@/types/pets";

interface PetCardProps {
  pet: Pet;
  onClick: () => void;
}

const especieLabels: Record<string, string> = {
  cachorro: "🐕 Cachorro",
  gato: "🐱 Gato",
  passaro: "🐦 Pássaro",
  outro: "🐾 Outro",
};

const PetCard = ({ pet, onClick }: PetCardProps) => {
  const dataOcorrencia = new Date(pet.data_ocorrencia);
  const dataFormatada = dataOcorrencia.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return (
    <div
      onClick={onClick}
      className="flex gap-3 p-3 bg-card rounded-xl border border-border/50 cursor-pointer hover:border-primary/30 transition-colors"
    >
      {/* Foto */}
      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted/30 flex-shrink-0">
        {pet.foto_url ? (
          <img
            src={pet.foto_url}
            alt={pet.nome}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            {pet.especie === "cachorro" ? "🐕" : pet.especie === "gato" ? "🐱" : "🐾"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-foreground truncate">{pet.nome}</h3>
          <Badge
            variant={pet.status === "perdido" ? "destructive" : "default"}
            className="text-[10px] flex-shrink-0"
          >
            {pet.status === "perdido" ? "Perdido" : "Encontrado"}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground mb-2">
          {especieLabels[pet.especie]} · {pet.cor}
          {pet.raca && ` · ${pet.raca}`}
        </p>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {pet.local_visto}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {dataFormatada}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PetCard;
