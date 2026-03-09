import { useRef, useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  bucket?: string;
  folder?: string;
}

const ImageUpload = ({
  images,
  onChange,
  maxImages = 5,
  bucket = "desapega",
  folder = "anuncios",
}: ImageUploadProps) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    if (filesToUpload.length === 0) {
      toast({
        title: "Limite atingido",
        description: `Máximo de ${maxImages} fotos permitidas.`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        // Validar tipo
        if (!file.type.startsWith("image/")) {
          toast({
            title: "Arquivo inválido",
            description: "Apenas imagens são permitidas.",
            variant: "destructive",
          });
          continue;
        }

        // Validar tamanho (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "Arquivo muito grande",
            description: "Máximo de 5MB por imagem.",
            variant: "destructive",
          });
          continue;
        }

        // Gerar nome único
        const fileExt = file.name.split(".").pop();
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast({
            title: "Erro no upload",
            description: uploadError.message,
            variant: "destructive",
          });
          continue;
        }

        // Obter URL pública
        const { data: publicData } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        uploadedUrls.push(publicData.publicUrl);
      }

      if (uploadedUrls.length > 0) {
        onChange([...images, ...uploadedUrls]);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível fazer o upload das imagens.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const removeImage = (index: number) => {
    try {
      const removedUrl = images[index];
      const nextImages = images.filter((_, i) => i !== index);
      onChange(nextImages);
      console.info("[ImageUpload] Removido com sucesso", {
        status: "success",
        index,
        url: removedUrl,
      });
      toast({
        title: "Foto removida",
        description: "Removido com sucesso.",
      });
    } catch (error) {
      console.error("[ImageUpload] Erro ao remover foto", {
        status: "error",
        index,
        error,
      });
      toast({
        title: "Erro ao remover foto",
        description: "NÃ£o foi possÃ­vel remover a imagem.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {images.map((url, index) => (
          <div
            key={index}
            className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-muted"
          >
            <img
              src={url}
              alt={`Foto ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <Camera className="h-6 w-6" />
                <span className="text-xs">Adicionar</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <p className="text-xs text-muted-foreground">
        Adicione até {maxImages} fotos (máx. 5MB cada)
      </p>
    </div>
  );
};

export default ImageUpload;
