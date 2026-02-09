import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, X, Image, Video, Youtube, Upload } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Jornal, JornalInsert } from "@/types/jornal";
import type { Cidade } from "@/types/cidade";
import { toast } from "sonner";
import { format } from "date-fns";
import VideoUpload from "@/components/shared/VideoUpload";

const AdminJornal = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJornal, setEditingJornal] = useState<Jornal | null>(null);
  const [cidadeId, setCidadeId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fonte, setFonte] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [videoType, setVideoType] = useState<"youtube" | "upload">("youtube");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch cidades
  const { data: cidades = [] } = useQuery({
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

  // Fetch jornais
  const { data: jornais = [], isLoading } = useQuery({
    queryKey: ["admin-jornais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_jornal")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((j) => ({
        ...j,
        imagens: Array.isArray(j.imagens) ? j.imagens : [],
      })) as Jornal[];
    },
  });

  // Upload imagens
  const uploadImages = async (files: File[], jornalId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${jornalId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `imagens/${fileName}`;

      const { error } = await supabase.storage
        .from("jornal-imagens")
        .upload(filePath, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from("jornal-imagens")
        .getPublicUrl(filePath);

      urls.push(data.publicUrl);
    }
    return urls;
  };

  // Create jornal
  const createMutation = useMutation({
    mutationFn: async (jornal: JornalInsert) => {
      setIsUploading(true);
      try {
        // Upload imagens primeiro
        let imageUrls: string[] = [];
        if (imageFiles.length > 0) {
          // Precisamos de um ID temporário para o upload
          const tempId = crypto.randomUUID();
          imageUrls = await uploadImages(imageFiles, tempId);
        }

        const { data, error } = await supabase
          .from("rel_cidade_jornal")
          .insert({
            ...jornal,
            imagens: imageUrls,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jornais"] });
      toast.success("Notícia criada com sucesso!");
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar notícia: " + error.message);
    },
  });

  // Update jornal
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...jornal }: Jornal) => {
      setIsUploading(true);
      try {
        // Upload novas imagens
        let allImages = [...existingImages];
        if (imageFiles.length > 0) {
          const urls = await uploadImages(imageFiles, id);
          allImages = [...allImages, ...urls];
        }

        const { data, error } = await supabase
          .from("rel_cidade_jornal")
          .update({
            cidade_id: jornal.cidade_id,
            titulo: jornal.titulo,
            descricao: jornal.descricao,
            fonte: jornal.fonte,
            video_url: jornal.video_url,
            imagens: allImages,
          })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jornais"] });
      toast.success("Notícia atualizada com sucesso!");
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar notícia: " + error.message);
    },
  });

  // Delete jornal
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rel_cidade_jornal")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jornais"] });
      toast.success("Notícia excluída com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir notícia: " + error.message);
    },
  });

  // (imagens agora são gerenciadas na coluna JSON da tabela principal)

  const resetForm = () => {
    setCidadeId("");
    setTitulo("");
    setDescricao("");
    setFonte("");
    setVideoUrl("");
    setUploadedVideoUrl(null);
    setVideoType("youtube");
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
    setEditingJornal(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determina qual URL de vídeo usar baseado no tipo selecionado
    const finalVideoUrl = videoType === "upload" ? uploadedVideoUrl : (videoUrl || null);

    if (editingJornal) {
      updateMutation.mutate({
        ...editingJornal,
        cidade_id: cidadeId,
        titulo,
        descricao,
        fonte: fonte || null,
        video_url: finalVideoUrl,
      });
    } else {
      createMutation.mutate({
        cidade_id: cidadeId,
        titulo,
        descricao,
        fonte: fonte || undefined,
        video_url: finalVideoUrl || undefined,
      });
    }
  };

  const handleEdit = (jornal: Jornal) => {
    setEditingJornal(jornal);
    setCidadeId(jornal.cidade_id);
    setTitulo(jornal.titulo);
    setDescricao(jornal.descricao);
    setFonte(jornal.fonte || "");
    
    // Detecta se é URL do YouTube ou upload direto
    const isYoutubeUrl = jornal.video_url?.includes("youtube.com") || jornal.video_url?.includes("youtu.be");
    if (isYoutubeUrl) {
      setVideoType("youtube");
      setVideoUrl(jornal.video_url || "");
      setUploadedVideoUrl(null);
    } else if (jornal.video_url) {
      setVideoType("upload");
      setUploadedVideoUrl(jornal.video_url);
      setVideoUrl("");
    } else {
      setVideoType("youtube");
      setVideoUrl("");
      setUploadedVideoUrl(null);
    }
    
    setExistingImages(jornal.imagens || []);
    setImageFiles([]);
    setImagePreviews([]);
    setIsDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImageFiles((prev) => [...prev, ...files]);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeNewImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (url: string) => {
    setExistingImages((prev) => prev.filter((i) => i !== url));
  };

  const getCidadeNome = (cidadeId: string) => {
    return cidades.find((c) => c.id === cidadeId)?.nome || "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Jornal</h1>
          <p className="text-muted-foreground mt-1">Gerencie as notícias do jornal da cidade</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Notícia
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingJornal ? "Editar Notícia" : "Nova Notícia"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da notícia
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Select value={cidadeId} onValueChange={setCidadeId} required>
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
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Título da notícia"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descrição completa da notícia"
                  rows={5}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fonte">Fonte (opcional)</Label>
                <Input
                  id="fonte"
                  value={fonte}
                  onChange={(e) => setFonte(e.target.value)}
                  placeholder="Ex: G1, Jornal Local"
                />
              </div>

              {/* Vídeo - Abas YouTube ou Upload */}
              <div className="space-y-2">
                <Label>Vídeo (opcional)</Label>
                <Tabs value={videoType} onValueChange={(v) => setVideoType(v as "youtube" | "upload")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="youtube" className="flex items-center gap-2">
                      <Youtube className="h-4 w-4" />
                      YouTube
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="youtube" className="mt-3">
                    <Input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </TabsContent>
                  <TabsContent value="upload" className="mt-3">
                    <VideoUpload
                      videoUrl={uploadedVideoUrl}
                      onChange={setUploadedVideoUrl}
                      bucket="jornal-videos"
                      folder="uploads"
                      maxSizeMB={50}
                    />
                  </TabsContent>
                </Tabs>
              </div>

              {/* Imagens */}
              <div className="space-y-2">
                <Label>Imagens</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="grid grid-cols-3 gap-2">
                  {/* Imagens existentes */}
                  {existingImages.map((url, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={url}
                        alt="Imagem"
                        className="w-full h-24 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-5 w-5"
                        onClick={() => removeExistingImage(img)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  {/* Novas imagens */}
                  {imagePreviews.map((preview, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-24 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-5 w-5"
                        onClick={() => removeNewImage(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  {/* Botão adicionar */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  >
                    <Image className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Adicionar</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || isUploading || !cidadeId}
                >
                  {isUploading ? "Enviando..." : editingJornal ? "Salvar" : "Criar"}
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
              <TableHead className="w-[60px]">Img</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : jornais.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhuma notícia cadastrada
                </TableCell>
              </TableRow>
            ) : (
              jornais.map((jornal) => (
                <TableRow key={jornal.id}>
                  <TableCell>
                    {jornal.imagens?.[0]?.imagem_url ? (
                      <img
                        src={jornal.imagens[0].imagem_url}
                        alt={jornal.titulo}
                        className="w-12 h-8 object-cover rounded"
                      />
                    ) : jornal.video_url ? (
                      <div className="w-12 h-8 bg-muted rounded flex items-center justify-center">
                        <Video className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="w-12 h-8 bg-muted rounded flex items-center justify-center">
                        <Image className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {jornal.titulo}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getCidadeNome(jornal.cidade_id)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(jornal.created_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(jornal)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(jornal.id)}
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

export default AdminJornal;
