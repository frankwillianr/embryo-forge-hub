import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Plus, Pencil, Trash2, Star, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import ImageUpload from "@/components/shared/ImageUpload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface AdminCidadeEventosProps {
  cidadeId: string;
}

const emptyForm = {
  titulo: "",
  descricao: "",
  imagem_url: "",
  data_evento: "",
  horario: "",
  local_nome: "",
  local_endereco: "",
  categoria: "show",
  preco: "",
  link_ingresso: "",
  destaque: false,
  ativo: true,
};

const nullableText = (value?: string | null) => {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
};

const normalizeHorario = (value?: string | null) => {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const match = v.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) {
    throw new Error("Horario invalido. Use HH:mm (ex.: 20:00).");
  }
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
};

const normalizePreco = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^gratuito$/i.test(raw)) return 0;

  const cleaned = raw
    .replace(/r\$\s*/gi, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    throw new Error("Preco invalido. Use valor numerico (ex.: 50 ou 50,00).");
  }
  return parsed;
};

const buildEventoPayload = (form: typeof emptyForm) => {
  const titulo = String(form.titulo ?? "").trim();
  if (!titulo) throw new Error("Titulo e obrigatorio.");

  const dataEvento = String(form.data_evento ?? "").trim().slice(0, 10);
  if (!dataEvento) throw new Error("Data e obrigatoria.");

  return {
    titulo,
    descricao: nullableText(form.descricao),
    imagem_url: nullableText(form.imagem_url),
    data_evento: dataEvento,
    horario: normalizeHorario(form.horario),
    local_nome: nullableText(form.local_nome),
    local_endereco: nullableText(form.local_endereco),
    categoria: nullableText(form.categoria) ?? "show",
    preco: normalizePreco(form.preco),
    link_ingresso: nullableText(form.link_ingresso),
    destaque: Boolean(form.destaque),
    ativo: Boolean(form.ativo),
  };
};

const EVENT_CATEGORIES = [
  "show",
  "festival",
  "teatro",
  "stand-up",
  "festa",
  "esporte",
  "infantil",
  "gastronomia",
  "cultura",
  "outros",
];

const maskHorario = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const AdminCidadeEventos = ({ cidadeId }: AdminCidadeEventosProps) => {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [eventoToDelete, setEventoToDelete] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  const queryKey = ["admin-cidade-eventos", cidadeId];

  const { data: eventos, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_eventos")
        .select("*")
        .eq("cidade_id", cidadeId)
        .order("data_evento", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editing) {
        const { error } = await supabase
          .from("rel_cidade_eventos")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rel_cidade_eventos")
          .insert({ ...payload, cidade_id: cidadeId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(editing ? "Evento atualizado!" : "Evento criado!");
      closeDialog();
    },
    onError: (error: any) => toast.error(error?.message || "Erro ao salvar evento"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase
        .from("rel_cidade_eventos")
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) throw error;
      if (!count || count < 1) {
        throw new Error("Nenhum evento foi removido. Verifique permissao de DELETE (RLS).");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Evento removido!");
      setEventoToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erro ao remover");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("rel_cidade_eventos").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Status atualizado!");
    },
  });

  const closeDialog = () => {
    setDialog(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialog(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      titulo: item.titulo || "",
      descricao: item.descricao || "",
      imagem_url: item.imagem_url || "",
      data_evento: item.data_evento || "",
      horario: item.horario || "",
      local_nome: item.local_nome || "",
      local_endereco: item.local_endereco || "",
      categoria: item.categoria || "show",
      preco: item.preco ?? "",
      link_ingresso: item.link_ingresso || "",
      destaque: item.destaque || false,
      ativo: item.ativo ?? true,
    });
    setDialog(true);
  };

  const handleSave = () => {
    try {
      const payload = buildEventoPayload(form);
      saveMutation.mutate(payload);
    } catch (error: any) {
      toast.error(error?.message || "Dados invalidos no formulario");
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Shows e Eventos</h3>
        <Button size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="h-4 w-4" />
          Novo Evento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted rounded-xl p-4 text-center">
          <p className="text-2xl font-semibold text-foreground">{eventos?.length || 0}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="bg-muted rounded-xl p-4 text-center">
          <p className="text-2xl font-semibold text-foreground">
            {eventos?.filter((e: any) => e.ativo).length || 0}
          </p>
          <p className="text-xs text-muted-foreground">Ativos</p>
        </div>
        <div className="bg-muted rounded-xl p-4 text-center">
          <p className="text-2xl font-semibold text-foreground">
            {eventos?.filter((e: any) => e.destaque).length || 0}
          </p>
          <p className="text-xs text-muted-foreground">Destaques</p>
        </div>
      </div>

      {/* List */}
      {!eventos || eventos.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-medium text-foreground mb-1">Nenhum evento</h3>
          <p className="text-muted-foreground text-sm">Adicione o primeiro evento desta cidade.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {eventos.map((item: any) => (
            <div key={item.id} className="p-4 bg-muted rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                {item.imagem_url && (
                  <img src={item.imagem_url} alt={item.titulo} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground">{item.titulo}</p>
                    {item.destaque && (
                      <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{item.categoria || "show"}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.data_evento + "T00:00:00").toLocaleDateString("pt-BR")}
                      {item.horario && ` • ${item.horario}`}
                    </span>
                  </div>
                  {item.local_nome && (
                    <p className="text-xs text-muted-foreground mt-1">{item.local_nome}</p>
                  )}
                </div>
                <Badge variant={item.ativo ? "default" : "secondary"} className="text-xs flex-shrink-0">
                  {item.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => openEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={() => toggleMutation.mutate({ id: item.id, ativo: !item.ativo })}
                >
                  {item.ativo ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {item.ativo ? "Desativar" : "Ativar"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1.5"
                  onClick={() => setEventoToDelete(item)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={dialog} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Evento" : "Novo Evento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Imagem do Evento</Label>
              <ImageUpload
                images={form.imagem_url ? [form.imagem_url] : []}
                onChange={(images) => setForm({ ...form, imagem_url: images[0] || "" })}
                maxImages={1}
                bucket="avatars"
                folder={`eventos/${cidadeId}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={form.data_evento} onChange={(e) => setForm({ ...form, data_evento: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input
                  value={form.horario}
                  onChange={(e) => setForm({ ...form, horario: maskHorario(e.target.value) })}
                  placeholder="20:00"
                  inputMode="numeric"
                  maxLength={5}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input value={form.local_nome} onChange={(e) => setForm({ ...form, local_nome: e.target.value })} placeholder="Nome do local" />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={form.local_endereco} onChange={(e) => setForm({ ...form, local_endereco: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(value) => setForm({ ...form, categoria: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Preço</Label>
                <Input value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} placeholder="R$ 50,00 ou Gratuito" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Link do Ingresso</Label>
              <Input value={form.link_ingresso} onChange={(e) => setForm({ ...form, link_ingresso: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex items-center justify-between">
              <Label>Destaque</Label>
              <Switch checked={form.destaque} onCheckedChange={(v) => setForm({ ...form, destaque: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!eventoToDelete} onOpenChange={(open) => !open && setEventoToDelete(null)}>
        <AlertDialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao remove o evento permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!eventoToDelete?.id) return;
                deleteMutation.mutate(eventoToDelete.id);
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCidadeEventos;
