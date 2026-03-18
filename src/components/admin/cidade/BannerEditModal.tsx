import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Image, Loader2, Upload, X } from "lucide-react";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { fetchBannerGallery, replaceBannerGallery } from "@/lib/bannerGallery";

const formSchema = z.object({
  titulo: z.string().min(1, "Titulo e obrigatorio").max(100),
  descricao: z.string().max(500).optional(),
  imagem_url: z.string().url("URL invalida").optional().or(z.literal("")),
  video_youtube_url: z.string().url("URL invalida").optional().or(z.literal("")),
  status: z.enum(["rascunho", "aguardando_pagamento", "pendente", "ativo", "inativo", "expirado"]),
});

type FormValues = z.infer<typeof formSchema>;

interface BannerEditModalProps {
  banner: any;
  cidadeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GalleryItem {
  imagem_url: string;
  isLocal?: boolean;
  file?: File;
}

const BannerEditModal = ({ banner, cidadeId, open, onOpenChange }: BannerEditModalProps) => {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isLoadingDias, setIsLoadingDias] = useState(false);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      imagem_url: "",
      video_youtube_url: "",
      status: "pendente",
    },
  });

  // Carrega os dados do banner quando o modal abre
  useEffect(() => {
    if (banner && open) {
      form.reset({
        titulo: banner.titulo || "",
        descricao: banner.descricao || "",
        imagem_url: banner.imagem_url || "",
        video_youtube_url: banner.video_youtube_url || "",
        status: banner.status || "pendente",
      });

      // Buscar os dias do banner
      loadBannerDias();
      loadBannerGallery();
    }
  }, [banner, open]);

  const loadBannerDias = async () => {
    if (!banner?.id) return;
    
    setIsLoadingDias(true);
    try {
      const { data, error } = await supabase
        .from("rel_banner_dias")
        .select("data_exibicao")
        .eq("banner_id", banner.id)
        .order("data_exibicao", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setStartDate(parseISO(data[0].data_exibicao));
        setEndDate(parseISO(data[data.length - 1].data_exibicao));
      } else {
        setStartDate(undefined);
        setEndDate(undefined);
      }
    } catch (error) {
      console.error("Erro ao carregar dias do banner:", error);
    } finally {
      setIsLoadingDias(false);
    }
  };

  const loadBannerGallery = async () => {
    if (!banner?.id) return;
    setIsLoadingGallery(true);
    try {
      const rows = await fetchBannerGallery(banner.id);
      setGalleryItems(rows.map((row: any) => ({ imagem_url: row.imagem_url })));
    } catch (error) {
      console.error("Erro ao carregar galeria do banner:", error);
      setGalleryItems([]);
    } finally {
      setIsLoadingGallery(false);
    }
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} excede 5MB.`);
        return false;
      }
      return true;
    });

    if (galleryItems.length + validFiles.length > 5) {
      toast.error("Máximo de 5 imagens na galeria.");
      return;
    }

    const newItems: GalleryItem[] = validFiles.map((file) => ({
      isLocal: true,
      file,
      imagem_url: URL.createObjectURL(file),
    }));

    setGalleryItems((prev) => [...prev, ...newItems]);
  };

  const removeGalleryItem = (index: number) => {
    setGalleryItems((prev) => {
      const item = prev[index];
      if (item?.isLocal && item.imagem_url.startsWith("blob:")) {
        URL.revokeObjectURL(item.imagem_url);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateBannerMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Atualizar dados do banner
      const { error: bannerError } = await supabase
        .from("banner")
        .update({
          titulo: values.titulo,
          descricao: values.descricao || null,
          imagem_url: values.imagem_url || null,
          video_youtube_url: values.video_youtube_url || null,
          status: values.status,
          ...(values.status === "ativo"
            ? { ativo: true }
            : values.status === "inativo"
              ? { ativo: false }
              : {}),
        })
        .eq("id", banner.id);

      if (bannerError) throw bannerError;

      // Atualizar galeria de imagens
      const uploadedGalleryUrls: string[] = [];
      for (let i = 0; i < galleryItems.length; i++) {
        const item = galleryItems[i];
        if (item.isLocal && item.file) {
          const fileName = `${Date.now()}_${i}_${item.file.name}`;
          const filePath = `banners/${banner.admin_user_id || "admin"}/${fileName}`;
          const { error: uploadError } = await supabase.storage
            .from("banners")
            .upload(filePath, item.file);

          if (uploadError) {
            throw new Error(`Erro ao subir imagem da galeria: ${uploadError.message}`);
          }

          const { data: publicData } = supabase.storage.from("banners").getPublicUrl(filePath);
          uploadedGalleryUrls.push(publicData.publicUrl);
        } else {
          uploadedGalleryUrls.push(item.imagem_url);
        }
      }

      await replaceBannerGallery(banner.id, uploadedGalleryUrls);

      // Se as datas foram definidas, atualizar rel_banner_dias
      if (startDate && endDate) {
        // Deletar dias existentes
        const { error: deleteError } = await supabase
          .from("rel_banner_dias")
          .delete()
          .eq("banner_id", banner.id);

        if (deleteError) throw deleteError;

        // Criar novos dias
        const dias = [];
        let currentDate = startDate;
        while (currentDate <= endDate) {
          dias.push({
            banner_id: banner.id,
            data_exibicao: format(currentDate, "yyyy-MM-dd"),
            utilizado: false,
          });
          currentDate = addDays(currentDate, 1);
        }

        if (dias.length > 0) {
          const { error: insertError } = await supabase
            .from("rel_banner_dias")
            .insert(dias);

          if (insertError) throw insertError;

          // Atualizar dias_comprados no banner
          const { error: updateDiasError } = await supabase
            .from("banner")
            .update({ dias_comprados: dias.length })
            .eq("id", banner.id);

          if (updateDiasError) throw updateDiasError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-banners", cidadeId] });
      toast.success("Banner atualizado com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar banner: " + error.message);
    },
  });

  const onSubmit = (values: FormValues) => {
    updateBannerMutation.mutate(values);
  };

  const diasSelecionados = startDate && endDate
    ? differenceInDays(endDate, startDate) + 1
    : 0;

  // Garantir que endDate não seja antes de startDate
  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    if (date && endDate && endDate < date) {
      setEndDate(date);
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    if (date && startDate && date < startDate) {
      // Se a data fim for antes da data início, ajustar
      setEndDate(startDate);
    } else {
      setEndDate(date);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Banner</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Título do banner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição do banner"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imagem_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da Imagem</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  {field.value && (
                    <img
                      src={field.value}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-md mt-2"
                    />
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="video_youtube_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do Vídeo (YouTube)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://youtube.com/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="aguardando_pagamento">Aguardando pagamento</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="expirado">Expirado</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Status atual: {banner?.status || "pendente"}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Galeria de Imagens (até 5)
              </FormLabel>
              {isLoadingGallery ? (
                <div className="text-sm text-muted-foreground">Carregando galeria...</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {galleryItems.map((item, index) => (
                    <div key={`${item.imagem_url}-${index}`} className="relative aspect-square">
                      <img
                        src={item.imagem_url}
                        alt={`Galeria ${index + 1}`}
                        className="w-full h-full object-cover rounded-md border"
                      />
                      <button
                        type="button"
                        onClick={() => removeGalleryItem(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {galleryItems.length < 5 && (
                    <label className="aspect-square border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors flex flex-col items-center justify-center bg-muted/30">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground mt-1">Adicionar</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleGalleryUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Essas imagens aparecem na página de detalhes do banner.
              </p>
            </div>

            {/* Seleção de datas - 2 date pickers separados */}
            <div className="space-y-3">
              <FormLabel>Período de Exibição</FormLabel>
              {isLoadingDias ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando datas...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {/* Data Início */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Data Início
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? (
                            format(startDate, "dd/MM/yyyy", { locale: ptBR })
                          ) : (
                            "Selecione"
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={handleStartDateChange}
                          initialFocus
                          locale={ptBR}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Data Fim */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Data Fim
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? (
                            format(endDate, "dd/MM/yyyy", { locale: ptBR })
                          ) : (
                            "Selecione"
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={handleEndDateChange}
                          disabled={(date) => startDate ? date < startDate : false}
                          initialFocus
                          locale={ptBR}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
              
              {diasSelecionados > 0 && (
                <p className="text-sm text-muted-foreground">
                  {diasSelecionados} dia{diasSelecionados > 1 ? "s" : ""} selecionado
                  {diasSelecionados > 1 ? "s" : ""}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateBannerMutation.isPending}
              >
                {updateBannerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default BannerEditModal;




