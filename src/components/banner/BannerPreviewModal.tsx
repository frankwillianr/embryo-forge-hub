import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Check, Calendar, Image } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BannerPreviewData {
  titulo: string;
  descricao?: string;
  dias_comprados: number;
  data_inicio: Date;
  data_fim: Date;
  video_youtube_url?: string;
  imagemPrincipalPreview: string;
  imagensGaleriaPreview: string[];
  preco: string;
}

interface BannerPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: BannerPreviewData | null;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function BannerPreviewModal({
  open,
  onOpenChange,
  data,
  onConfirm,
  isSubmitting,
}: BannerPreviewModalProps) {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] p-0 rounded-[10px]">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-lg font-semibold">
            Revise seu anúncio
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-4">
          <div className="space-y-4 pb-4">
            {/* Imagem Principal */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Image className="h-4 w-4" />
                Imagem Principal
              </p>
              <img
                src={data.imagemPrincipalPreview}
                alt="Preview do banner"
                className="w-full h-40 object-cover rounded-xl border"
              />
            </div>

            {/* Título */}
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Título</p>
              <p className="font-semibold text-foreground">{data.titulo}</p>
            </div>

            {/* Descrição */}
            {data.descricao && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Descrição</p>
                <p className="text-sm text-foreground">{data.descricao}</p>
              </div>
            )}

            {/* Galeria */}
            {data.imagensGaleriaPreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Galeria ({data.imagensGaleriaPreview.length} imagens)
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {data.imagensGaleriaPreview.map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt={`Galeria ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border flex-shrink-0"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Vídeo */}
            {data.video_youtube_url && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Vídeo YouTube</p>
                <p className="text-sm text-primary truncate">{data.video_youtube_url}</p>
              </div>
            )}

            {/* Período */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Período de Exibição
              </p>
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-sm">
                  De{" "}
                  <span className="font-semibold">
                    {format(data.data_inicio, "dd/MM/yyyy", { locale: ptBR })}
                  </span>{" "}
                  até{" "}
                  <span className="font-semibold">
                    {format(data.data_fim, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.dias_comprados} dias de exibição
                </p>
              </div>
            </div>

            {/* Valor Total */}
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Valor Total:</span>
                <span className="text-2xl font-bold text-primary">{data.preco}</span>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="p-4 pt-0 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar e Editar
          </Button>
          <Button
            variant="dark"
            className="flex-1 h-12 rounded-xl"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              "Publicando..."
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Publicar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
