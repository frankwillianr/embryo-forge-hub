import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Clock, CheckCircle, XCircle, Pencil, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface AdminCidadeAloPrefeituraProps {
  cidadeId: string;
}

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-amber-100 text-amber-700" },
  aprovado: { label: "Aprovado", color: "bg-green-100 text-green-700" },
  rejeitado: { label: "Rejeitado", color: "bg-red-100 text-red-700" },
};

const AdminCidadeAloPrefeitura = ({ cidadeId }: AdminCidadeAloPrefeituraProps) => {
  const queryClient = useQueryClient();
  const [editDialog, setEditDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editForm, setEditForm] = useState({ titulo: "", descricao: "", status: "pendente" });

  const { data: denuncias, isLoading } = useQuery({
    queryKey: ["admin-cidade-alo-prefeitura", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .select("*")
        .eq("cidade_id", cidadeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, any> }) => {
      const { error } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-alo-prefeitura", cidadeId] });
      toast.success("Denúncia atualizada!");
      setEditDialog(false);
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const handleStatusChange = (id: string, status: string) => {
    updateMutation.mutate({ id, payload: { status } });
  };

  const handleOpenEdit = (item: any) => {
    setSelectedItem(item);
    setEditForm({ titulo: item.titulo, descricao: item.descricao || "", status: item.status });
    setEditDialog(true);
  };

  const handleOpenDetail = (item: any) => {
    setSelectedItem(item);
    setDetailDialog(true);
  };

  const handleSaveEdit = () => {
    if (!selectedItem) return;
    updateMutation.mutate({
      id: selectedItem.id,
      payload: { titulo: editForm.titulo, descricao: editForm.descricao, status: editForm.status },
    });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (!denuncias || denuncias.length === 0) {
    return (
      <div className="text-center py-12">
        <Phone className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
        <h3 className="font-medium text-foreground mb-1">Nenhuma denúncia</h3>
        <p className="text-muted-foreground text-sm">
          Esta cidade ainda não possui denúncias do Alô Prefeitura.
        </p>
      </div>
    );
  }

  const pendentes = denuncias.filter((d: any) => d.status === "pendente");
  const aprovados = denuncias.filter((d: any) => d.status === "aprovado");
  const rejeitados = denuncias.filter((d: any) => d.status === "rejeitado");

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted rounded-xl p-4 text-center">
          <Clock className="h-5 w-5 mx-auto text-amber-500 mb-2" />
          <p className="text-2xl font-semibold text-foreground">{pendentes.length}</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </div>
        <div className="bg-muted rounded-xl p-4 text-center">
          <CheckCircle className="h-5 w-5 mx-auto text-green-500 mb-2" />
          <p className="text-2xl font-semibold text-foreground">{aprovados.length}</p>
          <p className="text-xs text-muted-foreground">Aprovados</p>
        </div>
        <div className="bg-muted rounded-xl p-4 text-center">
          <XCircle className="h-5 w-5 mx-auto text-red-500 mb-2" />
          <p className="text-2xl font-semibold text-foreground">{rejeitados.length}</p>
          <p className="text-xs text-muted-foreground">Rejeitados</p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {denuncias.map((item: any) => {
          const status = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.pendente;

          return (
            <div
              key={item.id}
              className="p-4 bg-muted rounded-xl space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{item.titulo}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {item.categoria && (
                      <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                        {item.categoria}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {item.bairro || "—"} • {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${status.color}`}>
                  {status.label}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => handleOpenDetail(item)}>
                  <Eye className="h-3.5 w-3.5" />
                  Ver
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => handleOpenEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
                {item.status !== "aprovado" && (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleStatusChange(item.id, "aprovado")}
                    disabled={updateMutation.isPending}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Aprovar
                  </Button>
                )}
                {item.status !== "rejeitado" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 gap-1.5"
                    onClick={() => handleStatusChange(item.id, "rejeitado")}
                    disabled={updateMutation.isPending}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Rejeitar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px]">
          <DialogHeader>
            <DialogTitle>Detalhes da Denúncia</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Título</Label>
                <p className="text-foreground font-medium">{selectedItem.titulo}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Descrição</Label>
                <p className="text-foreground text-sm whitespace-pre-wrap">{selectedItem.descricao || "Sem descrição"}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Bairro</Label>
                  <p className="text-foreground text-sm">{selectedItem.bairro || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <p className="text-foreground text-sm capitalize">{selectedItem.status}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Data</Label>
                  <p className="text-foreground text-sm">{new Date(selectedItem.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              {selectedItem.video_url && (
                <div>
                  <Label className="text-muted-foreground text-xs">Vídeo</Label>
                  <video src={selectedItem.video_url} controls className="w-full rounded-lg mt-1" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px]">
          <DialogHeader>
            <DialogTitle>Editar Denúncia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={editForm.titulo}
                onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={editForm.descricao}
                onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCidadeAloPrefeitura;
