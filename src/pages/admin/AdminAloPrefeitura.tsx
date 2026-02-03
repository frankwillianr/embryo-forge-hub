import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { AloPrefeitura } from "@/types/aloPrefeitura";

interface Cidade {
  id: string;
  nome: string;
  slug: string;
}

const AdminAloPrefeitura = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AloPrefeitura | null>(null);
  const [formData, setFormData] = useState({
    cidade_id: "",
    titulo: "",
    descricao: "",
    video_url: "",
  });

  // Busca cidades
  const { data: cidades = [] } = useQuery({
    queryKey: ["admin-cidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome, slug")
        .order("nome");
      if (error) throw error;
      return data as Cidade[];
    },
  });

  // Busca items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-alo-prefeitura"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AloPrefeitura[];
    },
  });

  // Mutation criar/editar
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        cidade_id: data.cidade_id,
        titulo: data.titulo,
        descricao: data.descricao || null,
        video_url: data.video_url || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("rel_cidade_alo_prefeitura")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rel_cidade_alo_prefeitura")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-alo-prefeitura"] });
      toast.success(editingItem ? "Publicação atualizada!" : "Publicação adicionada!");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao salvar");
    },
  });

  // Mutation deletar
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-alo-prefeitura"] });
      toast.success("Publicação removida!");
    },
    onError: () => {
      toast.error("Erro ao remover");
    },
  });

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      cidade_id: cidades[0]?.id || "",
      titulo: "",
      descricao: "",
      video_url: "",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: AloPrefeitura) => {
    setEditingItem(item);
    setFormData({
      cidade_id: item.cidade_id,
      titulo: item.titulo,
      descricao: item.descricao || "",
      video_url: item.video_url || "",
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cidade_id || !formData.titulo) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    saveMutation.mutate(formData);
  };

  const getCidadeNome = (cidadeId: string) => {
    return cidades.find((c) => c.id === cidadeId)?.nome || "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alô Prefeitura</h1>
          <p className="text-muted-foreground">Gerencie as publicações da prefeitura</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Publicação
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p>Nenhuma publicação cadastrada</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.titulo}</TableCell>
                  <TableCell>{getCidadeNome(item.cidade_id)}</TableCell>
                  <TableCell>
                    {new Date(item.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Publicação" : "Nova Publicação"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Cidade *</Label>
              <Select
                value={formData.cidade_id}
                onValueChange={(v) => setFormData({ ...formData, cidade_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a cidade" />
                </SelectTrigger>
                <SelectContent>
                  {cidades.map((cidade) => (
                    <SelectItem key={cidade.id} value={cidade.id}>
                      {cidade.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.titulo}
                onChange={(e) =>
                  setFormData({ ...formData, titulo: e.target.value })
                }
                placeholder="Título da publicação"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) =>
                  setFormData({ ...formData, descricao: e.target.value })
                }
                placeholder="Conteúdo da publicação..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Vídeo URL (YouTube)</Label>
              <Input
                value={formData.video_url}
                onChange={(e) =>
                  setFormData({ ...formData, video_url: e.target.value })
                }
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAloPrefeitura;
