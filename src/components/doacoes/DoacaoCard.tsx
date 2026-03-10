import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

interface DoacaoCardProps {
  anuncio: {
    id: string;
    titulo: string;
    created_at: string;
    status: string;
    user_id: string | null;
    imagens?: { id: string; url: string; ordem: number }[];
    categoria?: { id: string; nome: string; icone: string };
  };
  cidadeSlug: string;
}

const DoacaoCard = ({ anuncio, cidadeSlug }: DoacaoCardProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [manageOpen, setManageOpen] = useState(false);

  const isOwner = !!user?.id && anuncio.user_id === user.id;
  const isDoado = anuncio.status === "doado";

  const primeiraImagem = anuncio.imagens?.sort((a, b) => a.ordem - b.ordem)[0];
  const timeAgo = formatDistanceToNow(new Date(anuncio.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  const markAsDoadoMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Você precisa estar logado.");
      const { error } = await supabase
        .from("rel_cidade_doacao")
        .update({ status: "doado" })
        .eq("id", anuncio.id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doacoes"] });
      queryClient.invalidateQueries({ queryKey: ["doacao-anuncio", anuncio.id] });
      toast({ title: "Doação marcada como doada" });
      setManageOpen(false);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error
        ? error.message
        : (error as { message?: string })?.message || "Não foi possível atualizar.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Você precisa estar logado.");
      const { error } = await supabase
        .from("rel_cidade_doacao")
        .update({ status: "removido" })
        .eq("id", anuncio.id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doacoes"] });
      queryClient.invalidateQueries({ queryKey: ["doacao-anuncio", anuncio.id] });
      toast({ title: "Doação deletada" });
      setManageOpen(false);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error
        ? error.message
        : (error as { message?: string })?.message || "Não foi possível deletar.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    },
  });

  return (
    <>
      <button
        onClick={() => navigate(`/cidade/${cidadeSlug}/doacoes/${anuncio.id}`)}
        className="group text-left"
      >
        <div className="relative aspect-square rounded-xl overflow-hidden bg-muted mb-2">
          {primeiraImagem ? (
            <img
              src={primeiraImagem.url}
              alt={anuncio.titulo}
              className={`w-full h-full object-cover transition-transform group-active:scale-105 ${isDoado ? "grayscale" : ""}`}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${isDoado ? "grayscale" : ""}`}>
              <span className="text-4xl">🎁</span>
            </div>
          )}

          {isDoado && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="bg-black/70 text-white text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-full">
                DOADO
              </span>
            </div>
          )}

          {isOwner ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setManageOpen(true);
              }}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center transition-transform active:scale-90"
              aria-label="Gerenciar doação"
            >
              <X className="h-4 w-4 text-foreground" />
            </button>
          ) : (
            <button
              onClick={(e) => {
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
          {anuncio.categoria && (
            <p className="text-xs text-primary font-medium">
              {anuncio.categoria.icone} {anuncio.categoria.nome}
            </p>
          )}
          <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
            {anuncio.titulo}
          </h3>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
      </button>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar doação</DialogTitle>
            <DialogDescription>Escolha uma ação para este item.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="secondary"
              onClick={() => markAsDoadoMutation.mutate()}
              disabled={markAsDoadoMutation.isPending || deleteMutation.isPending}
              className="w-full"
            >
              Marcar como doado
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={markAsDoadoMutation.isPending || deleteMutation.isPending}
              className="w-full"
            >
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DoacaoCard;
