import { useRef, useState } from "react";
import { Video, X, Loader2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VideoUploadProps {
  videoUrl: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  maxSizeMB?: number;
}

const VideoUpload = ({
  videoUrl,
  onChange,
  bucket = "banner-videos",
  folder = "uploads",
  maxSizeMB = 50,
}: VideoUploadProps) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const acceptedFormats = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!acceptedFormats.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Apenas MP4, WebM e MOV são permitidos.",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      toast({
        title: "Arquivo muito grande",
        description: `Máximo de ${maxSizeMB}MB permitido.`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Gerar nome único
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload com progresso simulado
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      clearInterval(progressInterval);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast({
          title: "Erro no upload",
          description: uploadError.message,
          variant: "destructive",
        });
        return;
      }

      setProgress(100);

      // Obter URL pública
      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onChange(publicData.publicUrl);

      toast({
        title: "Vídeo enviado",
        description: "Upload concluído com sucesso!",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível fazer o upload do vídeo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const removeVideo = async () => {
    if (!videoUrl) return;

    try {
      const path = videoUrl.split(`${bucket}/`)[1];
      if (path) {
        await supabase.storage.from(bucket).remove([path]);
      }
    } catch (error) {
      console.error("Error deleting video:", error);
    }

    onChange(null);
  };

  return (
    <div className="space-y-2">
      {videoUrl ? (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video
            src={videoUrl}
            className="w-full aspect-video object-contain"
            controls
            preload="metadata"
          />
          <button
            type="button"
            onClick={removeVideo}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full aspect-video rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50 bg-muted/30"
        >
          {uploading ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin" />
              <span className="text-sm font-medium">{progress}%</span>
              <span className="text-xs">Enviando vídeo...</span>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Video className="h-8 w-8" />
              </div>
              <span className="text-sm font-medium">Adicionar vídeo</span>
              <span className="text-xs">MP4, WebM ou MOV (máx. {maxSizeMB}MB)</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default VideoUpload;
