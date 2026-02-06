import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import ImageUpload from "@/components/shared/ImageUpload";

const NovoDesapegaPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [condicao, setCondicao] = useState("usado");
  const [whatsapp, setWhatsapp] = useState("");
  const [imagens, setImagens] = useState<string[]>([]);

  // Buscar cidade
  const { data: cidade } = useQuery({
    queryKey: ["cidade", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Buscar categorias
  const { data: categorias } = useQuery({
    queryKey: ["desapega-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_desapega_categoria")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Criar anúncio
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!cidade?.id) throw new Error("Cidade não encontrada");

      // Criar anúncio
      const { data: anuncio, error: anuncioError } = await supabase
        .from("rel_cidade_desapega")
        .insert({
          cidade_id: cidade.id,
          categoria_id: categoriaId || null,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          preco: parseFloat(preco.replace(/\D/g, "")) / 100,
          condicao,
          whatsapp: whatsapp.replace(/\D/g, ""),
        })
        .select()
        .single();

      if (anuncioError) throw anuncioError;

      // Inserir imagens
      if (imagens.length > 0) {
        const imagensData = imagens.map((url, index) => ({
          anuncio_id: anuncio.id,
          url,
          ordem: index,
        }));

        const { error: imagensError } = await supabase
          .from("rel_cidade_desapega_imagem")
          .insert(imagensData);

        if (imagensError) throw imagensError;
      }

      return anuncio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["desapega"] });
      toast({
        title: "Anúncio criado!",
        description: "Seu anúncio foi publicado com sucesso.",
      });
      navigate(`/cidade/${slug}/desapega`);
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar anúncio",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePrecoChange = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(numbers) / 100 || 0);
    setPreco(formatted);
  };

  const handleWhatsappChange = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    let formatted = numbers;
    if (numbers.length > 2) {
      formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    }
    if (numbers.length > 7) {
      formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    setWhatsapp(formatted);
  };

  const isValid =
    titulo.trim().length >= 3 &&
    preco &&
    parseFloat(preco.replace(/\D/g, "")) > 0 &&
    whatsapp.replace(/\D/g, "").length === 11;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/cidade/${slug}/desapega`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Novo Anúncio</h1>
      </header>

      <main className="flex-1 p-4 space-y-6">
        {/* Fotos */}
        <div className="space-y-2">
          <Label>Fotos do produto</Label>
          <ImageUpload
            images={imagens}
            onChange={setImagens}
            maxImages={5}
            bucket="desapega"
            folder="anuncios"
          />
        </div>

        {/* Título */}
        <div className="space-y-2">
          <Label htmlFor="titulo">Título do anúncio *</Label>
          <Input
            id="titulo"
            placeholder="Ex: iPhone 12 64GB"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* Categoria */}
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categorias?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icone} {cat.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Condição */}
        <div className="space-y-2">
          <Label>Condição</Label>
          <Select value={condicao} onValueChange={setCondicao}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="novo">Novo</SelectItem>
              <SelectItem value="seminovo">Seminovo</SelectItem>
              <SelectItem value="usado">Usado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Preço */}
        <div className="space-y-2">
          <Label htmlFor="preco">Preço *</Label>
          <Input
            id="preco"
            placeholder="R$ 0,00"
            value={preco}
            onChange={(e) => handlePrecoChange(e.target.value)}
            inputMode="numeric"
          />
        </div>

        {/* Descrição */}
        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea
            id="descricao"
            placeholder="Descreva o produto, estado de conservação, etc..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={4}
            maxLength={1000}
          />
        </div>

        {/* WhatsApp */}
        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp para contato *</Label>
          <Input
            id="whatsapp"
            placeholder="(00) 00000-0000"
            value={whatsapp}
            onChange={(e) => handleWhatsappChange(e.target.value)}
            inputMode="tel"
          />
        </div>
      </main>

      {/* Footer */}
      <div className="sticky bottom-0 p-4 border-t border-border bg-card">
        <Button
          className="w-full"
          size="lg"
          disabled={!isValid || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Publicando...
            </>
          ) : (
            "Publicar anúncio"
          )}
        </Button>
      </div>
    </div>
  );
};

export default NovoDesapegaPage;
