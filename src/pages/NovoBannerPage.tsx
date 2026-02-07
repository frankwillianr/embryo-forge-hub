import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Megaphone, Image, Video, Plus, X, Youtube, Upload, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const bannerSchema = z.object({
  titulo: z.string().min(3, "Título deve ter pelo menos 3 caracteres").max(100, "Título muito longo"),
  descricao: z.string().max(1000, "Descrição muito longa").optional(),
  dias_comprados: z.number().min(1, "Mínimo de 1 dia").max(365, "Máximo de 365 dias"),
  video_youtube_url: z.string().url("URL inválida").optional().or(z.literal("")),
});

type BannerFormData = z.infer<typeof bannerSchema>;

const diasOptions = [
  { value: 7, label: "7 dias", price: "R$ 49,90" },
  { value: 15, label: "15 dias", price: "R$ 89,90" },
  { value: 30, label: "30 dias", price: "R$ 149,90" },
  { value: 60, label: "60 dias", price: "R$ 249,90" },
  { value: 90, label: "90 dias", price: "R$ 329,90" },
];

const NovoBannerPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [imagemPrincipal, setImagemPrincipal] = useState<File | null>(null);
  const [imagemPrincipalPreview, setImagemPrincipalPreview] = useState<string | null>(null);
  const [imagensGaleria, setImagensGaleria] = useState<File[]>([]);
  const [imagensGaleriaPreview, setImagensGaleriaPreview] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoType, setVideoType] = useState<"youtube" | "upload">("youtube");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/cidade/${slug}/auth?redirect=/cidade/${slug}/banner/novo`);
    }
  }, [user, authLoading, navigate, slug]);

  const form = useForm<BannerFormData>({
    resolver: zodResolver(bannerSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      dias_comprados: 7,
      video_youtube_url: "",
    },
  });

  const handleImagemPrincipalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Imagem muito grande. Máximo 5MB.");
        return;
      }
      setImagemPrincipal(file);
      setImagemPrincipalPreview(URL.createObjectURL(file));
    }
  };

  const handleGaleriaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} é muito grande. Máximo 5MB.`);
        return false;
      }
      return true;
    });

    if (imagensGaleria.length + validFiles.length > 5) {
      toast.error("Máximo de 5 imagens na galeria.");
      return;
    }

    setImagensGaleria([...imagensGaleria, ...validFiles]);
    setImagensGaleriaPreview([
      ...imagensGaleriaPreview,
      ...validFiles.map(file => URL.createObjectURL(file)),
    ]);
  };

  const removeGaleriaImage = (index: number) => {
    setImagensGaleria(imagensGaleria.filter((_, i) => i !== index));
    setImagensGaleriaPreview(imagensGaleriaPreview.filter((_, i) => i !== index));
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error("Vídeo muito grande. Máximo 50MB.");
        return;
      }
      setVideoFile(file);
    }
  };

  const onSubmit = async (data: BannerFormData) => {
    if (!imagemPrincipal) {
      toast.error("Selecione uma imagem principal para o banner.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Aqui seria feito o upload e salvamento no banco
      // Por enquanto, apenas simulamos o sucesso
      console.log("Banner data:", {
        ...data,
        imagemPrincipal,
        imagensGaleria,
        videoFile: videoType === "upload" ? videoFile : null,
      });

      toast.success("Solicitação de banner enviada com sucesso! Aguarde aprovação.");
      navigate(`/cidade/${slug}/anunciar`);
    } catch (error) {
      toast.error("Erro ao enviar solicitação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDias = diasOptions.find(d => d.value === form.watch("dias_comprados"));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pt-safe">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(`/cidade/${slug}`)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Anunciar Banner</h1>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative h-28 bg-[#331D4A] flex items-center justify-center">
        <div className="text-center text-white">
          <Megaphone className="h-8 w-8 mx-auto mb-1" />
          <h2 className="text-lg font-bold">Destaque seu negócio</h2>
          <p className="text-sm opacity-90">Apareça no banner principal da cidade</p>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6">
          {/* Imagem Principal */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <Image className="h-5 w-5" />
              Imagem Principal *
            </Label>
            <p className="text-sm text-muted-foreground">
              Esta será a imagem exibida no carrossel de banners. Recomendado: 1200x600px
            </p>
            
            {imagemPrincipalPreview ? (
              <div className="relative">
                <img
                  src={imagemPrincipalPreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-xl border"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagemPrincipal(null);
                    setImagemPrincipalPreview(null);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-muted-foreground/25 rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-muted/30">
                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Clique para selecionar</span>
                <span className="text-xs text-muted-foreground mt-1">PNG, JPG até 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImagemPrincipalChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Título */}
          <FormField
            control={form.control}
            name="titulo"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-semibold">Título do Banner *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Promoção de Verão - Loja X" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Descrição */}
          <FormField
            control={form.control}
            name="descricao"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-semibold">Descrição</FormLabel>
                <FormDescription>
                  Texto que aparecerá na página de detalhes do banner
                </FormDescription>
                <FormControl>
                  <Textarea
                    placeholder="Descreva seu anúncio, promoção ou evento..."
                    className="min-h-[120px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Galeria de Imagens */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <Image className="h-5 w-5" />
              Galeria de Imagens
            </Label>
            <p className="text-sm text-muted-foreground">
              Adicione até 5 imagens extras para a página de detalhes
            </p>

            <div className="grid grid-cols-3 gap-2">
              {imagensGaleriaPreview.map((preview, index) => (
                <div key={index} className="relative aspect-square">
                  <img
                    src={preview}
                    alt={`Galeria ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => removeGaleriaImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              
              {imagensGaleria.length < 5 && (
                <label className="aspect-square border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors flex flex-col items-center justify-center bg-muted/30">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1">Adicionar</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGaleriaChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Vídeo */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <Video className="h-5 w-5" />
              Vídeo (Opcional)
            </Label>
            
            <Tabs value={videoType} onValueChange={(v) => setVideoType(v as "youtube" | "upload")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="youtube" className="flex items-center gap-2">
                  <Youtube className="h-4 w-4" />
                  YouTube
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload
                </TabsTrigger>
              </TabsList>

              <TabsContent value="youtube" className="mt-3">
                <FormField
                  control={form.control}
                  name="video_youtube_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="https://youtube.com/watch?v=..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Cole o link do vídeo do YouTube
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="upload" className="mt-3">
                {videoFile ? (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Video className="h-8 w-8 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{videoFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVideoFile(null)}
                      className="w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-muted/30">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Selecionar vídeo</span>
                    <span className="text-xs text-muted-foreground mt-1">MP4, WebM, MOV até 50MB</span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={handleVideoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Período de Exibição */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <Calendar className="h-5 w-5" />
              Período de Exibição *
            </Label>

            <FormField
              control={form.control}
              name="dias_comprados"
              render={({ field }) => (
                <FormItem>
                  <Select
                    onValueChange={(value) => field.onChange(Number(value))}
                    defaultValue={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o período" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {diasOptions.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{option.label}</span>
                            <span className="text-primary font-semibold">{option.price}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedDias && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total:</span>
                  <span className="text-xl font-bold text-primary">{selectedDias.price}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Seu banner ficará ativo por {selectedDias.label}
                </p>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-sm">Como funciona?</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Após enviar, sua solicitação será analisada pela equipe</li>
              <li>• Você receberá uma confirmação por e-mail ou WhatsApp</li>
              <li>• O pagamento é feito após aprovação do conteúdo</li>
              <li>• Seu banner aparecerá no carrossel principal da cidade</li>
            </ul>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="dark"
            className="w-full h-12 text-base font-semibold rounded-xl"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enviando..." : "Enviar Solicitação"}
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default NovoBannerPage;
