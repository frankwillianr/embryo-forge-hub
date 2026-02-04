import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

const NovaVagaPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    titulo: "",
    empresa: "",
    descricao: "",
    requisitos: "",
    salario: "",
    tipo_contrato: "clt",
    modalidade: "presencial",
    contato_whatsapp: "",
    contato_email: "",
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo.trim() || !formData.empresa.trim() || !formData.descricao.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha título, empresa e descrição.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.contato_whatsapp.trim() && !formData.contato_email.trim()) {
      toast({
        title: "Contato obrigatório",
        description: "Informe pelo menos um meio de contato (WhatsApp ou Email).",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("vagas").insert({
        cidade_id: cidade?.id,
        titulo: formData.titulo.trim(),
        empresa: formData.empresa.trim(),
        descricao: formData.descricao.trim(),
        requisitos: formData.requisitos.trim() || null,
        salario: formData.salario.trim() || null,
        tipo_contrato: formData.tipo_contrato,
        modalidade: formData.modalidade,
        contato_whatsapp: formData.contato_whatsapp.trim() || null,
        contato_email: formData.contato_email.trim() || null,
        ativo: true,
      });

      if (error) throw error;

      toast({
        title: "Vaga publicada!",
        description: "Sua vaga foi publicada com sucesso.",
      });

      navigate(`/cidade/${slug}/vagas`);
    } catch (error) {
      console.error("Error creating vaga:", error);
      toast({
        title: "Erro ao publicar",
        description: "Não foi possível publicar a vaga. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/cidade/${slug}/vagas`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">
              Nova Vaga
            </h1>
            <p className="text-xs text-muted-foreground">{cidade?.nome}</p>
          </div>
        </div>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-4 pb-24">
        {/* Icon Header */}
        <div className="flex justify-center py-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
            <Briefcase className="w-10 h-10 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="titulo">Título da Vaga *</Label>
          <Input
            id="titulo"
            name="titulo"
            placeholder="Ex: Vendedor(a), Auxiliar Administrativo..."
            value={formData.titulo}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="empresa">Nome da Empresa *</Label>
          <Input
            id="empresa"
            name="empresa"
            placeholder="Nome da empresa ou empregador"
            value={formData.empresa}
            onChange={handleChange}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Tipo de Contrato</Label>
            <Select
              value={formData.tipo_contrato}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, tipo_contrato: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clt">CLT</SelectItem>
                <SelectItem value="pj">PJ</SelectItem>
                <SelectItem value="temporario">Temporário</SelectItem>
                <SelectItem value="estagio">Estágio</SelectItem>
                <SelectItem value="freelancer">Freelancer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Modalidade</Label>
            <Select
              value={formData.modalidade}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, modalidade: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="remoto">Remoto</SelectItem>
                <SelectItem value="hibrido">Híbrido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="salario">Salário (opcional)</Label>
          <Input
            id="salario"
            name="salario"
            placeholder="Ex: R$ 2.000 a R$ 3.000 ou A combinar"
            value={formData.salario}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição da Vaga *</Label>
          <Textarea
            id="descricao"
            name="descricao"
            placeholder="Descreva as atividades e responsabilidades..."
            rows={4}
            value={formData.descricao}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="requisitos">Requisitos (opcional)</Label>
          <Textarea
            id="requisitos"
            name="requisitos"
            placeholder="Liste os requisitos e qualificações necessárias..."
            rows={3}
            value={formData.requisitos}
            onChange={handleChange}
          />
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-sm font-medium text-foreground mb-3">
            Contato para candidatura
          </p>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="contato_whatsapp">WhatsApp</Label>
              <Input
                id="contato_whatsapp"
                name="contato_whatsapp"
                placeholder="(00) 00000-0000"
                value={formData.contato_whatsapp}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contato_email">Email</Label>
              <Input
                id="contato_email"
                name="contato_email"
                type="email"
                placeholder="email@empresa.com"
                value={formData.contato_email}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Publicando..." : "Publicar Vaga"}
        </Button>
      </form>
    </div>
  );
};

export default NovaVagaPage;
