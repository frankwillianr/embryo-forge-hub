import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Megaphone, Image, Video, Plus, X, Youtube, Upload, Calendar, Loader2, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BannerPreviewModal } from "@/components/banner/BannerPreviewModal";
import { PaymentConfirmationModal } from "@/components/banner/PaymentConfirmationModal";
import { insertBannerGallery } from "@/lib/bannerGallery";

const bannerSchema = z.object({
  titulo: z.string().min(3, "Título deve ter pelo menos 3 caracteres").max(100, "Título muito longo"),
  descricao: z.string().min(1, "Descrição é obrigatória").max(1000, "Descrição muito longa"),
  dias_comprados: z.number().min(7, "Mínimo de 7 dias").max(365, "Máximo de 365 dias"),
  video_youtube_url: z.string().url("URL inválida").optional().or(z.literal("")),
  data_inicio: z.date({ required_error: "Selecione a data de início" }),
  data_fim: z.date({ required_error: "Selecione a data de término" }),
}).refine((data) => data.data_fim > data.data_inicio, {
  message: "Data de término deve ser posterior à data de início",
  path: ["data_fim"],
});

type BannerFormData = z.infer<typeof bannerSchema>;

const DEFAULT_PRECO_POR_DIA = 10;

const NovoBannerPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  // Fetch city pricing
  const { data: cidade } = useQuery({
    queryKey: ["cidade-pricing", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome, valor_dia_banner")
        .eq("slug", slug)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const precoPorDia = cidade?.valor_dia_banner || DEFAULT_PRECO_POR_DIA;
  const [imagemPrincipal, setImagemPrincipal] = useState<File | null>(null);
  const [imagemPrincipalPreview, setImagemPrincipalPreview] = useState<string | null>(null);
  const [imagensGaleria, setImagensGaleria] = useState<File[]>([]);
  const [imagensGaleriaPreview, setImagensGaleriaPreview] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoType, setVideoType] = useState<"youtube" | "upload">("youtube");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modal states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [formData, setFormData] = useState<BannerFormData | null>(null);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/cidade/${slug}/auth?redirect=/cidade/${slug}/banner/novo`);
    }
  }, [user, authLoading, navigate, slug]);

  const tomorrow = addDays(new Date(), 1);
  const defaultEndDate = addDays(tomorrow, 6); // 7 days total

  const form = useForm<BannerFormData>({
    resolver: zodResolver(bannerSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      dias_comprados: 7,
      video_youtube_url: "",
      data_inicio: tomorrow,
      data_fim: defaultEndDate,
    },
  });

  const dataInicio = form.watch("data_inicio");
  const dataFim = form.watch("data_fim");

  // Update dias_comprados when dates change
  useEffect(() => {
    if (dataInicio && dataFim) {
      const days = differenceInDays(dataFim, dataInicio) + 1;
      // Always update dias_comprados to reflect actual selection
      form.setValue("dias_comprados", Math.max(0, days));
    }
  }, [dataInicio, dataFim, form]);

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

  // Step 1: Validate form and show preview modal
  const onSubmit = async (data: BannerFormData) => {
    if (!imagemPrincipal) {
      toast.error("Selecione uma imagem principal para o banner.");
      return;
    }
    
    setFormData(data);
    setShowPreviewModal(true);
  };

  // Step 2: Confirm and create banner with "aguardando_pagamento" status
  const handleConfirmPublish = async () => {
    if (!formData || !imagemPrincipal || !cidade?.id) return;
    
    setIsSubmitting(true);

    try {
      // 1. Upload main image to storage
      const timestamp = Date.now();
      const mainImagePath = `banners/${user?.id}/${timestamp}_main_${imagemPrincipal.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("banners")
        .upload(mainImagePath, imagemPrincipal);

      if (uploadError) throw new Error(`Erro ao fazer upload da imagem: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage
        .from("banners")
        .getPublicUrl(mainImagePath);

      const imagemUrl = publicUrlData.publicUrl;

      // 2. Upload gallery images if any
      const galeriaUrls: string[] = [];
      for (let i = 0; i < imagensGaleria.length; i++) {
        const galeriaPath = `banners/${user?.id}/${timestamp}_galeria_${i}_${imagensGaleria[i].name}`;
        const { error: galeriaError } = await supabase.storage
          .from("banners")
          .upload(galeriaPath, imagensGaleria[i]);
        
        if (!galeriaError) {
          const { data: galeriaUrl } = supabase.storage
            .from("banners")
            .getPublicUrl(galeriaPath);
          galeriaUrls.push(galeriaUrl.publicUrl);
        }
      }

      // 3. Upload video if applicable
      let videoUploadUrl: string | null = null;
      if (videoType === "upload" && videoFile) {
        const videoPath = `banners/${user?.id}/${timestamp}_video_${videoFile.name}`;
        const { error: videoError } = await supabase.storage
          .from("banners")
          .upload(videoPath, videoFile);
        
        if (!videoError) {
          const { data: videoUrl } = supabase.storage
            .from("banners")
            .getPublicUrl(videoPath);
          videoUploadUrl = videoUrl.publicUrl;
        }
      }

      // 4. Create banner in database with status "aguardando_pagamento"
      const { data: bannerData, error: bannerError } = await supabase
        .from("banner")
        .insert({
          titulo: formData.titulo,
          descricao: formData.descricao,
          imagem_url: imagemUrl,
          video_youtube_url: videoType === "youtube" ? formData.video_youtube_url : null,
          video_upload_url: videoUploadUrl,
          dias_comprados: formData.dias_comprados,
          dias_usados: 0,
          ativo: false,
          status: "aguardando_pagamento",
          admin_user_id: user?.id,
        })
        .select()
        .single();

      if (bannerError) throw new Error(`Erro ao criar banner: ${bannerError.message}`);

      // 5. Insert gallery images
      if (galeriaUrls.length > 0) {
        await insertBannerGallery(bannerData.id, galeriaUrls);
      }

      // 6. Link banner to city
      const { error: relCidadeError } = await supabase.from("rel_cidade_banner").insert({
        cidade_id: cidade.id,
        banner_id: bannerData.id,
      });

      if (relCidadeError) {
        console.error("Error linking banner to city:", relCidadeError);
        throw new Error(`Erro ao vincular banner à cidade: ${relCidadeError.message}`);
      }

      // 7. Create exhibition dates
      const diasExibicao = [];
      for (let i = 0; i < formData.dias_comprados; i++) {
        const dataExibicao = addDays(formData.data_inicio, i);
        diasExibicao.push({
          banner_id: bannerData.id,
          data_exibicao: format(dataExibicao, "yyyy-MM-dd"),
          utilizado: false,
        });
      }
      
      const { error: diasError } = await supabase.from("rel_banner_dias").insert(diasExibicao);
      
      if (diasError) {
        console.error("Error creating exhibition dates:", diasError);
        throw new Error(`Erro ao criar datas de exibição: ${diasError.message}`);
      }

      // 8. Create Stripe payment session via edge function
      const valorTotal = formData.dias_comprados * precoPorDia;
      
      const { data: paymentResponse, error: paymentError } = await supabase.functions.invoke(
        "create-banner-payment",
        {
          body: {
            bannerId: bannerData.id,
            cidadeId: cidade.id,
            cidadeNome: slug || "cidade",
            bannerTitulo: formData.titulo,
            valorTotal,
            diasComprados: formData.dias_comprados,
            valorDia: precoPorDia,
            userEmail: user?.email || "",
            userName: profile?.nome || user?.email?.split("@")[0] || "Cliente",
          },
        }
      );

      if (paymentError) throw new Error(`Erro ao criar pagamento: ${paymentError.message}`);

      // 9. Send payment email via edge function
      await supabase.functions.invoke("send-banner-payment-email", {
        body: {
          to: user?.email || "",
          userName: profile?.nome || user?.email?.split("@")[0] || "Cliente",
          bannerTitulo: formData.titulo,
          cidadeNome: slug?.toUpperCase() || "Cidade",
          diasComprados: formData.dias_comprados,
          valorTotal,
          paymentUrl: paymentResponse.sessionUrl,
          expiresAt: paymentResponse.expiresAt,
        },
      });

      // Close preview modal and show payment confirmation
      setShowPreviewModal(false);
      setShowPaymentModal(true);
      
      toast.success("Anúncio criado! Verifique seu e-mail para o link de pagamento.");
    } catch (error: any) {
      console.error("Error creating banner:", error);
      toast.error(error.message || "Erro ao criar anúncio. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Close payment modal and redirect
  const handlePaymentModalClose = () => {
    setShowPaymentModal(false);
    navigate(`/cidade/${slug}`);
  };

  const diasComprados = form.watch("dias_comprados");
  const titulo = form.watch("titulo");
  const descricao = form.watch("descricao");
  const precoTotal = `R$ ${(diasComprados * precoPorDia).toFixed(2).replace(".", ",")}`;

  // Validate if form is complete for submit button
  const isFormValid = 
    titulo && titulo.length >= 3 && 
    descricao && descricao.length >= 1 && 
    imagemPrincipalPreview && 
    diasComprados >= 7;

  // Prepare preview data for modal
  const previewData = formData && imagemPrincipalPreview ? {
    titulo: formData.titulo,
    descricao: formData.descricao,
    dias_comprados: formData.dias_comprados,
    data_inicio: formData.data_inicio,
    data_fim: formData.data_fim,
    video_youtube_url: formData.video_youtube_url,
    imagemPrincipalPreview,
    imagensGaleriaPreview,
    preco: precoTotal,
  } : null;

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

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6">
          {/* Intro Card */}
          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-2xl">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Megaphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Destaque seu negócio</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Seu banner aparecerá no carrossel principal da cidade
              </p>
            </div>
          </div>

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
          <div className="space-y-4">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <Calendar className="h-5 w-5" />
              Período de Exibição *
            </Label>

            {/* Date Pickers */}
            <div className="grid grid-cols-2 gap-3">
              {/* Data Início */}
              <FormField
                control={form.control}
                name="data_inicio"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Início</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Data Fim */}
              <FormField
                control={form.control}
                name="data_fim"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Término</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < addDays(dataInicio || new Date(), 6)}
                          modifiers={{
                            range: dataInicio && field.value 
                              ? { from: dataInicio, to: field.value }
                              : undefined,
                          }}
                          modifiersStyles={{
                            range: { 
                              backgroundColor: 'hsl(var(--primary) / 0.15)',
                              borderRadius: 0,
                            },
                          }}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {diasComprados < 7 ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Período mínimo de 7 dias é obrigatório
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Selecione uma data de término que resulte em pelo menos 7 dias de exibição.
                </p>
              </div>
            ) : (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total:</span>
                  <span className="text-xl font-bold text-primary">{precoTotal}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dataInicio && dataFim && (
                    <>
                      De {format(dataInicio, "dd/MM/yyyy", { locale: ptBR })} até {format(dataFim, "dd/MM/yyyy", { locale: ptBR })} ({diasComprados} dias × R$ {precoPorDia.toFixed(2).replace(".", ",")}/dia)
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-sm">Como funciona?</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Revise seu anúncio antes de publicar</li>
              <li>• Você receberá um link de pagamento por e-mail</li>
              <li>• Após o pagamento, seu anúncio entra em análise</li>
              <li>• Aprovação em poucas horas</li>
            </ul>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="dark"
            className="w-full h-12 text-base font-semibold rounded-xl"
            disabled={isSubmitting || !isFormValid}
          >
            Revisar Anúncio
          </Button>
        </form>
      </Form>

      {/* Preview Modal */}
      <BannerPreviewModal
        open={showPreviewModal}
        onOpenChange={setShowPreviewModal}
        data={previewData}
        onConfirm={handleConfirmPublish}
        isSubmitting={isSubmitting}
      />

      {/* Payment Confirmation Modal */}
      <PaymentConfirmationModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        email={user?.email || profile?.email || ""}
        onClose={handlePaymentModalClose}
      />
    </div>
  );
};

export default NovoBannerPage;
