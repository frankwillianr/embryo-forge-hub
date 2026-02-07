import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, Pencil, Trash2, Upload, X, Image } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Cidade, CidadeInsert } from "@/types/cidade";
import { toast } from "sonner";

const AdminCidades = () => {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCidade, setEditingCidade] = useState<Cidade | null>(null);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Upload banner to storage
  const uploadBanner = async (file: File, cidadeSlug: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${cidadeSlug}-${Date.now()}.${fileExt}`;
    const filePath = `banners/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('cidade-banners')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('cidade-banners')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  // Create cidade
  const createMutation = useMutation({
    mutationFn: async (cidade: CidadeInsert) => {
      let bannerUrl = cidade.banner_url;

      if (bannerFile) {
        setIsUploading(true);
        try {
          bannerUrl = await uploadBanner(bannerFile, cidade.slug);
        } finally {
          setIsUploading(false);
        }
      }

      const { data, error } = await supabase
        .from("cidade")
        .insert({ ...cidade, banner_url: bannerUrl })
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
      let bannerUrl = cidade.banner_url;

      if (bannerFile) {
        setIsUploading(true);
        try {
          bannerUrl = await uploadBanner(bannerFile, cidade.slug);
        } finally {
          setIsUploading(false);
        }
      }

      const { data, error } = await supabase
        .from("cidade")
        .update({ nome: cidade.nome, slug: cidade.slug, banner_url: bannerUrl })
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
    setBannerFile(null);
    setBannerPreview(null);
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
        banner_url: bannerPreview || editingCidade.banner_url,
      });
    } else {
      createMutation.mutate({ nome, slug });
    }
  };

  const handleEdit = (cidade: Cidade) => {
    setEditingCidade(cidade);
    setNome(cidade.nome);
    setSlug(cidade.slug);
    setBannerPreview(cidade.banner_url || null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBanner = () => {
    setBannerFile(null);
    setBannerPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
          <DialogContent className="max-w-lg">
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
              
              {/* Banner Upload */}
              <div className="space-y-2">
                <Label>Banner</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {bannerPreview ? (
                  <div className="relative">
                    <img
                      src={bannerPreview}
                      alt="Preview do banner"
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={removeBanner}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  >
                    <Image className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      Clique para fazer upload
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending || isUploading}
                >
                  {isUploading ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-pulse" />
                      Enviando...
                    </>
                  ) : editingCidade ? "Salvar" : "Criar"}
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
              <TableHead className="w-[80px]">Banner</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
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
            ) : cidades?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhuma cidade cadastrada
                </TableCell>
              </TableRow>
            ) : (
              cidades?.map((cidade) => (
                <TableRow 
                  key={cidade.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/admin/cidades/${cidade.id}`)}
                >
                  <TableCell>
                    {cidade.banner_url ? (
                      <img
                        src={cidade.banner_url}
                        alt={cidade.nome}
                        className="w-16 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-10 bg-muted rounded flex items-center justify-center">
                        <Image className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(cidade);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(cidade.id);
                        }}
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
