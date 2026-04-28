import { useEffect, useState } from "react";
import { EyeOff, Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ImageUpload from "@/components/shared/ImageUpload";

export type CatalogoProdutoForm = {
  id?: string;
  localId: string;
  nome: string;
  descricao: string;
  preco: string;
  fotoUrl: string;
  ativo: boolean;
};

interface EmpresaCatalogoProdutosEditorProps {
  produtos: CatalogoProdutoForm[];
  onChange: (produtos: CatalogoProdutoForm[]) => void;
}

const createProdutoVazio = (): CatalogoProdutoForm => ({
  localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  nome: "",
  descricao: "",
  preco: "",
  fotoUrl: "",
  ativo: true,
});

export const formatPrecoProdutoInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  const cents = Number(digits);
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

export const parsePrecoProduto = (preco: string) => {
  const normalized = preco.replace(/[^\d,]/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

export const formatPrecoProdutoFromValue = (value: number | string | null) => {
  if (value == null || value === "") return "";
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return "";
  return numberValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

export const prepararProdutosParaSalvar = (produtos: CatalogoProdutoForm[], empresaId: string) =>
  produtos
    .map((produto, index) => {
      const nome = produto.nome.trim();
      return {
        empresa_id: empresaId,
        nome: nome || `Produto ${index + 1}`,
        descricao: produto.descricao.trim() || null,
        preco: produto.preco.trim() ? parsePrecoProduto(produto.preco) : null,
        foto_url: produto.fotoUrl || null,
        ativo: produto.ativo,
        ordem: index,
      };
    });

const EmpresaCatalogoProdutosEditor = ({ produtos, onChange }: EmpresaCatalogoProdutosEditorProps) => {
  const [editingProduto, setEditingProduto] = useState<CatalogoProdutoForm | null>(null);
  const [draftProduto, setDraftProduto] = useState<CatalogoProdutoForm | null>(null);

  useEffect(() => {
    setDraftProduto(editingProduto ? { ...editingProduto } : null);
  }, [editingProduto]);

  const openNovoProduto = () => {
    setEditingProduto(createProdutoVazio());
  };

  const openEditarProduto = (produto: CatalogoProdutoForm) => {
    setEditingProduto(produto);
  };

  const removeProduto = (localId: string) => {
    onChange(produtos.filter((produto) => produto.localId !== localId));
    setEditingProduto(null);
  };

  const saveProduto = () => {
    if (!draftProduto) return;
    const produtoNormalizado = {
      ...draftProduto,
      nome: draftProduto.nome.trim(),
      descricao: draftProduto.descricao.trim(),
    };

    if (produtos.some((produto) => produto.localId === produtoNormalizado.localId)) {
      onChange(produtos.map((produto) => (produto.localId === produtoNormalizado.localId ? produtoNormalizado : produto)));
    } else {
      onChange([...produtos, produtoNormalizado]);
    }

    setEditingProduto(null);
  };

  const updateDraft = (patch: Partial<CatalogoProdutoForm>) => {
    setDraftProduto((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-foreground">Catalogo de produtos</h3>
          <p className="text-xs text-muted-foreground">
            Cadastre itens simples da loja: foto, nome, descricao e preco.
          </p>
          {produtos.length > 0 && (
            <p className="mt-1 text-xs font-medium text-foreground">
              {produtos.length} {produtos.length === 1 ? "produto cadastrado" : "produtos cadastrados"}
            </p>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={openNovoProduto}>
          <Plus className="h-4 w-4" />
          Produto
        </Button>
      </div>

      {produtos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
          <p className="text-sm font-medium text-foreground">Nenhum produto cadastrado ainda</p>
          <p className="text-xs text-muted-foreground mt-1">Adicione produtos para montar um catalogo basico da empresa.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {produtos.map((produto, index) => (
            <button
              key={produto.localId}
              type="button"
              onClick={() => openEditarProduto(produto)}
              className="relative overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition hover:shadow-md active:scale-[0.99]"
            >
              <div className="aspect-square bg-muted">
                {produto.fotoUrl ? (
                  <img src={produto.fotoUrl} alt={produto.nome || `Produto ${index + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              {!produto.ativo && (
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] text-white backdrop-blur-sm">
                  <EyeOff className="h-3 w-3" />
                  Oculto
                </span>
              )}
              <span className="absolute left-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md ring-1 ring-black/5">
                <Pencil className="h-4 w-4" />
              </span>
              <div className="space-y-1 p-3">
                <p className="line-clamp-1 text-sm font-semibold text-foreground">
                  {produto.nome || `Produto ${index + 1}`}
                </p>
                {produto.descricao && (
                  <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                    {produto.descricao}
                  </p>
                )}
                <p className="text-xs font-bold text-foreground">
                  {produto.preco || "Sem preco"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!editingProduto} onOpenChange={(open) => !open && setEditingProduto(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{produtos.some((produto) => produto.localId === editingProduto?.localId) ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>

          {draftProduto && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Foto do produto</Label>
                <ImageUpload
                  images={draftProduto.fotoUrl ? [draftProduto.fotoUrl] : []}
                  onChange={(images) => updateDraft({ fotoUrl: images[0] || "" })}
                  maxImages={1}
                  bucket="servicos"
                  folder="produtos"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={draftProduto.nome}
                    onChange={(e) => updateDraft({ nome: e.target.value })}
                    placeholder="Ex: Combo burger"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preco</Label>
                  <Input
                    value={draftProduto.preco}
                    onChange={(e) => updateDraft({ preco: formatPrecoProdutoInput(e.target.value) })}
                    placeholder="R$ 0,00"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descricao</Label>
                <Textarea
                  value={draftProduto.descricao}
                  onChange={(e) => updateDraft({ descricao: e.target.value })}
                  placeholder="Detalhes do produto, tamanho, variacoes, ingredientes..."
                  rows={3}
                  maxLength={500}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={draftProduto.ativo}
                  onChange={(e) => updateDraft({ ativo: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                Produto visivel no catalogo
              </label>
            </div>
          )}

          <DialogFooter className="gap-2">
            {editingProduto && produtos.some((produto) => produto.localId === editingProduto.localId) && (
              <Button type="button" variant="destructive" onClick={() => removeProduto(editingProduto.localId)} className="gap-2 sm:mr-auto">
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setEditingProduto(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveProduto} disabled={!draftProduto?.nome.trim()}>
              Salvar produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmpresaCatalogoProdutosEditor;
