import { CalendarDays, MapPin, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";

interface EventoCardProps {
  id: string;
  cidadeSlug?: string;
  titulo: string;
  imagem_url?: string | null;
  data_evento: string;
  horario?: string | null;
  local_nome?: string | null;
  categoria?: string | null;
}

const EventoCard = ({
  id,
  cidadeSlug,
  titulo,
  imagem_url,
  data_evento,
  horario,
  local_nome,
  categoria,
}: EventoCardProps) => {
  const navigate = useNavigate();
  const startX = useRef(0);
  const startY = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - startX.current);
    const dy = Math.abs(e.clientY - startY.current);
    if (dx < 10 && dy < 10) {
      navigate(`/cidade/${cidadeSlug}/eventos/${id}`);
    }
  };

  const dataObj = new Date(data_evento + "T00:00:00");
  const dia = dataObj.getDate();
  const mes = dataObj.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();

  return (
    <div
      className="min-w-[220px] max-w-[220px] rounded-2xl overflow-hidden bg-card border border-border shadow-sm flex-shrink-0 cursor-pointer active:scale-[0.98] transition-transform touch-pan-x"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div className="relative h-[140px] w-full">
        {imagem_url ? (
          <img src={imagem_url} alt={titulo} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-xl px-2.5 py-1 text-center leading-tight shadow-md">
          <span className="block text-lg font-bold">{dia}</span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider">{mes}</span>
        </div>
        {categoria && (
          <div className="absolute top-2 right-2 bg-accent text-accent-foreground rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase shadow-md">
            {categoria}
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <h3 className="font-semibold text-foreground text-sm line-clamp-2 leading-tight">{titulo}</h3>
        {local_nome && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="text-xs truncate">{local_nome}</span>
          </div>
        )}
        {horario && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="text-xs">{horario}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventoCard;
