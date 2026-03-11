import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Loader2, Pencil, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ImageUpload from "@/components/shared/ImageUpload";

interface DesapegaCardProps {
  anuncio: {
    id: string;
    titulo: string;
    preco: number;
    created_at: string;
    status?: string;
    user_id?: string | null;
    categoria_id?: string | null;
    descricao?: string | null;
    condicao?: string | null;
    whatsapp?: string | null;
    imagens?: { id: string; url: string; ordem: number }[];
    categoria?: { id: string; nome: string; icone: string };
  };
  cidadeSlug: string;
}

const DesapegaCard = ({ anuncio, cidadeSlug }: DesapegaCardProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [manageOpen, setManageOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [titulo, setTitulo] = useState(anuncio.titulo ?? "");
  const [descricao, setDescricao] = useState(anuncio.descricao ?? "");
  const [preco, setPreco] = useState("");
  const [categoriaId, setCategoriaId] = useState(anuncio.categoria_id ?? "");
  const [condicao, setCondicao] = useState(anuncio.condicao ?? "usado");
  const [whatsapp, setWhatsapp] = useState(anuncio.whatsapp ?? "");
  const [imagens, setImagens] = useState<string[]>(
    [...(anuncio.imagens ?? [])].sort((a, b) => a.ordem - b.ordem).map((img) => img.url),
  );

  const isOwner = !!user?.id && anuncio.user_id === user.id;
  const isVendido = anuncio.status === "vendido";

  const { data: categorias } = useQuery({
    queryKey: ["desapega-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_desapega_categoria")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setTitulo(anuncio.titulo ?? "");
    setDescricao(anuncio.descricao ?? "");
    setPreco(
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(Number(anuncio.preco) || 0),
    );
    setCategoriaId(anuncio.categoria_id ?? "");
    setCondicao(anuncio.condicao ?? "usado");
    setWhatsapp(anuncio.whatsapp ?? "");
    setImagens(
      [...(anuncio.imagens ?? [])].sort((a, b) => a.ordem - b.ordem).map((img) => img.url),
    );
  }, [anuncio]);

  const primeiraImagem = anuncio.imagens?.sort((a, b) => a.ordem - b.ordem)[0];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const timeAgo = formatDistanceToNow(new Date(anuncio.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  const markAsVendidoMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Voce precisa estar logado.");
      const { error } = await supabase
        .from("rel_cidade_desapega")
        .update({ status: "vendido" })
        .eq("id", anuncio.id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["desapega"] });
      queryClient.invalidateQueries({ queryKey: ["desapega-anuncio", anuncio.id] });
      toast({ title: "Anuncio marcado como vendido" });
      setManageOpen(false);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message || "Nao foi possivel atualizar.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Voce precisa estar logado.");
      const { error } = await supabase
        .from("rel_cidade_desapega")
        .update({ status: "removido" })
        .eq("id", anuncio.id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["desapega"] });
      queryClient.invalidateQueries({ queryKey: ["desapega-anuncio", anuncio.id] });
      toast({ title: "Anuncio deletado" });
      setManageOpen(false);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message || "Nao foi possivel deletar.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Voce precisa estar logado.");

      const cleanWhatsapp = whatsapp.replace(/\D/g, "");
      const cleanPreco = parseFloat(preco.replace(/\D/g, "")) / 100;

      if (titulo.trim().length < 3) throw new Error("Titulo deve ter ao menos 3 caracteres.");
      if (!cleanPreco || cleanPreco <= 0) throw new Error("Preco invalido.");
      if (cleanWhatsapp.length !== 11) throw new Error("Informe um WhatsApp valido com DDD.");

      const { error: anuncioError } = await supabase
        .from("rel_cidade_desapega")
        .update({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          preco: cleanPreco,
          categoria_id: categoriaId || null,
          condicao,
          whatsapp: cleanWhatsapp,
        })
        .eq("id", anuncio.id)
        .eq("user_id", user.id);
      if (anuncioError) throw anuncioError;

      const { error: removeError } = await supabase
        .from("rel_cidade_desapega_imagem")
        .delete()
        .eq("anuncio_id", anuncio.id);
      if (removeError) throw removeError;

      if (imagens.length > 0) {
        const imagensData = imagens.map((url, index) => ({
          anuncio_id: anuncio.id,
          url,
          ordem: index,
        }));
        const { error: imagensError } = await supabase
          .from("rel_cidade_desapega_imagem")
          .insert(imagensData);
        if (imagensError) throw imagensError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["desapega"] });
      queryClient.invalidateQueries({ queryKey: ["desapega-anuncio", anuncio.id] });
      toast({ title: "Anuncio atualizado" });
      setEditOpen(false);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message || "Nao foi possivel salvar.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    },
  });

  const handleWhatsappChange = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    let formatted = numbers;
    if (numbers.length > 2) {
      formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    }
    if (numbers.length > 7) {
      formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    setWhatsapp(formatted);
  };

  const handlePrecoChange = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(numbers) / 100 || 0);
    setPreco(formatted);
  };

  return (
    <>
      <button
        onClick={() => navigate(`/cidade/${cidadeSlug}/desapega/${anuncio.id}`)}
        className="group text-left"
      >
        <div className="relative aspect-square rounded-xl overflow-hidden bg-muted mb-2">
          {primeiraImagem ? (
            <img
              src={primeiraImagem.url}
              alt={anuncio.titulo}
              className={`w-full h-full object-cover transition-transform group-active:scale-105 ${isVendido ? "grayscale" : ""}`}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${isVendido ? "grayscale" : ""}`}>
              <span className="text-4xl">??</span>
            </div>
          )}

          {isVendido && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="bg-black/70 text-white text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-full">
                VENDIDO
              </span>
            </div>
          )}

          {isOwner ? (
            <div className="absolute top-2 right-2 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditOpen(true);
                }}
                className="w-8 h-8 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center transition-transform active:scale-90"
                aria-label="Editar anuncio"
              >
                <Pencil className="h-4 w-4 text-foreground" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setManageOpen(true);
                }}
                className="w-8 h-8 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center transition-transform active:scale-90"
                aria-label="Gerenciar anuncio"
              >
                <X className="h-4 w-4 text-foreground" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Favoritar", anuncio.id);
              }}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center transition-transform active:scale-90"
            >
              <Heart className="h-4 w-4 text-foreground" />
            </button>
          )}
        </div>

        <div className="space-y-0.5">
          <p className="font-semibold text-primary text-[15px]">{formatPrice(anuncio.preco)}</p>
          <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-tight">{anuncio.titulo}</h3>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
      </button>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar anuncio</DialogTitle>
            <DialogDescription>Escolha uma acao para este item.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="secondary"
              onClick={() => markAsVendidoMutation.mutate()}
              disabled={markAsVendidoMutation.isPending || deleteMutation.isPending}
              className="w-full"
            >
              Marcar como vendido
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={markAsVendidoMutation.isPending || deleteMutation.isPending}
              className="w-full"
            >
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar anuncio</DialogTitle>
            <DialogDescription>Atualize os dados e as fotos do seu anuncio.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-4">
            <div className="space-y-2">
              <Label>Fotos do produto</Label>
              <ImageUpload images={imagens} onChange={setImagens} maxImages={5} bucket="desapega" folder="anuncios" />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`titulo-${anuncio.id}`}>Titulo do anuncio *</Label>
              <Input id={`titulo-${anuncio.id}`} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={100} />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icone} {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Condicao</Label>
              <Select value={condicao} onValueChange={setCondicao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="seminovo">Seminovo</SelectItem>
                  <SelectItem value="usado">Usado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`preco-${anuncio.id}`}>Preco *</Label>
              <Input
                id={`preco-${anuncio.id}`}
                placeholder="R$ 0,00"
                value={preco}
                onChange={(e) => handlePrecoChange(e.target.value)}
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`descricao-${anuncio.id}`}>Descricao</Label>
              <Textarea
                id={`descricao-${anuncio.id}`}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={4}
                maxLength={1000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`whatsapp-${anuncio.id}`}>WhatsApp *</Label>
              <Input
                id={`whatsapp-${anuncio.id}`}
                placeholder="(00) 00000-0000"
                value={whatsapp}
                onChange={(e) => handleWhatsappChange(e.target.value)}
                inputMode="tel"
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={updateMutation.isPending} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full sm:w-auto">
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar alteracoes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DesapegaCard;
