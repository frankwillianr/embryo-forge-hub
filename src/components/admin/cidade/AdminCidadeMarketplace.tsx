import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Clock, Edit, Loader2, PackageSearch, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type MarketplaceStatus =
  | "aguardando_aprovacao"
  | "aprovado"
  | "reprovado"
  | "vendido"
  | "removido"
  | "inativo";

type MarketplaceItem = {
  id: string;
  cidade_id: string;
  categoria_id: string | null;
  titulo: string;
  descricao: string | null;
  preco: number;
  condicao: string | null;
  whatsapp: string | null;
  status: MarketplaceStatus;
  created_at: string;
  user_id: string | null;
  categoria?: { id: string; nome: string; icone: string } | null;
  imagens?: { id: string; url: string; ordem: number }[];
};

interface AdminCidadeMarketplaceProps {
  cidadeId: string;
}

const statusLabels: Record<MarketplaceStatus, string> = {
  aguardando_aprovacao: "Aguardando aprovacao",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  vendido: "Vendido",
  removido: "Removido",
  inativo: "Inativo",
};

const statusClasses: Record<MarketplaceStatus, string> = {
  aguardando_aprovacao: "bg-amber-50 text-amber-700 border-amber-200",
  aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reprovado: "bg-red-50 text-red-700 border-red-200",
  vendido: "bg-blue-50 text-blue-700 border-blue-200",
  removido: "bg-zinc-100 text-zinc-700 border-zinc-200",
  inativo: "bg-slate-100 text-slate-700 border-slate-200",
};

const condicaoLabels: Record<string, string> = {
  novo: "Novo",
  seminovo: "Seminovo",
  usado: "Usado",
};

const formatPriceInput = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

const parseMoney = (value: string) => parseFloat(value.replace(/\D/g, "")) / 100;

