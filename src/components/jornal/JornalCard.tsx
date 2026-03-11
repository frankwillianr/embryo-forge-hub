import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Loader2, Play, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { audioManager } from "@/lib/audioManager";
import { type Jornal, parseImagens } from "@/types/jornal";

interface JornalCardProps {
  jornal: Jornal;
  cidadeSlug?: string;
}

const JornalCard = ({ jornal, cidadeSlug }: JornalCardProps) => {
  const navigate = useNavigate();
  const primeiraImagem = parseImagens(jornal.imagens)[0];
  const cachedAudioUrl = useRef<string | null>(jornal.audio_url || null);
  const [isRead, setIsRead] = useState(() => {
    const read = JSON.parse(localStorage.getItem("jornal-lidos") || "[]");
    return read.includes(jornal.id);
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  useEffect(() => {
    const unsubscribe = audioManager.addListener((isPlaying, audioId) => {
      if (!isPlaying || audioId !== jornal.id) {
        setIsSpeaking(false);
      } else if (audioId === jornal.id) {
        setIsSpeaking(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [jornal.id]);

  const handleClick = () => {
    if (!isRead) {
      const read = JSON.parse(localStorage.getItem("jornal-lidos") || "[]");
      read.push(jornal.id);
      localStorage.setItem("jornal-lidos", JSON.stringify(read));
      setIsRead(true);
    }
    navigate(`/cidade/${cidadeSlug}/jornal#${jornal.id}`, { state: { fromJornalCard: true } });
  };

  const handleSpeakClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isSpeaking) {
      audioManager.stopAll();
      return;
    }

    if (isLoadingAudio) return;

    try {
      let audioUrl = cachedAudioUrl.current;

      if (!audioUrl) {
        setIsLoadingAudio(true);
        const res = await fetch(
          "https://umauozcntfxgphzbiifz.supabase.co/functions/v1/generate-jornal-audio",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization":
                "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g",
            },
            body: JSON.stringify({ jornalId: jornal.id }),
          }
        );
        const result = await res.json();
        if (result.audioUrl) {
          audioUrl = result.audioUrl;
          cachedAudioUrl.current = audioUrl;
        }
        setIsLoadingAudio(false);
      }

      if (audioUrl) {
        await audioManager.playAudio(audioUrl, jornal.id);
      } else {
        toast.error("Não foi possível gerar o áudio");
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      toast.error("Erro ao reproduzir áudio");
      setIsSpeaking(false);
      setIsLoadingAudio(false);
    }
  };

  const dataExibicao = jornal.data_noticia
    ? new Date(`${jornal.data_noticia}T00:00:00`)
    : new Date(jornal.created_at);

  return (
    <div onClick={handleClick} className="flex-shrink-0 w-64 cursor-pointer group">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted/50">
        {primeiraImagem ? (
          <img
            src={primeiraImagem}
            alt={jornal.titulo}
            className="w-full h-full object-cover kenburns-img"
          />
        ) : jornal.video_url ? (
          <div className="w-full h-full flex items-center justify-center bg-muted/30">
            <div className="w-12 h-12 rounded-full bg-foreground/10 flex items-center justify-center">
              <Play className="h-5 w-5 text-foreground/60 ml-0.5" />
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted/30 to-muted/60" />
        )}
      </div>

      <div className="pt-2.5 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
            {format(dataExibicao, "dd MMM", { locale: ptBR })}
          </span>
          <div className="flex items-center gap-1 ml-auto">
            {jornal.categoria && (
              <span className="text-[8px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                {jornal.categoria}
              </span>
            )}
            {isRead ? (
              <span className="text-[8px] bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5 rounded-full">
                lida
              </span>
            ) : (
              <span className="text-[8px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
                não lida
              </span>
            )}
          </div>
        </div>
        <h3 className="font-medium text-foreground line-clamp-3 text-[13px] leading-tight tracking-tight">
          {jornal.titulo}
        </h3>
        <button
          onClick={handleSpeakClick}
          disabled={isLoadingAudio}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-medium hover:bg-primary/15 transition-colors disabled:opacity-50"
          title={isSpeaking ? "Parar narração" : "Ouvir notícia"}
        >
          {isLoadingAudio ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Gerando...
            </>
          ) : isSpeaking ? (
            <>
              <VolumeX className="h-3.5 w-3.5" />
              Pausar
            </>
          ) : (
            <>
              <Volume2 className="h-3.5 w-3.5" />
              Ouvir notícia
            </>
          )}
        </button>
        {(jornal.descricao_curta || jornal.descricao) && (
          <p className="text-[11px] text-muted-foreground/70 line-clamp-3 leading-snug mt-0.5">
            {jornal.descricao_curta || jornal.descricao}
          </p>
        )}
      </div>
    </div>
  );
};

export default JornalCard;
