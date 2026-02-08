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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

const formSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório").max(100),
  descricao: z.string().max(500).optional(),
  imagem_url: z.string().url("URL inválida").optional().or(z.literal("")),
  video_youtube_url: z.string().url("URL inválida").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface BannerEditModalProps {
  banner: any;
  cidadeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BannerEditModal = ({ banner, cidadeId, open, onOpenChange }: BannerEditModalProps) => {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [bannerDias, setBannerDias] = useState<any[]>([]);
  const [isLoadingDias, setIsLoadingDias] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      imagem_url: "",
      video_youtube_url: "",
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
      });

      // Buscar os dias do banner
      loadBannerDias();
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

      setBannerDias(data || []);

      if (data && data.length > 0) {
        const firstDate = parseISO(data[0].data_exibicao);
        const lastDate = parseISO(data[data.length - 1].data_exibicao);
        setDateRange({ from: firstDate, to: lastDate });
      } else {
        setDateRange(undefined);
      }
    } catch (error) {
      console.error("Erro ao carregar dias do banner:", error);
    } finally {
      setIsLoadingDias(false);
    }
  };

  const updateBannerMutation = useMutation({
    mutationFn: async (values: FormValues & { dateRange?: DateRange }) => {
      // Atualizar dados do banner
      const { error: bannerError } = await supabase
        .from("banner")
        .update({
          titulo: values.titulo,
          descricao: values.descricao || null,
          imagem_url: values.imagem_url || null,
          video_youtube_url: values.video_youtube_url || null,
        })
        .eq("id", banner.id);

      if (bannerError) throw bannerError;

      // Se as datas mudaram, atualizar rel_banner_dias
      if (values.dateRange?.from && values.dateRange?.to) {
        // Deletar dias existentes
        const { error: deleteError } = await supabase
          .from("rel_banner_dias")
          .delete()
          .eq("banner_id", banner.id);

        if (deleteError) throw deleteError;

        // Criar novos dias
        const dias = [];
        let currentDate = values.dateRange.from;
        while (currentDate <= values.dateRange.to) {
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
    updateBannerMutation.mutate({ ...values, dateRange });
  };

  const diasSelecionados = dateRange?.from && dateRange?.to
    ? differenceInDays(dateRange.to, dateRange.from) + 1
    : 0;

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

            {/* Seleção de datas */}
            <div className="space-y-2">
              <FormLabel>Período de Exibição</FormLabel>
              {isLoadingDias ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando datas...
                </div>
              ) : (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                              {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                            </>
                          ) : (
                            format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                          )
                        ) : (
                          "Selecione o período"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  {diasSelecionados > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {diasSelecionados} dia{diasSelecionados > 1 ? "s" : ""} selecionado
                      {diasSelecionados > 1 ? "s" : ""}
                    </p>
                  )}
                </>
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
