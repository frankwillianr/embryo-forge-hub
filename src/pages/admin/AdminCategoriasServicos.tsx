import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  DEFAULT_SERVICO_CATEGORIAS,
  getFluent3dNameFromKey,
  getIconifyNameFromKey,
  getServicoAssetByIconKey,
  isFluent3dIconKey,
  isIconifyIconKey,
  slugifyValue,
  toFluent3dIconKey,
  type ServicoCategoria,
} from "@/lib/servicosCatalog";
import { FLUENT_EMOJI_3D_BY_SLUG, FLUENT_EMOJI_3D_LIBRARY } from "@/lib/fluentEmoji3dLibrary";

type Categoria = {
  id: string;
  slug: string;
  titulo: string;
  emoji: string | null;
  ordem: number | null;
  ativo: boolean | null;
  categorias_banco: string[] | null;
};

type Subcategoria = {
  id: string;
  categoria_id: string;
  slug: string;
  nome: string;
  emoji: string | null;
  icon_key: string | null;
  ordem: number | null;
  ativo: boolean | null;
};

type CatalogoCategoria = ServicoCategoria & {
  id?: string;
  categorias_banco?: string[];
};

type SubcategoriaForm = {
  id: string | null;
  categoriaId: string;
  categoriaSlug: string;
  nome: string;
  emoji: string;
  iconKey: string;
};

const emptyForm: SubcategoriaForm = {
  id: null,
  categoriaId: "",
  categoriaSlug: "",
  nome: "",
  emoji: "📌",
  iconKey: "",
};

const isTableNotFound = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  return (e.message || "").toLowerCase().includes("could not find the table");
};

const SubcategoriaIcon = ({
  iconKey,
  emoji,
  label,
  className,
}: {
  iconKey?: string | null;
  emoji?: string | null;
  label: string;
  className?: string;
}) => {
  if (iconKey && isIconifyIconKey(iconKey)) {
    const iconifyName = getIconifyNameFromKey(iconKey);
    if (iconifyName) {
      return <Icon icon={iconifyName} className={className || "h-5 w-5"} aria-label={label} />;
    }
  }

  if (iconKey && isFluent3dIconKey(iconKey)) {
    const fluentName = getFluent3dNameFromKey(iconKey);
    const src = FLUENT_EMOJI_3D_BY_SLUG.get(fluentName);
    if (src) {
      return <img src={src} alt={label} className={className || "h-6 w-6 object-contain"} />;
    }
  }

  const asset = getServicoAssetByIconKey(iconKey);
  if (asset) {
    return <img src={asset} alt={label} className={className || "h-6 w-6 object-contain"} />;
  }

  return <span className={className || "text-xl leading-none"}>{emoji || "📌"}</span>;
};

