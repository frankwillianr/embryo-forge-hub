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
import { useAuth } from "@/hooks/useAuth";

const CATEGORIAS_FALLBACK = [
  { id: "fallback-moveis", nome: "Móveis", icone: "🪑" },
  { id: "fallback-eletro", nome: "Eletrodomésticos", icone: "🔌" },
  { id: "fallback-roupas", nome: "Roupas", icone: "👕" },
  { id: "fallback-infantil", nome: "Infantil", icone: "🧸" },
  { id: "fallback-saude", nome: "Saúde", icone: "🩺" },
  { id: "fallback-outros", nome: "Outros", icone: "🎁" },
];

const NovaDoacaoPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [condicao, setCondicao] = useState("usado");
  const [whatsapp, setWhatsapp] = useState("");
  const [imagens, setImagens] = useState<string[]>([]);

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

  const { data: categorias } = useQuery({
    queryKey: ["doacoes-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_doacao_categoria")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const categoriasParaExibir = categorias && categorias.length > 0 ? categorias : CATEGORIAS_FALLBACK;
  const categoriaIdValida = categoriaId && !categoriaId.startsWith("fallback-") ? categoriaId : null;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!cidade?.id) throw new Error("Cidade não encontrada");
      if (!user?.id) throw new Error("Você precisa estar logado para criar uma doação");

      const { data: anuncio, error: anuncioError } = await supabase
        .from("rel_cidade_doacao")
        .insert({
          cidade_id: cidade.id,
          user_id: user.id,
          categoria_id: categoriaIdValida,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          condicao,
          whatsapp: whatsapp.replace(/\D/g, ""),
          status: "ativo",
        })
        .select("id")
        .single();

      if (anuncioError) throw anuncioError;

      if (imagens.length > 0) {
        const imagensData = imagens.map((url, index) => ({
          anuncio_id: anuncio.id,
          url,
          ordem: index,
        }));

        const { error: imagensError } = await supabase
          .from("rel_cidade_doacao_imagem")
          .insert(imagensData);

        if (imagensError) throw imagensError;
      }

      return anuncio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doacoes"] });
      toast({
        title: "Doação criada!",
        description: "Seu anúncio de doação foi publicado com sucesso.",
      });
      navigate(`/cidade/${slug}/doacoes`);
    },
    onError: (error: unknown) => {
      const rawMessage = error instanceof Error
        ? error.message
        : (error as { message?: string })?.message || "Tente novamente mais tarde.";
      const tableMissing = /could not find the table|rel_cidade_doacao|rel\.cidade_doacao/i.test(rawMessage);
      const message = tableMissing
        ? "Módulo de Doações não está criado no banco ainda. Execute as migrations do Supabase para habilitar."
        : rawMessage;
      toast({
        title: "Erro ao criar doação",
        description: message,
        variant: "destructive",
      });
    },
  });

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

  const isValid = titulo.trim().length >= 3 && whatsapp.replace(/\D/g, "").length === 11;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}/doacoes`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Nova Doação</h1>
      </header>

      <main className="flex-1 p-4 space-y-6">
        <div className="space-y-2">
          <Label>Fotos do item</Label>
          <ImageUpload images={imagens} onChange={setImagens} maxImages={5} bucket="desapega" folder="doacoes/anuncios" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="titulo">Título da doação *</Label>
          <Input
            id="titulo"
            placeholder="Ex: Cadeira de rodas em bom estado"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categoriasParaExibir.map((cat: any) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icone} {cat.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea
            id="descricao"
            placeholder="Descreva o item, estado e observações..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={4}
            maxLength={1000}
          />
        </div>

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
            "Publicar doação"
          )}
        </Button>
      </div>
    </div>
  );
};

export default NovaDoacaoPage;
