import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Music2, Store, UserRound, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface AdminCidadeMusicaAoVivoProps {
  cidadeId: string;
}

type ViewMode = "bar" | "cantor";

interface Bar {
  id: string;
  nome_bar: string;
  logo: string | null;
  local: string | null;
}

interface Cantor {
  id: string;
  nome: string;
  instagram: string | null;
  foto: string | null;
}

const AdminCidadeMusicaAoVivo = ({ cidadeId: _cidadeId }: AdminCidadeMusicaAoVivoProps) => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("bar");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [barForm, setBarForm] = useState({
    nome_bar: "",
    logo: "",
    local: "",
  });

  const [cantorForm, setCantorForm] = useState({
    nome: "",
    instagram: "",
    foto: "",
  });

  const barsQueryKey = ["admin-musica-ao-vivo-bars"];
  const cantoresQueryKey = ["admin-musica-ao-vivo-cantores"];

  const { data: bars, isLoading: loadingBars } = useQuery({
    queryKey: barsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bar")
        .select("id, nome_bar, logo, local")
        .order("nome_bar", { ascending: true });
      if (error) throw error;
      return (data || []) as Bar[];
    },
    enabled: viewMode === "bar",
  });

  const { data: cantores, isLoading: loadingCantores } = useQuery({
    queryKey: cantoresQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cantor")
        .select("id, nome, instagram, foto")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as Cantor[];
    },
    enabled: viewMode === "cantor",
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (viewMode === "bar") {
        if (!barForm.nome_bar.trim()) {
          throw new Error("Nome do bar e obrigatorio");
        }

        const payload = {
          nome_bar: barForm.nome_bar.trim(),
          logo: barForm.logo.trim() || null,
          local: barForm.local.trim() || null,
        };

        if (editingId) {
          const { error } = await supabase.from("bar").update(payload).eq("id", editingId);
          if (error) throw error;
          return;
        }

        const { error } = await supabase.from("bar").insert(payload);
        if (error) throw error;
        return;
      }

      if (!cantorForm.nome.trim()) {
        throw new Error("Nome do cantor e obrigatorio");
      }

      const payload = {
        nome: cantorForm.nome.trim(),
        instagram: cantorForm.instagram.trim() || null,
        foto: cantorForm.foto.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase.from("cantor").update(payload).eq("id", editingId);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("cantor").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      if (viewMode === "bar") {
        queryClient.invalidateQueries({ queryKey: barsQueryKey });
        toast.success(editingId ? "Bar atualizado!" : "Bar criado!");
      } else {
        queryClient.invalidateQueries({ queryKey: cantoresQueryKey });
        toast.success(editingId ? "Cantor atualizado!" : "Cantor criado!");
      }
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erro ao salvar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (viewMode === "bar") {
        const { error } = await supabase.from("bar").delete().eq("id", id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("cantor").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (viewMode === "bar") {
        queryClient.invalidateQueries({ queryKey: barsQueryKey });
        toast.success("Bar excluido!");
      } else {
        queryClient.invalidateQueries({ queryKey: cantoresQueryKey });
        toast.success("Cantor excluido!");
      }
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  const isLoading = loadingBars || loadingCantores;

  const list = useMemo(() => {
    return viewMode === "bar" ? bars || [] : cantores || [];
  }, [bars, cantores, viewMode]);

  const resetForms = () => {
    setBarForm({ nome_bar: "", logo: "", local: "" });
    setCantorForm({ nome: "", instagram: "", foto: "" });
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    resetForms();
  };

  const openCreate = () => {
    setEditingId(null);
    resetForms();
    setDialogOpen(true);
  };

  const openEditBar = (item: Bar) => {
    setEditingId(item.id);
    setBarForm({
      nome_bar: item.nome_bar || "",
      logo: item.logo || "",
      local: item.local || "",
    });
    setCantorForm({ nome: "", instagram: "", foto: "" });
    setDialogOpen(true);
  };

  const openEditCantor = (item: Cantor) => {
    setEditingId(item.id);
    setCantorForm({
      nome: item.nome || "",
      instagram: item.instagram || "",
      foto: item.foto || "",
    });
    setBarForm({ nome_bar: "", logo: "", local: "" });
    setDialogOpen(true);
  };

  const title = viewMode === "bar" ? "Bar" : "Cantor";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Music2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Musica ao vivo</h3>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo {title}
        </Button>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <TabsList className="grid w-full max-w-[360px] grid-cols-2">
          <TabsTrigger value="bar" className="gap-1.5">
            <Store className="h-4 w-4" />
            Bar
          </TabsTrigger>
          <TabsTrigger value="cantor" className="gap-1.5">
            <UserRound className="h-4 w-4" />
            Cantor
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-medium text-foreground mb-1">Nenhum registro</p>
          <p className="text-muted-foreground text-sm">
            Cadastre o primeiro {title.toLowerCase()}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {viewMode === "bar" &&
            (list as Bar[]).map((item) => (
              <div key={item.id} className="rounded-xl bg-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-foreground">{item.nome_bar}</p>
                    {item.local && (
                      <p className="text-xs text-muted-foreground break-words">{item.local}</p>
                    )}
                    {item.logo && (
                      <p className="text-xs text-muted-foreground break-all">{item.logo}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => openEditBar(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 gap-1.5"
                      onClick={() => {
                        if (confirm("Excluir este bar?")) deleteMutation.mutate(item.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            ))}

          {viewMode === "cantor" &&
            (list as Cantor[]).map((item) => (
              <div key={item.id} className="rounded-xl bg-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-foreground">{item.nome}</p>
                    {item.instagram && (
                      <p className="text-xs text-muted-foreground break-all">@{item.instagram.replace(/^@/, "")}</p>
                    )}
                    {item.foto && (
                      <p className="text-xs text-muted-foreground break-all">{item.foto}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => openEditCantor(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 gap-1.5"
                      onClick={() => {
                        if (confirm("Excluir este cantor?")) deleteMutation.mutate(item.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px]">
          <DialogHeader>
            <DialogTitle>{editingId ? `Editar ${title}` : `Novo ${title}`}</DialogTitle>
          </DialogHeader>

          {viewMode === "bar" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do bar *</Label>
                <Input
                  value={barForm.nome_bar}
                  onChange={(e) => setBarForm((prev) => ({ ...prev, nome_bar: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Logo (URL)</Label>
                <Input
                  value={barForm.logo}
                  onChange={(e) => setBarForm((prev) => ({ ...prev, logo: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>Local</Label>
                <Input
                  value={barForm.local}
                  onChange={(e) => setBarForm((prev) => ({ ...prev, local: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={cantorForm.nome}
                  onChange={(e) => setCantorForm((prev) => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input
                  value={cantorForm.instagram}
                  onChange={(e) => setCantorForm((prev) => ({ ...prev, instagram: e.target.value }))}
                  placeholder="@usuario"
                />
              </div>
              <div className="space-y-2">
                <Label>Foto (URL)</Label>
                <Input
                  value={cantorForm.foto}
                  onChange={(e) => setCantorForm((prev) => ({ ...prev, foto: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCidadeMusicaAoVivo;
