import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface AdminAloPrefeituraProps {
  forcedCidadeId?: string;
}

type StatusFilter = "all" | "pendente" | "aprovado" | "recusado";
type FormStatus = "pendente" | "aprovado" | "rejeitado";

const AdminAloPrefeitura = ({ forcedCidadeId }: AdminAloPrefeituraProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AloPrefeitura | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formData, setFormData] = useState({
    cidade_id: forcedCidadeId || "",
    titulo: "",
    descricao: "",
    video_url: "",
    status: "pendente" as FormStatus,
  });

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

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-alo-prefeitura", forcedCidadeId || "all"],
    queryFn: async () => {
      let query = supabase
        .from("rel_cidade_alo_prefeitura")
        .select("*")
        .order("created_at", { ascending: false });

      if (forcedCidadeId) {
        query = query.eq("cidade_id", forcedCidadeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as AloPrefeitura[];
      if (rows.length === 0) return [];

      const itemIds = rows.map((item) => item.id);
      const { data: imagensData, error: imagensError } = await supabase
        .from("rel_cidade_alo_prefeitura_imagens")
        .select("id, alo_prefeitura_id, imagem_url, ordem, created_at")
        .in("alo_prefeitura_id", itemIds)
        .order("ordem", { ascending: true });

      if (imagensError) throw imagensError;

      const imagensByItem = (imagensData || []).reduce((acc, img) => {
        if (!acc[img.alo_prefeitura_id]) acc[img.alo_prefeitura_id] = [];
        acc[img.alo_prefeitura_id].push(img);
        return acc;
      }, {} as Record<string, any[]>);

      return rows.map((item) => ({
        ...item,
        imagens: imagensByItem[item.id] || [],
      })) as AloPrefeitura[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        cidade_id: data.cidade_id,
        titulo: data.titulo,
        descricao: data.descricao || null,
        video_url: data.video_url || null,
        status: data.status,
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
      toast.success(editingItem ? "Publicacao atualizada!" : "Publicacao adicionada!");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao salvar");
    },
  });

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
      toast.success("Publicacao removida!");
    },
    onError: () => {
      toast.error("Erro ao remover");
    },
  });

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      cidade_id: forcedCidadeId || cidades[0]?.id || "",
      titulo: "",
      descricao: "",
      video_url: "",
      status: "pendente",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: AloPrefeitura) => {
    const normalizedEditStatus: FormStatus =
      item.status === "aprovado"
        ? "aprovado"
        : item.status === "rejeitado" || item.status === "recusado" || item.status === "recusada"
          ? "rejeitado"
          : "pendente";

    setEditingItem(item);
    setFormData({
      cidade_id: item.cidade_id,
      titulo: item.titulo,
      descricao: item.descricao || "",
      video_url: item.video_url || "",
      status: normalizedEditStatus,
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
      toast.error("Preencha os campos obrigatorios");
      return;
    }
    saveMutation.mutate(formData);
  };

  const getCidadeNome = (cidadeId: string) => {
    return cidades.find((c) => c.id === cidadeId)?.nome || "-";
  };

  const normalizeStatus = (status: string | null | undefined): "pendente" | "aprovado" | "recusado" => {
    if (status === "aprovado") return "aprovado";
    if (status === "rejeitado" || status === "recusado" || status === "recusada") return "recusado";
    return "pendente";
  };

  const stats = items.reduce(
    (acc, item) => {
      const normalized = normalizeStatus(item.status);
      acc[normalized] += 1;
      return acc;
    },
    { pendente: 0, aprovado: 0, recusado: 0 }
  );

  const filteredItems = items.filter((item) => {
    if (statusFilter === "all") return true;
    return normalizeStatus(item.status) === statusFilter;
  });

  const getStatusBadge = (status: string | null | undefined) => {
    const normalized = normalizeStatus(status);
    if (normalized === "aprovado") {
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Aprovada</Badge>;
    }
    if (normalized === "recusado") {
      return <Badge variant="destructive">Recusada</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Aguardando</Badge>;
  };

  const getYouTubeEmbedUrl = (url?: string | null) => {
    if (!url) return null;
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    return match?.[1] ? `https://www.youtube.com/embed/${match[1]}?rel=0` : null;
  };

  const isDirectVideoFile = (url?: string | null) => {
    if (!url) return false;
    return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {forcedCidadeId ? "Voz do Povo da cidade" : "Voz do Povo"}
          </h1>
          <p className="text-muted-foreground">Gerencie as publicacoes da prefeitura</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Publicacao
        </Button>
      </div>

      {items.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setStatusFilter("pendente")}
            className={`rounded-lg border p-4 text-left transition-colors ${
              statusFilter === "pendente" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <p className="text-sm text-muted-foreground">Aguardando aprovação</p>
            <p className="mt-1 text-2xl font-semibold">{stats.pendente}</p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("aprovado")}
            className={`rounded-lg border p-4 text-left transition-colors ${
              statusFilter === "aprovado" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <p className="text-sm text-muted-foreground">Aprovadas</p>
            <p className="mt-1 text-2xl font-semibold">{stats.aprovado}</p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("recusado")}
            className={`rounded-lg border p-4 text-left transition-colors ${
              statusFilter === "recusado" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <p className="text-sm text-muted-foreground">Recusadas</p>
            <p className="mt-1 text-2xl font-semibold">{stats.recusado}</p>
          </button>
        </div>
      )}

      {statusFilter !== "all" && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setStatusFilter("all")}>
            Limpar filtro
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Megaphone className="mx-auto mb-4 h-12 w-12 opacity-40" />
          <p>{items.length === 0 ? "Nenhuma publicacao cadastrada" : "Nenhuma publicacao neste filtro"}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titulo</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-24">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.titulo}</TableCell>
                  <TableCell>{getCidadeNome(item.cidade_id)}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell>{new Date(item.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Publicacao" : "Nova Publicacao"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Cidade *</Label>
              <Select
                value={formData.cidade_id}
                onValueChange={(v) => setFormData({ ...formData, cidade_id: v })}
                disabled={!!forcedCidadeId}
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
              <Label>Titulo *</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Titulo da publicacao"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v as FormStatus })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Aguardando aprovação</SelectItem>
                  <SelectItem value="aprovado">Aprovada</SelectItem>
                  <SelectItem value="rejeitado">Recusada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Conteudo da publicacao..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Video URL (YouTube)</Label>
              <Input
                value={formData.video_url}
                onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
              />
              {formData.video_url ? (
                <div className="overflow-hidden rounded-md border bg-muted/20">
                  {getYouTubeEmbedUrl(formData.video_url) ? (
                    <iframe
                      src={getYouTubeEmbedUrl(formData.video_url) || ""}
                      title="Preview do video"
                      className="w-full aspect-video"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  ) : isDirectVideoFile(formData.video_url) ? (
                    <video
                      src={formData.video_url}
                      className="w-full aspect-video"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <p className="p-3 text-xs text-muted-foreground">
                      Link informado nao suporta preview automatico.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            {editingItem && (editingItem.imagens?.length || 0) > 0 && (
              <div className="space-y-2">
                <Label>Imagens atuais</Label>
                <div className="grid grid-cols-3 gap-2">
                  {editingItem.imagens?.map((imagem) => (
                    <img
                      key={imagem.id}
                      src={imagem.imagem_url}
                      alt={`Imagem de ${editingItem.titulo}`}
                      className="h-24 w-full rounded-md border object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
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
