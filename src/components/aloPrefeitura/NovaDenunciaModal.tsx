import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ShieldCheck, X, Camera, Video, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface NovaDenunciaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cidadeId: string;
  cidadeSlug: string;
}

const NovaDenunciaModal = ({
  open,
  onOpenChange,
  cidadeId,
  cidadeSlug,
}: NovaDenunciaModalProps) => {
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [imagens, setImagens] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitulo("");
    setDescricao("");
    setImagens([]);
    setVideo(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imagens.length > 5) {
      toast.error("Máximo de 5 imagens permitido");
      return;
    }
    setImagens((prev) => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    setImagens((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const acceptedFormats = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];
    if (!acceptedFormats.includes(file.type)) {
      toast.error("Formato inválido. Use MP4, WebM ou MOV.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Vídeo muito grande. Máximo de 50MB.");
      return;
    }

    setVideo(file);
  };

  const removeVideo = () => {
    setVideo(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const mutation = useMutation({
    mutationFn: async () => {
      setUploading(true);

      // Cria a denúncia com status "pendente"
      const { data: denuncia, error: denunciaError } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .insert({
          cidade_id: cidadeId,
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          status: "pendente",
        })
        .select()
        .single();

      if (denunciaError) throw denunciaError;

      // Upload das imagens (obrigatório)
      for (let i = 0; i < imagens.length; i++) {
        const file = imagens[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${denuncia.id}/${Date.now()}_${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("alo-prefeitura")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Erro ao fazer upload:", uploadError);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("alo-prefeitura").getPublicUrl(fileName);

        await supabase.from("rel_cidade_alo_prefeitura_imagens").insert({
          alo_prefeitura_id: denuncia.id,
          imagem_url: publicUrl,
          ordem: i,
        });
      }

      // Upload do vídeo (opcional)
      if (video) {
        const videoExt = video.name.split(".").pop()?.toLowerCase() || "mp4";
        const videoFileName = `${denuncia.id}/video_${Date.now()}.${videoExt}`;

        const { error: videoUploadError } = await supabase.storage
          .from("alo-prefeitura")
          .upload(videoFileName, video);

        if (videoUploadError) {
          console.error("Erro ao fazer upload do vídeo:", videoUploadError);
        } else {
          const {
            data: { publicUrl: videoPublicUrl },
          } = supabase.storage.from("alo-prefeitura").getPublicUrl(videoFileName);

          // Update the denuncia with the video URL
          await supabase
            .from("rel_cidade_alo_prefeitura")
            .update({ video_url: videoPublicUrl })
            .eq("id", denuncia.id);
        }
      }

      return denuncia;
    },
    onSuccess: () => {
      toast.success("Denúncia enviada com sucesso!", {
        description: "Sua denúncia será analisada em breve.",
      });
      queryClient.invalidateQueries({ queryKey: ["alo-prefeitura"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao enviar denúncia:", error);
      toast.error("Erro ao enviar denúncia", {
        description: "Tente novamente mais tarde.",
      });
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Informe um título para a denúncia");
      return;
    }
    if (!descricao.trim()) {
      toast.error("Descreva a denúncia");
      return;
    }
    if (imagens.length === 0) {
      toast.error("Adicione pelo menos uma foto");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Nova Denúncia
          </DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para enviar sua denúncia de forma sigilosa.
          </DialogDescription>
        </DialogHeader>

        {/* Alerta de sigilo */}
        <Alert className="border-primary/30 bg-primary/5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm text-foreground/80">
            <strong className="text-foreground">Sua identidade é sigilosa.</strong>{" "}
            Seu nome e dados pessoais não serão divulgados em nenhuma circunstância.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título da denúncia *</Label>
            <Input
              id="titulo"
              placeholder="Ex: Buraco na Rua das Flores"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição detalhada *</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva o problema com o máximo de detalhes possível: localização exata, há quanto tempo existe, etc."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {descricao.length}/1000
            </p>
          </div>

          {/* Upload de imagens - OBRIGATÓRIO */}
          <div className="space-y-2">
            <Label>Fotos *</Label>
            <div className="flex flex-wrap gap-2">
              {imagens.map((file, index) => (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {imagens.length < 5 && (
                <label className="w-16 h-16 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    multiple
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Adicione pelo menos 1 foto (máx. 5) para ilustrar o problema
            </p>
          </div>

          {/* Upload de vídeo - OPCIONAL */}
          <div className="space-y-2">
            <Label>Vídeo (opcional)</Label>
            {video ? (
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video
                  src={URL.createObjectURL(video)}
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
                onClick={() => videoInputRef.current?.click()}
                className="w-full py-4 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors bg-muted/30"
              >
                <Video className="h-6 w-6" />
                <span className="text-sm font-medium">Adicionar vídeo</span>
                <span className="text-xs">MP4, WebM ou MOV (máx. 50MB)</span>
              </button>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept=".mp4,.webm,.mov,.m4v"
              onChange={handleVideoChange}
              className="hidden"
            />
          </div>

          {/* Status info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              📋 Sua denúncia ficará em <strong>análise</strong> até ser aprovada
              pela moderação. Após aprovada, será publicada anonimamente.
            </p>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={mutation.isPending || uploading}
            >
              {mutation.isPending || uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Denúncia"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NovaDenunciaModal;
