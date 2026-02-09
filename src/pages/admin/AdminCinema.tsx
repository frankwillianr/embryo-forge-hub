import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Film } from "lucide-react";
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
import type { Cinema } from "@/types/cinema";

interface Cidade {
  id: string;
  nome: string;
  slug: string;
}

const AdminCinema = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFilme, setEditingFilme] = useState<Cinema | null>(null);
  const [formData, setFormData] = useState({
    cidade_id: "",
    nome_filme: "",
    sinopse: "",
    nome_cinema: "",
    banner_url: "",
    trailer_url: "",
    horarios: "",
    duracao: "",
    genero: "",
    status: "em_cartaz" as "em_cartaz" | "em_breve",
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

  // Busca filmes
  const { data: filmes = [], isLoading } = useQuery({
    queryKey: ["admin-cinema"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_cinema")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Cinema[];
    },
  });

  // Mutation criar/editar
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        cidade_id: data.cidade_id,
        nome_filme: data.nome_filme,
        sinopse: data.sinopse || null,
        nome_cinema: data.nome_cinema,
        banner_url: data.banner_url || null,
        trailer_url: data.trailer_url || null,
        horarios: data.status === "em_cartaz" && data.horarios
          ? data.horarios.split(",").map((h) => h.trim())
          : [],
        duracao: data.duracao || null,
        genero: data.genero || null,
        status: data.status,
      };

      if (editingFilme) {
        const { error } = await supabase
          .from("rel_cidade_cinema")
          .update(payload)
          .eq("id", editingFilme.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rel_cidade_cinema")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cinema"] });
      toast.success(editingFilme ? "Filme atualizado!" : "Filme adicionado!");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao salvar filme");
    },
  });

  // Mutation deletar
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rel_cidade_cinema")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cinema"] });
      toast.success("Filme removido!");
    },
    onError: () => {
      toast.error("Erro ao remover filme");
    },
  });

  const handleOpenCreate = () => {
    setEditingFilme(null);
    setFormData({
      cidade_id: cidades[0]?.id || "",
      nome_filme: "",
      sinopse: "",
      nome_cinema: "",
      banner_url: "",
      trailer_url: "",
      horarios: "",
      duracao: "",
      genero: "",
      status: "em_cartaz",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (filme: Cinema) => {
    setEditingFilme(filme);
    setFormData({
      cidade_id: filme.cidade_id,
      nome_filme: filme.nome_filme,
      sinopse: filme.sinopse || "",
      nome_cinema: filme.nome_cinema,
      banner_url: filme.banner_url || "",
      trailer_url: filme.trailer_url || "",
      horarios: filme.horarios?.join(", ") || "",
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingFilme(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cidade_id || !formData.nome_filme || !formData.nome_cinema) {
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
          <h1 className="text-2xl font-bold text-foreground">Cinema</h1>
          <p className="text-muted-foreground">Gerencie os filmes em cartaz</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Filme
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : filmes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Film className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p>Nenhum filme cadastrado</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filme</TableHead>
                <TableHead>Cinema</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Horários</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filmes.map((filme) => (
                <TableRow key={filme.id}>
                  <TableCell className="font-medium">{filme.nome_filme}</TableCell>
                  <TableCell>{filme.nome_cinema}</TableCell>
                  <TableCell>{getCidadeNome(filme.cidade_id)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {filme.horarios?.slice(0, 3).map((h, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full bg-muted"
                        >
                          {h}
                        </span>
                      ))}
                      {filme.horarios && filme.horarios.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{filme.horarios.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(filme)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(filme.id)}
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
              {editingFilme ? "Editar Filme" : "Novo Filme"}
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
              <Label>Nome do Filme *</Label>
              <Input
                value={formData.nome_filme}
                onChange={(e) =>
                  setFormData({ ...formData, nome_filme: e.target.value })
                }
                placeholder="Ex: Vingadores: Ultimato"
              />
            </div>

            <div className="space-y-2">
              <Label>Nome do Cinema *</Label>
              <Input
                value={formData.nome_cinema}
                onChange={(e) =>
                  setFormData({ ...formData, nome_cinema: e.target.value })
                }
                placeholder="Ex: Cinemark Shopping"
              />
            </div>

            <div className="space-y-2">
              <Label>Sinopse</Label>
              <Textarea
                value={formData.sinopse}
                onChange={(e) =>
                  setFormData({ ...formData, sinopse: e.target.value })
                }
                placeholder="Breve descrição do filme..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Banner URL</Label>
                <Input
                  value={formData.banner_url}
                  onChange={(e) =>
                    setFormData({ ...formData, banner_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>Trailer URL (YouTube)</Label>
                <Input
                  value={formData.trailer_url}
                  onChange={(e) =>
                    setFormData({ ...formData, trailer_url: e.target.value })
                  }
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Horários (separados por vírgula)</Label>
              <Input
                value={formData.horarios}
                onChange={(e) =>
                  setFormData({ ...formData, horarios: e.target.value })
                }
                placeholder="14:00, 17:30, 21:00"
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

export default AdminCinema;
