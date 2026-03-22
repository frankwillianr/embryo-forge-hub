import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ListChecks, X } from "lucide-react";
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

type EnqueteStatus = "rascunho" | "ativa" | "encerrada" | "cancelada";

type Cidade = {
  id: string;
  nome: string;
};

type Enquete = {
  id: string;
  cidade_id: string;
  pergunta: string;
  status: EnqueteStatus;
  data_inicio: string;
  data_fim: string;
  created_at: string;
};

type EnqueteOpcao = {
  id: string;
  enquete_id: string;
  texto: string;
  ordem: number;
};

type FormOpcao = {
  id?: string;
  key: string;
  texto: string;
};

type EnqueteListItem = Enquete & { opcoes: EnqueteOpcao[] };

const toInputDateTime = (iso?: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toIsoDateTime = (localDateTime: string) => {
  if (!localDateTime) return "";
  return new Date(localDateTime).toISOString();
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusLabel: Record<EnqueteStatus, string> = {
  rascunho: "Rascunho",
  ativa: "Ativa",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

const statusBadgeClass: Record<EnqueteStatus, string> = {
  rascunho: "bg-slate-100 text-slate-700",
  ativa: "bg-emerald-100 text-emerald-700",
  encerrada: "bg-amber-100 text-amber-700",
  cancelada: "bg-rose-100 text-rose-700",
};

const newOption = (): FormOpcao => ({
  key: crypto.randomUUID(),
  texto: "",
});

const AdminEnquete = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEnquete, setEditingEnquete] = useState<EnqueteListItem | null>(null);
  const [enqueteToDelete, setEnqueteToDelete] = useState<EnqueteListItem | null>(null);
  const [formData, setFormData] = useState({
    cidade_id: "",
    pergunta: "",
    status: "rascunho" as EnqueteStatus,
    data_inicio: "",
    data_fim: "",
    opcoes: [newOption(), newOption()] as FormOpcao[],
  });

  const { data: cidades = [] } = useQuery({
    queryKey: ["admin-enquete-cidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cidade").select("id, nome").order("nome");
      if (error) throw error;
      return (data || []) as Cidade[];
    },
  });

  const { data: enquetes = [], isLoading } = useQuery({
    queryKey: ["admin-enquetes"],
    queryFn: async () => {
      const { data: enquetesData, error: enquetesError } = await supabase
        .from("rel_cidade_enquete")
        .select("*")
        .order("created_at", { ascending: false });
      if (enquetesError) throw enquetesError;

      const rows = (enquetesData || []) as Enquete[];
      if (rows.length === 0) return [] as EnqueteListItem[];

      const enqueteIds = rows.map((item) => item.id);
      const { data: opcoesData, error: opcoesError } = await supabase
        .from("rel_cidade_enquete_opcao")
        .select("*")
        .in("enquete_id", enqueteIds)
        .order("ordem");
      if (opcoesError) throw opcoesError;

      const opcoesPorEnquete = (opcoesData || []).reduce(
        (acc, opcao) => {
          if (!acc[opcao.enquete_id]) acc[opcao.enquete_id] = [];
          acc[opcao.enquete_id].push(opcao as EnqueteOpcao);
          return acc;
        },
        {} as Record<string, EnqueteOpcao[]>,
      );

      return rows.map((enquete) => ({
        ...enquete,
        opcoes: opcoesPorEnquete[enquete.id] || [],
      }));
    },
  });

  const cidadesMap = useMemo(
    () => Object.fromEntries(cidades.map((cidade) => [cidade.id, cidade.nome])),
    [cidades],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const pergunta = formData.pergunta.trim();
      const dataInicioIso = toIsoDateTime(formData.data_inicio);
      const dataFimIso = toIsoDateTime(formData.data_fim);

      if (!formData.cidade_id || !pergunta || !dataInicioIso || !dataFimIso) {
        throw new Error("Preencha cidade, pergunta, inicio e fim.");
      }
      if (new Date(dataFimIso).getTime() <= new Date(dataInicioIso).getTime()) {
        throw new Error("Data de fim deve ser maior que data de inicio.");
      }

      const normalizedOptions = formData.opcoes
        .map((item) => ({ ...item, texto: item.texto.trim() }))
        .filter((item) => item.texto.length > 0)
        .filter((item, index, arr) => arr.findIndex((x) => x.texto.toLowerCase() === item.texto.toLowerCase()) === index);

      if (normalizedOptions.length < 2) {
        throw new Error("A enquete precisa de no minimo 2 alternativas.");
      }

      if (editingEnquete) {
        const { error: updateError } = await supabase
          .from("rel_cidade_enquete")
          .update({
            cidade_id: formData.cidade_id,
            pergunta,
            status: formData.status,
            data_inicio: dataInicioIso,
            data_fim: dataFimIso,
          })
          .eq("id", editingEnquete.id);
        if (updateError) throw updateError;

        const { data: existingOptions, error: existingError } = await supabase
          .from("rel_cidade_enquete_opcao")
          .select("id, texto, ordem")
          .eq("enquete_id", editingEnquete.id);
        if (existingError) throw existingError;

        const existingById = new Map((existingOptions || []).map((item) => [item.id, item]));
        const nextIds = new Set(normalizedOptions.filter((item) => item.id).map((item) => item.id as string));

        const deletes = (existingOptions || [])
          .filter((item) => !nextIds.has(item.id))
          .map((item) =>
            supabase.from("rel_cidade_enquete_opcao").delete().eq("id", item.id),
          );

        const updates = normalizedOptions
          .filter((item) => item.id)
          .map((item, index) => {
            const prev = existingById.get(item.id as string);
            if (prev && prev.texto === item.texto && prev.ordem === index) return null;
            return supabase
              .from("rel_cidade_enquete_opcao")
              .update({ texto: item.texto, ordem: index })
              .eq("id", item.id as string);
          })
          .filter((item): item is PromiseLike<any> => !!item);

        const inserts = normalizedOptions
          .filter((item) => !item.id)
          .map((item, index) => ({
            enquete_id: editingEnquete.id,
            texto: item.texto,
            ordem: index,
          }));

        if (deletes.length) {
          const results = await Promise.all(deletes);
          const hasError = results.find((result) => result.error);
          if (hasError?.error) throw hasError.error;
        }

        if (updates.length) {
          const results = await Promise.all(updates);
          const hasError = results.find((result) => result.error);
          if (hasError?.error) throw hasError.error;
        }

        if (inserts.length) {
          const { error: insertError } = await supabase
            .from("rel_cidade_enquete_opcao")
            .insert(inserts);
          if (insertError) throw insertError;
        }
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const { data: created, error: createError } = await supabase
        .from("rel_cidade_enquete")
        .insert({
          cidade_id: formData.cidade_id,
          pergunta,
          status: formData.status,
          data_inicio: dataInicioIso,
          data_fim: dataFimIso,
          created_by: authData.user?.id || null,
        })
        .select("id")
        .single();
      if (createError) throw createError;

      const optionsPayload = normalizedOptions.map((item, index) => ({
        enquete_id: created.id,
        texto: item.texto,
        ordem: index,
      }));
      const { error: optionsError } = await supabase
        .from("rel_cidade_enquete_opcao")
        .insert(optionsPayload);
      if (optionsError) throw optionsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-enquetes"] });
      toast.success(editingEnquete ? "Enquete atualizada!" : "Enquete criada!");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao salvar enquete");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rel_cidade_enquete").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-enquetes"] });
      toast.success("Enquete excluida!");
    },
    onError: () => {
      toast.error("Erro ao excluir enquete");
    },
  });

  const handleOpenCreate = () => {
    const cidadeSalva = typeof window !== "undefined" ? window.localStorage.getItem("admin:selectedCidadeId") || "" : "";
    const cidadeInicial = cidadeSalva || cidades[0]?.id || "";
    setEditingEnquete(null);
    setFormData({
      cidade_id: cidadeInicial,
      pergunta: "",
      status: "rascunho",
      data_inicio: "",
      data_fim: "",
      opcoes: [newOption(), newOption()],
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (enquete: EnqueteListItem) => {
    setEditingEnquete(enquete);
    setFormData({
      cidade_id: enquete.cidade_id,
      pergunta: enquete.pergunta,
      status: enquete.status,
      data_inicio: toInputDateTime(enquete.data_inicio),
      data_fim: toInputDateTime(enquete.data_fim),
      opcoes:
        enquete.opcoes.length > 0
          ? enquete.opcoes.map((opcao) => ({
              id: opcao.id,
              key: opcao.id,
              texto: opcao.texto,
            }))
          : [newOption(), newOption()],
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEnquete(null);
  };

  const updateOption = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      opcoes: prev.opcoes.map((item) => (item.key === key ? { ...item, texto: value } : item)),
    }));
  };

  const removeOption = (key: string) => {
    setFormData((prev) => {
      if (prev.opcoes.length <= 2) return prev;
      return {
        ...prev,
        opcoes: prev.opcoes.filter((item) => item.key !== key),
      };
    });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enquetes</h1>
          <p className="text-muted-foreground">Crie e gerencie enquetes por cidade</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Enquete
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : enquetes.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <ListChecks className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p>Nenhuma enquete cadastrada</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pergunta</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Alternativas</TableHead>
                <TableHead className="w-24">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enquetes.map((enquete) => (
                <TableRow key={enquete.id}>
                  <TableCell className="max-w-[360px]">
                    <div className="line-clamp-2 font-medium">{enquete.pergunta}</div>
                  </TableCell>
                  <TableCell>{cidadesMap[enquete.cidade_id] || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{formatDateTime(enquete.data_inicio)}</div>
                    <div>ate {formatDateTime(enquete.data_fim)}</div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass[enquete.status]}`}>
                      {statusLabel[enquete.status]}
                    </span>
                  </TableCell>
                  <TableCell>{enquete.opcoes.length}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(enquete)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEnqueteToDelete(enquete)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEnquete ? "Editar Enquete" : "Nova Enquete"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Cidade *</Label>
              <Select value={formData.cidade_id} onValueChange={(v) => setFormData((prev) => ({ ...prev, cidade_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a cidade" />
                </SelectTrigger>
                <SelectContent>
                  {cidades.map((cidade) => (
                    <SelectItem key={cidade.id} value={cidade.id}>
                      {cidade.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pergunta *</Label>
              <Textarea
                value={formData.pergunta}
                onChange={(e) => setFormData((prev) => ({ ...prev, pergunta: e.target.value }))}
                placeholder="Digite a pergunta da enquete"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v as EnqueteStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="encerrada">Encerrada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Inicio *</Label>
                <Input
                  type="datetime-local"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data_inicio: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Fim *</Label>
                <Input
                  type="datetime-local"
                  value={formData.data_fim}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data_fim: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Alternativas *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData((prev) => ({ ...prev, opcoes: [...prev.opcoes, newOption()] }))}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-2">
                {formData.opcoes.map((opcao, index) => (
                  <div key={opcao.key} className="flex items-center gap-2">
                    <div className="w-6 text-xs text-muted-foreground">{index + 1}.</div>
                    <Input
                      value={opcao.texto}
                      onChange={(e) => updateOption(opcao.key, e.target.value)}
                      placeholder={`Alternativa ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(opcao.key)}
                      disabled={formData.opcoes.length <= 2}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Minimo de 2 alternativas.</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editingEnquete ? "Salvar alteracoes" : "Criar enquete"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!enqueteToDelete} onOpenChange={(open) => !open && setEnqueteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir enquete?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A enquete e as alternativas serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!enqueteToDelete) return;
                deleteMutation.mutate(enqueteToDelete.id, {
                  onSuccess: () => setEnqueteToDelete(null),
                });
              }}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminEnquete;
