import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Cidade, CidadeInsert } from "@/types/cidade";
import { toast } from "sonner";

const AdminCidades = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCidade, setEditingCidade] = useState<Cidade | null>(null);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const queryClient = useQueryClient();

  // Fetch cidades
  const { data: cidades, isLoading } = useQuery({
    queryKey: ["cidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("*")
        .order("nome");
      
      if (error) throw error;
      return data as Cidade[];
    },
  });

  // Create cidade
  const createMutation = useMutation({
    mutationFn: async (cidade: CidadeInsert) => {
      const { data, error } = await supabase
        .from("cidade")
        .insert(cidade)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cidades"] });
      toast.success("Cidade criada com sucesso!");
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar cidade: " + error.message);
    },
  });

  // Update cidade
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...cidade }: Cidade) => {
      const { data, error } = await supabase
        .from("cidade")
        .update({ nome: cidade.nome, slug: cidade.slug })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cidades"] });
      toast.success("Cidade atualizada com sucesso!");
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar cidade: " + error.message);
    },
  });

  // Delete cidade
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cidade")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cidades"] });
      toast.success("Cidade excluída com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir cidade: " + error.message);
    },
  });

  const resetForm = () => {
    setNome("");
    setSlug("");
    setEditingCidade(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingCidade) {
      updateMutation.mutate({
        ...editingCidade,
        nome,
        slug,
      });
    } else {
      createMutation.mutate({ nome, slug });
    }
  };

  const handleEdit = (cidade: Cidade) => {
    setEditingCidade(cidade);
    setNome(cidade.nome);
    setSlug(cidade.slug);
    setIsDialogOpen(true);
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNomeChange = (value: string) => {
    setNome(value);
    if (!editingCidade) {
      setSlug(generateSlug(value));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cidades</h1>
          <p className="text-muted-foreground mt-1">Gerencie as cidades do sistema</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Cidade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCidade ? "Editar Cidade" : "Nova Cidade"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => handleNomeChange(e.target.value)}
                  placeholder="Nome da cidade"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="slug-da-cidade"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingCidade ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : cidades?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhuma cidade cadastrada
                </TableCell>
              </TableRow>
            ) : (
              cidades?.map((cidade) => (
                <TableRow key={cidade.id}>
                  <TableCell className="font-medium">{cidade.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{cidade.slug}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(cidade.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(cidade)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(cidade.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminCidades;
