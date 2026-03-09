import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Clock, CheckCircle, XCircle, Pencil, Eye, User, Camera, Video, X, Loader2 } from "lucide-react";
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
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  // Edit media state
  const [editImagens, setEditImagens] = useState<any[]>([]); // existing images from DB
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]); // new files to upload
  const [editVideoUrl, setEditVideoUrl] = useState<string | null>(null); // existing video URL
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null); // new video to upload
  const [saving, setSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { data: denuncias, isLoading } = useQuery({
    queryKey: ["admin-cidade-alo-prefeitura", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .select("*")
        .eq("cidade_id", cidadeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const itemIds = data.map((d: any) => d.id);
      const { data: imagensData } = await supabase
        .from("rel_cidade_alo_prefeitura_imagens")
        .select("*")
        .in("alo_prefeitura_id", itemIds)
        .order("ordem");

      const imagensPorItem = (imagensData || []).reduce((acc: any, img: any) => {
        if (!acc[img.alo_prefeitura_id]) acc[img.alo_prefeitura_id] = [];
        acc[img.alo_prefeitura_id].push(img);
        return acc;
      }, {} as Record<string, any[]>);

      // Fetch user profiles
      const userIds = [...new Set(data.filter((d: any) => d.user_id).map((d: any) => d.user_id))];
      let profilesPorUser: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, nome, email, foto_url")
          .in("id", userIds);
        profilesPorUser = (profilesData || []).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);
      }

      return data.map((d: any) => ({
        ...d,
        imagens: imagensPorItem[d.id] || [],
        profile: d.user_id ? profilesPorUser[d.user_id] || null : null,
      }));
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
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const handleStatusChange = (id: string, status: string) => {
    updateMutation.mutate({ id, payload: { status } });
  };

  const handleOpenEdit = (item: any) => {
    setSelectedItem(item);
    setEditForm({ titulo: item.titulo, descricao: item.descricao || "", status: item.status });
    setEditImagens([...(item.imagens || [])]);
    setNewImageFiles([]);
    setEditVideoUrl(item.video_url || null);
    setNewVideoFile(null);
    setEditDialog(true);
  };

  const handleOpenDetail = (item: any) => {
    setSelectedItem(item);
    setDetailDialog(true);
  };

  // Remove existing image from DB
  const handleRemoveExistingImage = async (imgId: string) => {
    setEditImagens((prev) => prev.filter((img) => img.id !== imgId));
  };

  // Remove new image file (not yet uploaded)
  const handleRemoveNewImage = (index: number) => {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Add new image files
  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = editImagens.length + newImageFiles.length + files.length;
    if (totalImages > 10) {
      toast.error("Máximo de 10 imagens permitido");
      return;
    }
    setNewImageFiles((prev) => [...prev, ...files]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  // Remove existing video
  const handleRemoveVideo = () => {
    setEditVideoUrl(null);
    setNewVideoFile(null);
  };

  // Add new video
  const handleAddVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const acceptedFormats = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];
    if (!acceptedFormats.includes(file.type)) {
      toast.error("Formato inválido. Use MP4, WebM ou MOV.");
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      toast.error("Vídeo muito grande. Máximo de 80MB.");
      return;
    }
    setNewVideoFile(file);
    setEditVideoUrl(null); // replace existing
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    setSaving(true);

    try {
      // 1. Update text fields
      const payload: Record<string, any> = {
        titulo: editForm.titulo,
        descricao: editForm.descricao,
        status: editForm.status,
      };

      // 2. Handle removed existing images (delete from DB)
      const originalImageIds = (selectedItem.imagens || []).map((img: any) => img.id);
      const keptImageIds = editImagens.map((img: any) => img.id);
      const removedImageIds = originalImageIds.filter((id: string) => !keptImageIds.includes(id));

      if (removedImageIds.length > 0) {
        await supabase
          .from("rel_cidade_alo_prefeitura_imagens")
          .delete()
          .in("id", removedImageIds);
      }

      // 3. Upload new images
      const currentMaxOrdem = editImagens.length;
      for (let i = 0; i < newImageFiles.length; i++) {
        const file = newImageFiles[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${selectedItem.id}/${Date.now()}_${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("alo-prefeitura")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Erro ao fazer upload:", uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("alo-prefeitura")
          .getPublicUrl(fileName);

        await supabase.from("rel_cidade_alo_prefeitura_imagens").insert({
          alo_prefeitura_id: selectedItem.id,
          imagem_url: publicUrl,
          ordem: currentMaxOrdem + i,
        });
      }

      // 4. Handle video
      if (newVideoFile) {
        // Upload new video
        const videoExt = newVideoFile.name.split(".").pop()?.toLowerCase() || "mp4";
        const videoFileName = `${selectedItem.id}/video_${Date.now()}.${videoExt}`;

        const { error: videoUploadError } = await supabase.storage
          .from("alo-prefeitura")
          .upload(videoFileName, newVideoFile);

        if (videoUploadError) {
          console.error("Erro ao fazer upload do vídeo:", videoUploadError);
        } else {
          const { data: { publicUrl: videoPublicUrl } } = supabase.storage
            .from("alo-prefeitura")
            .getPublicUrl(videoFileName);
          payload.video_url = videoPublicUrl;
        }
      } else if (!editVideoUrl && selectedItem.video_url) {
        // Video was removed
        payload.video_url = null;
      }

      // 5. Save
      const { error } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .update(payload)
        .eq("id", selectedItem.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin-cidade-alo-prefeitura", cidadeId] });
      toast.success("Denúncia atualizada com sucesso!");
      setEditDialog(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
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

  const UserInfo = ({ profile }: { profile: any }) => {
    if (!profile) {
      return (
        <div className="flex items-center gap-2.5 p-2.5 bg-background rounded-lg border border-border">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground italic">Usuário anônimo</p>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2.5 p-2.5 bg-background rounded-lg border border-border">
        {profile.foto_url ? (
          <img src={profile.foto_url} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{profile.nome || "Sem nome"}</p>
          <p className="text-xs text-muted-foreground truncate">{profile.email || ""}</p>
        </div>
      </div>
    );
  };

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
            <div key={item.id} className="p-4 bg-muted rounded-xl space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{item.titulo}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {item.profile && (
                      <span className="text-xs text-muted-foreground">{item.profile.nome}</span>
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

              {/* Thumbnails */}
              {item.imagens?.length > 0 && (
                <div className="flex gap-1.5">
                  {item.imagens.slice(0, 3).map((img: any, i: number) => (
                    <img key={img.id || i} src={img.imagem_url} alt="" className="w-12 h-12 rounded-md object-cover" />
                  ))}
                  {item.imagens.length > 3 && (
                    <div className="w-12 h-12 rounded-md bg-background/80 flex items-center justify-center text-xs text-muted-foreground font-medium">
                      +{item.imagens.length - 3}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => handleOpenDetail(item)}>
                  <Eye className="h-3.5 w-3.5" /> Ver
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => handleOpenEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                {item.status !== "aprovado" && (
                  <Button size="sm" className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleStatusChange(item.id, "aprovado")} disabled={updateMutation.isPending}>
                    <CheckCircle className="h-3.5 w-3.5" /> Aprovar
                  </Button>
                )}
                {item.status !== "rejeitado" && (
                  <Button size="sm" variant="destructive" className="h-8 gap-1.5"
                    onClick={() => handleStatusChange(item.id, "rejeitado")} disabled={updateMutation.isPending}>
                    <XCircle className="h-3.5 w-3.5" /> Rejeitar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== DETAIL DIALOG (read-only) ===== */}
      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Denúncia</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <UserInfo profile={selectedItem.profile} />

              <div>
                <Label className="text-muted-foreground text-xs">Título</Label>
                <p className="text-foreground font-medium">{selectedItem.titulo}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Descrição</Label>
                <p className="text-foreground text-sm whitespace-pre-wrap">{selectedItem.descricao || "Sem descrição"}</p>
              </div>
              <div className="flex gap-4 flex-wrap">
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

              {/* Images */}
              {selectedItem.imagens?.length > 0 && (
                <div>
                  <Label className="text-muted-foreground text-xs mb-2 block">Fotos ({selectedItem.imagens.length})</Label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedItem.imagens.map((img: any, i: number) => (
                      <img key={img.id || i} src={img.imagem_url} alt={`Foto ${i + 1}`}
                        className="w-24 h-24 rounded-lg object-cover flex-shrink-0 border border-border" />
                    ))}
                  </div>
                </div>
              )}

              {/* Video */}
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

      {/* ===== EDIT DIALOG (full CRUD) ===== */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Denúncia</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              {/* User info (read-only) */}
              <UserInfo profile={selectedItem.profile} />

              {/* Título */}
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={editForm.titulo}
                  onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })}
                />
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={editForm.descricao}
                  onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                  rows={4}
                />
              </div>

              {/* Status */}
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

              {/* ===== FOTOS (editable) ===== */}
              <div className="space-y-2">
                <Label>Fotos</Label>
                <div className="flex flex-wrap gap-2">
                  {/* Existing images */}
                  {editImagens.map((img: any) => (
                    <div key={img.id} className="relative">
                      <img src={img.imagem_url} alt="" className="w-20 h-20 object-cover rounded-lg border border-border" />
                      <button type="button" onClick={() => handleRemoveExistingImage(img.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {/* New image previews */}
                  {newImageFiles.map((file, index) => (
                    <div key={`new-${index}`} className="relative">
                      <img src={URL.createObjectURL(file)} alt="" className="w-20 h-20 object-cover rounded-lg border-2 border-primary/30" />
                      <button type="button" onClick={() => handleRemoveNewImage(index)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {/* Add button */}
                  <button type="button" onClick={() => imageInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary/50 transition-colors">
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px]">Adicionar</span>
                  </button>
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleAddImages} className="hidden" />
              </div>

              {/* ===== VÍDEO (editable) ===== */}
              <div className="space-y-2">
                <Label>Vídeo</Label>
                {editVideoUrl ? (
                  <div className="relative rounded-xl overflow-hidden bg-black">
                    <video src={editVideoUrl} className="w-full aspect-video object-contain" controls preload="metadata" />
                    <button type="button" onClick={handleRemoveVideo}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : newVideoFile ? (
                  <div className="relative rounded-xl overflow-hidden bg-black">
                    <video src={URL.createObjectURL(newVideoFile)} className="w-full aspect-video object-contain" controls preload="metadata" />
                    <button type="button" onClick={() => setNewVideoFile(null)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => videoInputRef.current?.click()}
                    className="w-full py-4 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors bg-muted/30">
                    <Video className="h-6 w-6" />
                    <span className="text-sm font-medium">Adicionar vídeo</span>
                    <span className="text-xs">MP4, WebM ou MOV (máx. 80MB)</span>
                  </button>
                )}
                <input ref={videoInputRef} type="file" accept=".mp4,.webm,.mov,.m4v" onChange={handleAddVideo} className="hidden" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
              ) : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCidadeAloPrefeitura;