const AdminCategoriasServicos = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [form, setForm] = useState<SubcategoriaForm>(emptyForm);
  const [subToDelete, setSubToDelete] = useState<Subcategoria | null>(null);

  const {
    data: categoriasDb = [],
    isLoading: loadingCategorias,
    error: categoriasError,
  } = useQuery({
    queryKey: ["admin-servico-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servico_categoria")
        .select("id, slug, titulo, emoji, ordem, ativo, categorias_banco")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Categoria[];
    },
  });

  const {
    data: subcategoriasDbAll = [],
    isLoading: loadingSubcategoriasAll,
  } = useQuery({
    queryKey: ["admin-servico-subcategorias-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servico_subcategoria")
        .select("id, categoria_id, slug, nome, emoji, icon_key, ordem, ativo")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Subcategoria[];
    },
    enabled: !isTableNotFound(categoriasError),
  });

  const { data: empresaCategorias = [] } = useQuery({
    queryKey: ["admin-servico-empresas-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("categoria");
      if (error) throw error;
      return (data || [])
        .map((row) => row.categoria)
        .filter((categoria): categoria is string => !!categoria);
    },
  });

  const tableMissing = isTableNotFound(categoriasError);
  const hasCatalogAccessError = !!categoriasError && !tableMissing;

  const empresasCountByCategoria = useMemo(() => {
    const map = new Map<string, number>();
    empresaCategorias.forEach((slug) => {
      map.set(slug, (map.get(slug) || 0) + 1);
    });
    return map;
  }, [empresaCategorias]);

  const catalogoAtual = useMemo(() => {
    if (!tableMissing && categoriasDb.length > 0) {
      const subPorCategoria = subcategoriasDbAll.reduce(
        (acc, sub) => {
          if (!acc[sub.categoria_id]) acc[sub.categoria_id] = [];
          acc[sub.categoria_id].push({
            id: sub.id,
            categoria_id: sub.categoria_id,
            slug: sub.slug,
            nome: sub.nome,
            emoji: sub.emoji,
            icon_key: sub.icon_key,
            ordem: sub.ordem ?? 0,
            ativo: sub.ativo ?? true,
          });
          return acc;
        },
        {} as Record<string, ServicoCategoria["subcategorias"]>,
      );

      return categoriasDb.map((categoria) => ({
        id: categoria.id,
        slug: categoria.slug,
        titulo: categoria.titulo,
        emoji: categoria.emoji || "📌",
        ordem: categoria.ordem ?? 0,
        ativo: categoria.ativo ?? true,
        categorias_banco: categoria.categorias_banco || [],
        subcategorias: subPorCategoria[categoria.id] || [],
      }));
    }

    return DEFAULT_SERVICO_CATEGORIAS.map((categoria) => ({
      ...categoria,
      categorias_banco: categoria.categorias_banco || [],
    }));
  }, [tableMissing, categoriasDb, subcategoriasDbAll]);

  const filteredFluent3dIcons = useMemo(() => {
    const term = iconSearch.trim().toLowerCase();
    const base = !term
      ? FLUENT_EMOJI_3D_LIBRARY
      : FLUENT_EMOJI_3D_LIBRARY.filter((item) =>
          `${item.label} ${item.slug}`.toLowerCase().includes(term),
        );
    return base.slice(0, 400);
  }, [iconSearch]);

  const openCreateModal = async (categoria: CatalogoCategoria) => {
    if (hasCatalogAccessError) {
      const message =
        (categoriasError as { message?: string } | null)?.message ||
        "Erro de acesso ao catalogo de categorias.";
      toast.error(message);
      return;
    }

    let categoriaId = categoria.id || "";

    if (!categoriaId) {
      const existing = categoriasDb.find((item) => item.slug === categoria.slug);
      if (existing?.id) {
        categoriaId = existing.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("servico_categoria")
          .insert({
            slug: categoria.slug,
            titulo: categoria.titulo,
            emoji: categoria.emoji || "📌",
            ordem: categoria.ordem ?? 0,
            ativo: true,
            categorias_banco: categoria.categorias_banco || [],
          })
          .select("id")
          .single();

        if (error || !inserted?.id) {
          toast.error(error?.message || "Nao foi possivel preparar a categoria para cadastro.");
          return;
        }

        categoriaId = inserted.id;
        queryClient.invalidateQueries({ queryKey: ["admin-servico-categorias"] });
      }
    }

    setForm({
      ...emptyForm,
      categoriaId,
      categoriaSlug: categoria.slug || "",
      emoji: "📌",
      iconKey: "",
    });
    setIconSearch("");
    setModalOpen(true);
  };

  const openEditModal = (sub: Subcategoria) => {
    const categoria = catalogoAtual.find((item) => item.id === sub.categoria_id);
    setForm({
      id: sub.id,
      categoriaId: sub.categoria_id,
      categoriaSlug: categoria?.slug || "",
      nome: sub.nome,
      emoji: sub.emoji || "📌",
      iconKey: sub.icon_key || "",
    });
    setIconSearch("");
    setModalOpen(true);
  };

  const saveSubcategoriaMutation = useMutation({
    mutationFn: async (payload: SubcategoriaForm) => {
      const nome = payload.nome.trim();
      const slug = slugifyValue(nome);
      const resolvedCategoriaId = payload.categoriaId;

      if (!nome) throw new Error("Preencha o titulo da subcategoria.");
      if (!resolvedCategoriaId) throw new Error("Categoria nao identificada.");
      if (!slug) throw new Error("Titulo invalido para gerar o slug.");

      const { data: existingRows } = await supabase
        .from("servico_subcategoria")
        .select("ordem")
        .eq("categoria_id", resolvedCategoriaId)
        .order("ordem", { ascending: false })
        .limit(1);

      const nextOrder = (existingRows?.[0]?.ordem ?? -1) + 1;

      if (payload.id) {
        const { error } = await supabase
          .from("servico_subcategoria")
          .update({
            nome,
            slug,
            emoji: payload.iconKey ? null : payload.emoji || "📌",
            icon_key: payload.iconKey || null,
          })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("servico_subcategoria")
          .insert({
            categoria_id: resolvedCategoriaId,
            nome,
            slug,
            emoji: payload.iconKey ? null : payload.emoji || "📌",
            icon_key: payload.iconKey || null,
            ordem: nextOrder,
            ativo: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-servico-subcategorias-all"] });
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo-v2"] });
      toast.success(form.id ? "Subcategoria atualizada." : "Subcategoria criada.");
      setModalOpen(false);
      setForm(emptyForm);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao salvar subcategoria.");
    },
  });

  const deleteSubcategoriaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("servico_subcategoria")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-servico-subcategorias-all"] });
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo-v2"] });
      toast.success("Subcategoria removida.");
      setSubToDelete(null);
    },
    onError: () => {
      toast.error("Erro ao remover subcategoria.");
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveSubcategoriaMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Categorias de servicos</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Lista de categorias e subcategorias cadastradas no sistema.
        </p>
      </div>

      {tableMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          As tabelas de catalogo ainda nao existem no banco. Exibindo lista padrao do sistema.
        </div>
      ) : null}
      {hasCatalogAccessError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Erro ao acessar catalogo no banco:{" "}
          {(categoriasError as { message?: string } | null)?.message || "falha desconhecida"}.
        </div>
      ) : null}

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Catalogo atual</h2>
        {loadingCategorias || loadingSubcategoriasAll ? (
          <p className="text-base text-muted-foreground">Carregando catalogo...</p>
        ) : (
          <div className="space-y-4">
            {catalogoAtual.map((categoria) => (
              <div key={categoria.slug} className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold leading-tight">
                      {categoria.emoji || "📌"} {categoria.titulo}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {categoria.subcategorias.length} subcategorias
                    </p>
                  </div>
                  {!tableMissing ? (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1"
                      onClick={() => openCreateModal(categoria)}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar subcategoria
                    </Button>
                  ) : null}
                </div>

                {categoria.subcategorias.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">Sem subcategorias.</p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {categoria.subcategorias.map((sub) => {
                      const subDb = subcategoriasDbAll.find((item) => item.id === sub.id);
                      return (
                        <div
                          key={sub.slug}
                          className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-medium">
                              <SubcategoriaIcon
                                iconKey={sub.icon_key}
                                emoji={sub.emoji}
                                label={sub.nome}
                                className="h-5 w-5 shrink-0"
                              />
                              <span className="truncate">{sub.nome}</span>
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {sub.slug} • {empresasCountByCategoria.get(sub.slug) || 0} empresas
                            </p>
                          </div>
                          {!tableMissing && subDb ? (
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModal(subDb)}
                                aria-label="Editar subcategoria"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setSubToDelete(subDb)}
                                aria-label="Remover subcategoria"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar subcategoria" : "Nova subcategoria"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto pr-1 max-h-[calc(90vh-90px)]">
            <div className="space-y-1">
              <Label>Categoria</Label>
              <p className="text-sm text-muted-foreground">
                {catalogoAtual.find((categoria) => categoria.id === form.categoriaId)?.titulo ||
                  catalogoAtual.find((categoria) => categoria.slug === form.categoriaSlug)?.titulo ||
                  "-"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Titulo da subcategoria</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex.: Eletricista"
              />
            </div>

            <div className="space-y-2">
              <Label>Icone selecionado</Label>
              <div className="flex h-14 min-w-14 items-center justify-center rounded-md border px-2 text-xl">
                <SubcategoriaIcon
                  iconKey={form.iconKey}
                  emoji={form.emoji}
                  label={form.nome || "Icone da subcategoria"}
                  className="h-8 w-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Busca de icones (Fluent 3D)</Label>
              <Input
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                placeholder="Buscar por nome..."
              />
            </div>

            <div className="space-y-2">
              <Label>Fluent 3D coloridos</Label>
              <p className="text-xs text-muted-foreground">
                Mostrando {filteredFluent3dIcons.length} de {FLUENT_EMOJI_3D_LIBRARY.length} icones.
              </p>
              <div className="max-h-72 overflow-y-auto rounded-md border p-2">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {filteredFluent3dIcons.map((item) => (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, iconKey: toFluent3dIconKey(item.slug) }))}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left ${
                        form.iconKey === toFluent3dIconKey(item.slug)
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:bg-muted/40"
                      }`}
                      title={item.label}
                    >
                      <img src={item.src} alt={item.label} className="h-6 w-6 shrink-0 object-contain" />
                      <span className="min-w-0 truncate text-xs">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Biblioteca de emojis</Label>
              <div className="rounded-md border p-2">
                <EmojiPicker
                  onEmojiClick={(emojiData) =>
                    setForm((prev) => ({
                      ...prev,
                      emoji: emojiData.emoji,
                      iconKey: "",
                    }))
                  }
                  width="100%"
                  height={320}
                  lazyLoadEmojis
                  searchDisabled={false}
                  skinTonesDisabled
                  previewConfig={{ showPreview: false }}
                  theme={Theme.LIGHT}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForm((prev) => ({ ...prev, iconKey: "" }))}
              >
                Usar emoji em vez de icone personalizado
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveSubcategoriaMutation.isPending}>
                {saveSubcategoriaMutation.isPending
                  ? "Salvando..."
                  : form.id
                    ? "Salvar alteracoes"
                    : "Criar subcategoria"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!subToDelete} onOpenChange={(open) => !open && setSubToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover subcategoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao vai excluir a subcategoria "{subToDelete?.nome}". Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!subToDelete) return;
                deleteSubcategoriaMutation.mutate(subToDelete.id);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCategoriasServicos;
