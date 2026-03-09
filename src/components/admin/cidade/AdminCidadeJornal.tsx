import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, ExternalLink, Eye, Pencil, Trash2, X, Loader2, Video, Camera, Image } from "lucide-react";
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
  DialogDescription,
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

interface AdminCidadeJornalProps {
  cidadeId: string;
}

const categorias = [
  "geral", "politica", "esporte", "crime", "saude", "educacao",
  "economia", "cultura", "tecnologia", "meio_ambiente", "entretenimento",
];

const AdminCidadeJornal = ({ cidadeId }: AdminCidadeJornalProps) => {
  const queryClient = useQueryClient();
  const [detailDialog, setDetailDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    titulo: "",
    descricao: "",
    descricao_curta: "",
    fonte: "",
    categoria: "geral",
    ativo: true,
    video_url: "",
  });
  const [editImagens, setEditImagens] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: noticias, isLoading } = useQuery({
    queryKey: ["admin-cidade-jornal", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_jornal")
        .select("*")
        .eq("cidade_id", cidadeId)
        .order("data_noticia", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleOpenDetail = (item: any) => {
    setSelectedItem(item);
    setDetailDialog(true);
  };

  const handleOpenEdit = (item: any) => {
    setSelectedItem(item);
    setEditForm({
      titulo: item.titulo || "",
      descricao: item.descricao || "",
      descricao_curta: item.descricao_curta || "",
      fonte: item.fonte || "",
      categoria: item.categoria || "geral",
      ativo: item.ativo !== false,
      video_url: item.video_url || "",
    });
    setEditImagens(item.imagens || []);
    setEditDialog(true);
  };

  const handleRemoveImage = (index: number) => {
    setEditImagens((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddImageUrl = () => {
    const url = prompt("Cole a URL da imagem:");
    if (url && url.startsWith("http")) {
      setEditImagens((prev) => [...prev, url]);
    }
  };

  const handleRemoveVideo = () => {
    setEditForm((prev) => ({ ...prev, video_url: "" }));
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("rel_cidade_jornal")
        .update({
          titulo: editForm.titulo,
          descricao: editForm.descricao,
          descricao_curta: editForm.descricao_curta,
          fonte: editForm.fonte,
          categoria: editForm.categoria,
          ativo: editForm.ativo,
          video_url: editForm.video_url || null,
          imagens: editImagens,
        })
        .eq("id", selectedItem.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin-cidade-jornal", cidadeId] });
      toast.success("Notícia atualizada!");
      setEditDialog(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rel_cidade_jornal")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-jornal", cidadeId] });
      toast.success("Notícia removida!");
      setDetailDialog(false);
      setEditDialog(false);
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover esta notícia?")) {
      deleteMutation.mutate(id);
    }
  };

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("rel_cidade_jornal")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-jornal", cidadeId] });
      toast.success("Status atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (!noticias || noticias.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/30">
        <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">Nenhuma notícia cadastrada</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Esta cidade ainda não possui notícias do jornal.
        </p>
        <Button variant="outline" asChild>
          <a href="/admin/jornal">
            <ExternalLink className="h-4 w-4 mr-2" />
            Gerenciar Jornal
          </a>
        </Button>
      </div>
    );
  }

  const isYouTube = (url: string) => url?.includes("youtube.com") || url?.includes("youtu.be");

  const getYouTubeEmbed = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Notícias ({noticias.length})</h3>
        <Button variant="outline" size="sm" asChild>
          <a href="/admin/jornal">
            <ExternalLink className="h-4 w-4 mr-2" />
            Gerenciar
          </a>
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {noticias.map((item: any) => (
          <div key={item.id} className="p-3 bg-muted rounded-xl flex gap-3 items-start">
            {/* Thumbnail */}
            {item.imagens?.[0] && (
              <img src={item.imagens[0]} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground line-clamp-1">{item.titulo}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{item.categoria || "geral"}</Badge>
                <span className="text-[10px] text-muted-foreground">
                  {item.fonte} • {new Date(item.data_noticia || item.created_at).toLocaleDateString("pt-BR")}
                </span>
                {item.video_url && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                    <Video className="h-2.5 w-2.5" /> Vídeo
                  </Badge>
                )}
              </div>
              <div className="flex gap-1.5 mt-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleOpenDetail(item)}>
                  <Eye className="h-3 w-3" /> Ver
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleOpenEdit(item)}>
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
                <Button size="sm" variant={item.ativo ? "default" : "outline"} className="h-7 text-xs"
                  onClick={() => toggleAtivo.mutate({ id: item.id, ativo: !item.ativo })}>
                  {item.ativo ? "Ativo" : "Inativo"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== DETAIL DIALOG ===== */}
      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug">{selectedItem?.titulo}</DialogTitle>
            <DialogDescription className="text-xs">
              {selectedItem?.fonte} • {selectedItem?.data_noticia && new Date(selectedItem.data_noticia).toLocaleDateString("pt-BR")}
              {" • "}<span className="capitalize">{selectedItem?.categoria || "geral"}</span>
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              {/* Images */}
              {selectedItem.imagens?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectedItem.imagens.map((url: string, i: number) => (
                    <img key={i} src={url} alt={`Foto ${i + 1}`}
                      className="w-28 h-20 rounded-lg object-cover flex-shrink-0 border border-border" />
                  ))}
                </div>
              )}

              {/* Video */}
              {selectedItem.video_url && (
                <div>
                  <Label className="text-muted-foreground text-xs mb-1 block">Vídeo</Label>
                  {isYouTube(selectedItem.video_url) ? (
                    <iframe
                      src={getYouTubeEmbed(selectedItem.video_url) || ""}
                      className="w-full aspect-video rounded-lg"
                      allowFullScreen
                    />
                  ) : (
                    <video src={selectedItem.video_url} controls className="w-full rounded-lg aspect-video" />
                  )}
                </div>
              )}

              {/* Descrição curta */}
              {selectedItem.descricao_curta && (
                <div>
                  <Label className="text-muted-foreground text-xs">Descrição curta</Label>
                  <p className="text-sm text-foreground italic">{selectedItem.descricao_curta}</p>
                </div>
              )}

              {/* Descrição */}
              <div>
                <Label className="text-muted-foreground text-xs">Conteúdo</Label>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selectedItem.descricao || "Sem conteúdo"}</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => { setDetailDialog(false); handleOpenEdit(selectedItem); }}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleDelete(selectedItem.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Remover
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== EDIT DIALOG ===== */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Notícia</DialogTitle>
            <DialogDescription>Altere os campos desejados e salve.</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              {/* Título */}
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input value={editForm.titulo} onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })} />
              </div>

              {/* Descrição curta */}
              <div className="space-y-1.5">
                <Label>Descrição curta</Label>
                <Textarea value={editForm.descricao_curta}
                  onChange={(e) => setEditForm({ ...editForm, descricao_curta: e.target.value })} rows={2} />
              </div>

              {/* Descrição */}
              <div className="space-y-1.5">
                <Label>Conteúdo completo</Label>
                <Textarea value={editForm.descricao}
                  onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })} rows={6} />
              </div>

              {/* Fonte + Categoria */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fonte</Label>
                  <Input value={editForm.fonte} onChange={(e) => setEditForm({ ...editForm, fonte: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={editForm.categoria} onValueChange={(v) => setEditForm({ ...editForm, categoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => (
                        <SelectItem key={c} value={c}><span className="capitalize">{c.replace("_", " ")}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.ativo ? "ativo" : "inativo"}
                  onValueChange={(v) => setEditForm({ ...editForm, ativo: v === "ativo" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo (publicado)</SelectItem>
                    <SelectItem value="inativo">Inativo (oculto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ===== IMAGENS ===== */}
              <div className="space-y-2">
                <Label>Imagens ({editImagens.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {editImagens.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-border" />
                      <button type="button" onClick={() => handleRemoveImage(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={handleAddImageUrl}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary/50 transition-colors">
                    <Image className="h-5 w-5" />
                    <span className="text-[10px]">URL</span>
                  </button>
                </div>
              </div>

              {/* ===== VÍDEO ===== */}
              <div className="space-y-2">
                <Label>Vídeo</Label>
                {editForm.video_url ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden bg-black">
                      {isYouTube(editForm.video_url) ? (
                        <iframe
                          src={getYouTubeEmbed(editForm.video_url) || ""}
                          className="w-full aspect-video"
                          allowFullScreen
                        />
                      ) : (
                        <video src={editForm.video_url} controls className="w-full aspect-video object-contain" preload="metadata" />
                      )}
                      <button type="button" onClick={handleRemoveVideo}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <Input value={editForm.video_url} onChange={(e) => setEditForm({ ...editForm, video_url: e.target.value })}
                      placeholder="URL do vídeo" className="text-xs" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input value={editForm.video_url} onChange={(e) => setEditForm({ ...editForm, video_url: e.target.value })}
                      placeholder="Cole a URL do vídeo (YouTube ou upload direto)" />
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="destructive" size="sm" onClick={() => selectedItem && handleDelete(selectedItem.id)}
              disabled={saving}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setEditDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCidadeJornal;