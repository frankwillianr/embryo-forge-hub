import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ExternalLink, Eye, Gift, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BottomNavBar from "@/components/navigation/BottomNavBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import CopaCountdown from "@/components/CopaCountdown";
import camisaBrasil from "@/assets/copa-2026-camisa.jpg";

const INSTAGRAM_POST_URL = "https://www.instagram.com/p/DYzuFsgxNde/";

const gerarVoucherCodigo = () => {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `COPA2026-${randomPart}`;
};

const Copa2026SorteioPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [printFile, setPrintFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingVoucher, setDeletingVoucher] = useState(false);
  const [sendingAnother, setSendingAnother] = useState(false);
  const [openingPrintId, setOpeningPrintId] = useState<string | null>(null);
  const [printModal, setPrintModal] = useState<{ codigo: string; url: string } | null>(null);

  const pagePath = `/cidade/${slug || "gv"}/copa-2026-sorteio`;

  useSwipeBack({ onBack: () => navigate(`/cidade/${slug}`) });

  useEffect(() => {
    if (!authLoading && !user && slug) {
      navigate(`/cidade/${slug}/auth?redirect=${encodeURIComponent(pagePath)}`, { replace: true });
    }
  }, [authLoading, user, slug, navigate, pagePath]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const { data: vouchers = [], refetch } = useQuery({
    queryKey: ["copa-2026-vouchers", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("copa_2026_voucher" as any)
        .select("id, voucher_codigo, status, created_at, data_sorteio, comprovante_path")
        .eq("user_id", user.id)
        .eq("instagram_post_url", INSTAGRAM_POST_URL)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`copa-2026-vouchers:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "copa_2026_voucher",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["copa-2026-vouchers", user.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const selectedFileLabel = useMemo(() => {
    if (!printFile) return "Anexar print";
    return printFile.name.length > 26 ? `${printFile.name.slice(0, 23)}...` : printFile.name;
  }, [printFile]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Anexe uma imagem do print.", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O print pode ter no maximo 5MB.", variant: "destructive" });
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPrintFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const limparPrint = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPrintFile(null);
    setPreviewUrl("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleGerarVoucher = async () => {
    if (!user?.id || !slug || !printFile) return;

    setSubmitting(true);
    try {
      const fileExt = printFile.name.split(".").pop() || "jpg";
      const comprovantePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("copa-vouchers")
        .upload(comprovantePath, printFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("copa_2026_voucher" as any)
        .insert({
          user_id: user.id,
          cidade_slug: slug,
          voucher_codigo: gerarVoucherCodigo(),
          instagram_post_url: INSTAGRAM_POST_URL,
          comprovante_path: comprovantePath,
          comprovante_nome: printFile.name,
        })
        .select("id, voucher_codigo, status, created_at, data_sorteio")
        .single();

      if (error) throw error;

      toast({ title: "Voucher gerado", description: "Seu print foi anexado para verificacao." });
      limparPrint();
      setSendingAnother(false);
      await refetch();
      return data;
    } catch (error: any) {
      const message = error?.message || "Não foi possível gerar o voucher.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerPrint = async (item: any) => {
    if (!item?.id || !item?.comprovante_path) return;

    setOpeningPrintId(item.id);
    try {
      const { data, error } = await supabase.storage
        .from("copa-vouchers")
        .createSignedUrl(item.comprovante_path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        setPrintModal({ codigo: item.voucher_codigo, url: data.signedUrl });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível abrir o print anexado.",
        variant: "destructive",
      });
    } finally {
      setOpeningPrintId(null);
    }
  };

  const handleApagarVoucher = async (item: any) => {
    if (!user?.id || !item?.id) return;

    setDeletingVoucher(true);
    try {
      const comprovantePath = item.comprovante_path as string | undefined;

      const { error: deleteError } = await supabase
        .from("copa_2026_voucher" as any)
        .delete()
        .eq("id", item.id)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      if (comprovantePath) {
        const { error: storageError } = await supabase.storage
          .from("copa-vouchers")
          .remove([comprovantePath]);

        if (storageError) {
          console.warn("[Copa2026SorteioPage] falha ao remover print antigo", storageError.message);
        }
      }

      toast({ title: "Voucher apagado", description: "Agora você pode anexar um novo print." });
      setSendingAnother(false);
      await refetch();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível apagar o voucher.",
        variant: "destructive",
      });
    } finally {
      setDeletingVoucher(false);
    }
  };

  if (authLoading || (!user && slug)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div id="swipe-back-page" className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/50 bg-background/95 px-4 py-3 pt-safe backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="flex-1 text-base font-semibold">Sorteio Copa 2026</h1>
      </header>

      <main className="space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-[18px] bg-[#083b2a] text-white">
          <div className="aspect-[16/10] w-full overflow-hidden bg-gradient-to-b from-yellow-200 via-yellow-300 to-emerald-200">
            <img src={camisaBrasil} alt="Camisa do Brasil sorteada" className="h-full w-full object-contain p-3" />
          </div>
          <div className="p-4">
            <p className="text-xs font-bold uppercase tracking-normal text-yellow-300">Sorteio em 09/06, às 15h</p>
            <h2 className="mt-1 text-2xl font-extrabold leading-tight">
              Camisa original da Seleção Brasileira 2026
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/82">
              A camisa é original da Seleção Brasileira 2026. Gere seu voucher anexando o print do comentário na
              postagem oficial. Assista à Copa do Mundo com estilo, garantido pelo GV City.
            </p>
            <div className="mt-3">
              <CopaCountdown />
            </div>
          </div>
        </section>

        {vouchers.length > 0 && !sendingAnother ? (
          <section className="rounded-[18px] border border-emerald-500/25 bg-emerald-50 p-4 text-emerald-950">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Meus vouchers</p>
                <p className="mt-2 text-xs leading-relaxed text-emerald-900/80">
                  Cada voucher válido conta como uma nova chance. Todos serão verificados no dia 09/06, às 15h.
                </p>
                <div className="mt-3 space-y-2">
                  {vouchers.map((item: any, index: number) => (
                    <div key={item.id} className="w-full rounded-2xl border border-emerald-200 bg-white/80 p-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase text-emerald-700">Voucher {vouchers.length - index}</p>
                        <p className="mt-1 break-all rounded-xl bg-emerald-50 px-3 py-2 text-base font-extrabold text-emerald-950">
                          {item.voucher_codigo}
                        </p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={openingPrintId === item.id}
                          onClick={() => handleVerPrint(item)}
                          className="h-9 gap-2 rounded-xl border-emerald-700/30 bg-white text-emerald-950 hover:bg-emerald-50"
                        >
                          {openingPrintId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                          Ver print
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={deletingVoucher}
                          onClick={() => handleApagarVoucher(item)}
                          className="h-9 gap-2 rounded-xl border-red-200 bg-white text-red-700 hover:bg-red-50"
                        >
                          {deletingVoucher ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={() => setSendingAnother(true)}
                  className="mt-4 h-10 w-full gap-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  <Upload className="h-4 w-4" />
                  Enviar outro print e gerar novo voucher
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-[18px] border border-border bg-card p-4">
          <h2 className="text-sm font-bold text-foreground">Regras para participar</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>1. Abra a postagem oficial no Instagram.</li>
            <li>2. Siga o GV City no Instagram.</li>
            <li>3. Marque 3 amigos diferentes nos comentários da postagem.</li>
            <li>4. Tire um print mostrando sua marcação.</li>
            <li>5. Anexe o print aqui e clique em gerar meu voucher.</li>
          </ol>
          <div className="mt-4 space-y-3 rounded-2xl bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-950">
            <div className="rounded-xl border border-emerald-300 bg-white/75 p-3">
              <p className="text-[11px] font-extrabold uppercase text-emerald-700">Regra 1</p>
              <p className="mt-1 text-sm font-extrabold text-emerald-900">Quer aumentar suas chances?</p>
              <p className="mt-1">
                Marque mais 3 amigos diferentes na postagem oficial, tire um novo print e gere outro voucher. Cada
                voucher válido conta como uma nova chance no sorteio.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white/65 p-3">
              <p className="text-[11px] font-extrabold uppercase text-emerald-700">Regra 2</p>
              <p className="mt-1">
                Não vale marcar a mesma pessoa no mesmo print. Cada voucher precisa ter 3 pessoas diferentes.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white/65 p-3">
              <p className="text-[11px] font-extrabold uppercase text-emerald-700">Regra 3</p>
              <p className="mt-1">
                A camisa sorteada é original da Seleção Brasileira 2026.
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 font-extrabold text-red-700">
              <p className="text-[11px] uppercase">Regra 4</p>
              <p className="mt-1">
                A retirada será feita apenas em mãos em Governador Valadares. O prêmio não será enviado por entrega,
                transportadora, Correios ou qualquer outro meio de envio.
              </p>
            </div>
          </div>
          <Button asChild className="mt-4 h-11 w-full gap-2 rounded-xl">
            <a href={INSTAGRAM_POST_URL} target="_blank" rel="noreferrer">
              Abrir postagem oficial
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </section>

        {vouchers.length === 0 || sendingAnother ? (
            <section className="rounded-[18px] border border-border bg-card p-4">
              <h2 className="text-sm font-bold text-foreground">Anexar print</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                O print será conferido no dia 09/06 antes da validação final do sorteio.
              </p>

              {previewUrl ? (
                <div className="relative mt-4 overflow-hidden rounded-2xl border border-border">
                  <img src={previewUrl} alt="Print anexado" className="max-h-72 w-full object-cover" />
                  <button
                    type="button"
                    onClick={limparPrint}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 justify-start gap-2 rounded-xl"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  <span className="min-w-0 truncate">{selectedFileLabel}</span>
                </Button>
                <Button
                  type="button"
                  disabled={!printFile || submitting}
                  onClick={handleGerarVoucher}
                  className="h-11 gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                  Gerar meu voucher
                </Button>
              </div>

              <input ref={inputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </section>
        ) : null}
      </main>

      <Dialog open={!!printModal} onOpenChange={(open) => !open && setPrintModal(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl p-0 sm:max-w-md">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="text-base">Print anexado</DialogTitle>
            {printModal?.codigo ? (
              <p className="break-all text-xs font-semibold text-muted-foreground">{printModal.codigo}</p>
            ) : null}
          </DialogHeader>
          <div className="px-4 pb-4">
            {printModal?.url ? (
              <img
                src={printModal.url}
                alt="Print anexado ao voucher"
                className="max-h-[70vh] w-full rounded-xl border border-border object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <BottomNavBar slug={slug} />
    </div>
  );
};

export default Copa2026SorteioPage;
