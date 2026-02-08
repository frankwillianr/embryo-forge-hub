import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Upload, X, Image, ChevronRight } from "lucide-react";
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
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Cidades</h1>
          <p className="text-gray-500 mt-1 text-sm">Gerencie as cidades do sistema</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => resetForm()}
              className="bg-black text-white hover:bg-gray-800 rounded-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Cidade
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-gray-900">
                {editingCidade ? "Editar Cidade" : "Nova Cidade"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-gray-700">Nome</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => handleNomeChange(e.target.value)}
                  placeholder="Nome da cidade"
                  required
                  className="border-gray-200 focus:border-gray-400 focus:ring-0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug" className="text-gray-700">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="slug-da-cidade"
                  required
                  className="border-gray-200 focus:border-gray-400 focus:ring-0"
                />
              </div>
              
              {/* Banner Upload */}
              <div className="space-y-2">
                <Label className="text-gray-700">Banner</Label>
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
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
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
                    className="w-full h-32 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-300 transition-colors bg-white"
                  >
                    <Image className="h-8 w-8 text-gray-300 mb-2" />
                    <span className="text-sm text-gray-400">
                      Clique para fazer upload
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={resetForm}
                  className="text-gray-600 hover:text-gray-900"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending || isUploading}
                  className="bg-black text-white hover:bg-gray-800"
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

      {/* Cards da lista */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : cidades?.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Nenhuma cidade cadastrada</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {cidades?.map((cidade) => (
              <div
                key={cidade.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/admin/cidades/${cidade.id}`)}
              >
                <div className="flex items-center gap-4">
                  {cidade.banner_url ? (
                    <img
                      src={cidade.banner_url}
                      alt={cidade.nome}
                      className="w-14 h-9 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-14 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Image className="h-4 w-4 text-gray-300" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{cidade.nome}</p>
                    <p className="text-sm text-gray-400">/{cidade.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-gray-600"
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
                    className="h-8 w-8 text-gray-400 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(cidade.id);
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCidades;
