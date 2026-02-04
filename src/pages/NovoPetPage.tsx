import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import type { PetInsert, PetStatus, PetEspecie } from "@/types/pets";

const NovoPetPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    especie: "cachorro" as PetEspecie,
    raca: "",
    cor: "",
    descricao: "",
    status: "perdido" as PetStatus,
    local_visto: "",
    data_ocorrencia: new Date().toISOString().split("T")[0],
    contato_whatsapp: "",
    contato_nome: "",
  });

  // Fetch cidade
  const { data: cidade } = useQuery({
    queryKey: ["cidade", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!cidade) throw new Error("Cidade não encontrada");

      let foto_url: string | undefined;

      // Upload foto se existir
      if (fotoFile) {
        const fileExt = fotoFile.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `pets/${cidade.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(filePath, fotoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("uploads")
          .getPublicUrl(filePath);

        foto_url = urlData.publicUrl;
      }

      const petData: PetInsert = {
        cidade_id: cidade.id,
        nome: formData.nome.trim(),
        especie: formData.especie,
        raca: formData.raca.trim() || undefined,
        cor: formData.cor.trim(),
        descricao: formData.descricao.trim() || undefined,
        status: formData.status,
        local_visto: formData.local_visto.trim(),
        data_ocorrencia: formData.data_ocorrencia,
        foto_url,
        contato_whatsapp: formData.contato_whatsapp.trim(),
        contato_nome: formData.contato_nome.trim(),
      };

      const { error } = await supabase.from("rel_cidade_pets").insert(petData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pet cadastrado com sucesso!");
      navigate(`/cidade/${slug}/pets`);
    },
    onError: (error) => {
      console.error("Erro ao cadastrar pet:", error);
      toast.error("Erro ao cadastrar pet. Tente novamente.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.cor || !formData.local_visto || !formData.contato_whatsapp || !formData.contato_nome) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">Cadastrar Pet</h1>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-5">
        {/* Status */}
        <div className="space-y-2">
          <Label>O pet foi *</Label>
          <RadioGroup
            value={formData.status}
            onValueChange={(v) => setFormData({ ...formData, status: v as PetStatus })}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="perdido" id="perdido" />
              <Label htmlFor="perdido" className="font-normal cursor-pointer">Perdido</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="encontrado" id="encontrado" />
              <Label htmlFor="encontrado" className="font-normal cursor-pointer">Encontrado</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Foto */}
        <div className="space-y-2">
          <Label>Foto do Pet</Label>
          <div
            onClick={() => document.getElementById("foto-input")?.click()}
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            {fotoPreview ? (
              <img src={fotoPreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg mx-auto" />
            ) : (
              <div className="text-muted-foreground">
                <Upload className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Clique para adicionar foto</p>
              </div>
            )}
          </div>
          <input
            id="foto-input"
            type="file"
            accept="image/*"
            onChange={handleFotoChange}
            className="hidden"
          />
        </div>

        {/* Nome */}
        <div className="space-y-2">
          <Label htmlFor="nome">Nome do Pet *</Label>
          <Input
            id="nome"
            placeholder="Ex: Rex, Mia..."
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          />
        </div>

        {/* Espécie */}
        <div className="space-y-2">
          <Label>Espécie *</Label>
          <Select
            value={formData.especie}
            onValueChange={(v) => setFormData({ ...formData, especie: v as PetEspecie })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cachorro">🐕 Cachorro</SelectItem>
              <SelectItem value="gato">🐱 Gato</SelectItem>
              <SelectItem value="passaro">🐦 Pássaro</SelectItem>
              <SelectItem value="outro">🐾 Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Raça */}
        <div className="space-y-2">
          <Label htmlFor="raca">Raça</Label>
          <Input
            id="raca"
            placeholder="Ex: Labrador, Siamês..."
            value={formData.raca}
            onChange={(e) => setFormData({ ...formData, raca: e.target.value })}
          />
        </div>

        {/* Cor */}
        <div className="space-y-2">
          <Label htmlFor="cor">Cor *</Label>
          <Input
            id="cor"
            placeholder="Ex: Marrom, Preto e branco..."
            value={formData.cor}
            onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
          />
        </div>

        {/* Local */}
        <div className="space-y-2">
          <Label htmlFor="local">Local onde foi visto *</Label>
          <Input
            id="local"
            placeholder="Ex: Praça do Centro, Rua das Flores..."
            value={formData.local_visto}
            onChange={(e) => setFormData({ ...formData, local_visto: e.target.value })}
          />
        </div>

        {/* Data */}
        <div className="space-y-2">
          <Label htmlFor="data">Data da ocorrência *</Label>
          <Input
            id="data"
            type="date"
            value={formData.data_ocorrencia}
            onChange={(e) => setFormData({ ...formData, data_ocorrencia: e.target.value })}
          />
        </div>

        {/* Descrição */}
        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição adicional</Label>
          <Textarea
            id="descricao"
            placeholder="Características marcantes, comportamento, coleira..."
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            rows={3}
          />
        </div>

        {/* Contato */}
        <div className="space-y-2">
          <Label htmlFor="contato_nome">Seu nome *</Label>
          <Input
            id="contato_nome"
            placeholder="Seu nome para contato"
            value={formData.contato_nome}
            onChange={(e) => setFormData({ ...formData, contato_nome: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp *</Label>
          <Input
            id="whatsapp"
            placeholder="(33) 99999-9999"
            value={formData.contato_whatsapp}
            onChange={(e) => setFormData({ ...formData, contato_whatsapp: e.target.value })}
          />
        </div>

        <Button
          type="submit"
          className="w-full h-12"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Cadastrando..." : "Cadastrar Pet"}
        </Button>
      </form>
    </div>
  );
};

export default NovoPetPage;