const AdminCidadeMarketplace = ({ cidadeId }: AdminCidadeMarketplaceProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<MarketplaceStatus | "todos">("todos");
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [condicao, setCondicao] = useState("usado");
  const [whatsapp, setWhatsapp] = useState("");
  const [status, setStatus] = useState<MarketplaceStatus>("aguardando_aprovacao");

  const { data: categorias = [] } = useQuery({
    queryKey: ["admin-marketplace-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_desapega_categoria")
        .select("id, nome, icone")
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data as Array<{ id: string; nome: string; icone: string }>;
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-marketplace", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_desapega")
        .select(`
          id,
          cidade_id,
          categoria_id,
          titulo,
          descricao,
          preco,
          condicao,
          whatsapp,
          status,
          created_at,
          user_id,
          categoria:rel_cidade_desapega_categoria(id, nome, icone),
          imagens:rel_cidade_desapega_imagem(id, url, ordem)
        `)
        .eq("cidade_id", cidadeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MarketplaceItem[];
    },
    enabled: !!cidadeId,
  });

  const kpis = useMemo(
    () => ({
      aprovado: items.filter((item) => item.status === "aprovado").length,
      aguardando: items.filter((item) => item.status === "aguardando_aprovacao").length,
      reprovado: items.filter((item) => item.status === "reprovado").length,
    }),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === "todos" || item.status === statusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.titulo.toLowerCase().includes(normalizedSearch) ||
        item.descricao?.toLowerCase().includes(normalizedSearch) ||
        item.whatsapp?.includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [items, searchTerm, statusFilter]);

  useEffect(() => {
    if (!selectedItem) return;
    setTitulo(selectedItem.titulo ?? "");
    setDescricao(selectedItem.descricao ?? "");
    setPreco(formatPriceInput(Number(selectedItem.preco) || 0));
    setCategoriaId(selectedItem.categoria_id ?? "sem_categoria");
    setCondicao(selectedItem.condicao ?? "usado");
    setWhatsapp(selectedItem.whatsapp ?? "");
    setStatus(selectedItem.status ?? "aguardando_aprovacao");
  }, [selectedItem]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) throw new Error("Anuncio nao selecionado.");

      const cleanPreco = parseMoney(preco);
      const cleanWhatsapp = whatsapp.replace(/\D/g, "");

      if (titulo.trim().length < 3) throw new Error("Titulo deve ter ao menos 3 caracteres.");
      if (!cleanPreco || cleanPreco <= 0) throw new Error("Preco invalido.");

      const { data, error } = await supabase
        .from("rel_cidade_desapega")
        .update({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          preco: cleanPreco,
          categoria_id: categoriaId === "sem_categoria" ? null : categoriaId,
          condicao,
          whatsapp: cleanWhatsapp || null,
          status,
        })
        .eq("id", selectedItem.id)
        .eq("cidade_id", cidadeId)
        .select("id")
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error("Nenhum anuncio foi atualizado. Verifique sua permissao de admin.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-marketplace", cidadeId] });
      queryClient.invalidateQueries({ queryKey: ["desapega"] });
      toast.success("Anuncio atualizado com sucesso.");
      setSelectedItem(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Nao foi possivel atualizar.";
      toast.error(message);
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: MarketplaceStatus }) => {
      const { data, error } = await supabase
        .from("rel_cidade_desapega")
        .update({ status: nextStatus })
        .eq("id", id)
        .eq("cidade_id", cidadeId)
        .select("id")
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error("Nenhum anuncio foi atualizado. Verifique sua permissao de admin.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-marketplace", cidadeId] });
      queryClient.invalidateQueries({ queryKey: ["desapega"] });
      toast.success("Status atualizado.");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Nao foi possivel atualizar o status.";
      toast.error(message);
    },
  });

  const handlePrecoChange = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    setPreco(formatPriceInput(parseFloat(numbers) / 100 || 0));
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

  const getFirstImage = (item: MarketplaceItem) =>
    [...(item.imagens ?? [])].sort((a, b) => a.ordem - b.ordem)[0]?.url;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(price) || 0);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Marketplace</h2>
        <p className="text-sm text-gray-500">
          Modere os anuncios do Marketplace Local desta cidade.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "aprovado" ? "todos" : "aprovado")}
          className={cn(
            "rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
            statusFilter === "aprovado" && "ring-2 ring-emerald-500 ring-offset-2",
          )}
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">Aprovados</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-emerald-900">{kpis.aprovado}</p>
        </button>
        <button
          type="button"
          onClick={() =>
            setStatusFilter(statusFilter === "aguardando_aprovacao" ? "todos" : "aguardando_aprovacao")
          }
          className={cn(
            "rounded-xl border border-amber-100 bg-amber-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
            statusFilter === "aguardando_aprovacao" && "ring-2 ring-amber-500 ring-offset-2",
          )}
        >
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">Aguardando aprovacao</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-amber-900">{kpis.aguardando}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "reprovado" ? "todos" : "reprovado")}
          className={cn(
            "rounded-xl border border-red-100 bg-red-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
            statusFilter === "reprovado" && "ring-2 ring-red-500 ring-offset-2",
          )}
        >
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">Reprovados</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-red-900">{kpis.reprovado}</p>
        </button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por titulo, descricao ou WhatsApp"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as MarketplaceStatus | "todos")}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aguardando_aprovacao">Aguardando aprovacao</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="reprovado">Reprovado</SelectItem>
            <SelectItem value="vendido">Vendido</SelectItem>
            <SelectItem value="removido">Removido</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="overflow-hidden rounded-xl border">
          <div className="divide-y">
            {filteredItems.map((item) => {
              const firstImage = getFirstImage(item);
              return (
                <div key={item.id} className="flex flex-col gap-4 bg-white p-4 md:flex-row md:items-center">
                  <div className="flex flex-1 gap-4">
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {firstImage ? (
                        <img src={firstImage} alt={item.titulo} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <PackageSearch className="h-7 w-7 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{item.titulo}</h3>
                        <Badge variant="outline" className={statusClasses[item.status]}>
                          {statusLabels[item.status] || item.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-900">{formatPrice(item.preco)}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                        {item.descricao || "Sem descricao"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                        <span>{item.categoria ? `${item.categoria.icone} ${item.categoria.nome}` : "Sem categoria"}</span>
                        <span>{condicaoLabels[item.condicao || ""] || item.condicao || "Sem condicao"}</span>
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 md:items-end">
                    {item.status === "aguardando_aprovacao" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => changeStatusMutation.mutate({ id: item.id, nextStatus: "aprovado" })}
                          disabled={changeStatusMutation.isPending}
                        >
                          Aprovar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => changeStatusMutation.mutate({ id: item.id, nextStatus: "reprovado" })}
                          disabled={changeStatusMutation.isPending}
                        >
                          Reprovar
                        </Button>
                      </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setSelectedItem(item)} className="gap-2">
                      <Edit className="h-4 w-4" />
                      Editar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <PackageSearch className="mx-auto h-10 w-10 text-gray-300" />
          <h3 className="mt-3 font-medium text-gray-900">Nenhum anuncio encontrado</h3>
          <p className="mt-1 text-sm text-gray-500">
            Ajuste os filtros ou aguarde novos anuncios desta cidade.
          </p>
        </div>
      )}

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar anuncio do marketplace</DialogTitle>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Titulo *</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={100} />
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as MarketplaceStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aguardando_aprovacao">Aguardando aprovacao</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="reprovado">Reprovado</SelectItem>
                    <SelectItem value="vendido">Vendido</SelectItem>
                    <SelectItem value="removido">Removido</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Preco *</Label>
                <Input value={preco} onChange={(e) => handlePrecoChange(e.target.value)} inputMode="numeric" />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_categoria">Sem categoria</SelectItem>
                    {categorias.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icone} {cat.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Condicao</Label>
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

              <div className="space-y-2 md:col-span-2">
                <Label>Descricao</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={4}
                  maxLength={1000}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>WhatsApp</Label>
                <Input
                  value={whatsapp}
                  onChange={(e) => handleWhatsappChange(e.target.value)}
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)} disabled={updateMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar alteracoes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCidadeMarketplace;
