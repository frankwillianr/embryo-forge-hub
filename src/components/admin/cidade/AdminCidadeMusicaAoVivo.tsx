import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Music2, Store, UserRound, Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ImageUpload from "@/components/shared/ImageUpload";
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

type ViewMode = "bar" | "cantor" | "eventos";

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

interface EventoMusical {
  id: string;
  bar_id: string;
  cantor_id: string | null;
  data_evento: string;
  horario: string | null;
  estilo_musical: string | null;
  banner_evento: string | null;
  bar?: { id: string; nome_bar: string } | null;
  cantor?: { id: string; nome: string } | null;
}

const AdminCidadeMusicaAoVivo = ({ cidadeId: _cidadeId }: AdminCidadeMusicaAoVivoProps) => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("bar");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [barForm, setBarForm] = useState({ nome_bar: "", logo: "", local: "" });
  const [cantorForm, setCantorForm] = useState({ nome: "", instagram: "", foto: "" });
  const [eventoForm, setEventoForm] = useState({
    bar_id: "",
    cantor_id: "",
    data_evento: "",
    horario: "",
    estilo_musical: "",
    banner_evento: "",
  });

  const [barSearch, setBarSearch] = useState("");
  const [cantorSearch, setCantorSearch] = useState("");
  const [showBarSuggestions, setShowBarSuggestions] = useState(false);
  const [showCantorSuggestions, setShowCantorSuggestions] = useState(false);

  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [localidade, setLocalidade] = useState("");
  const [uf, setUf] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);

  const barsQueryKey = ["admin-musica-ao-vivo-bars"];
  const cantoresQueryKey = ["admin-musica-ao-vivo-cantores"];
  const eventosQueryKey = ["admin-musica-ao-vivo-eventos"];

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
    enabled: viewMode === "bar" || viewMode === "eventos",
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
    enabled: viewMode === "cantor" || viewMode === "eventos",
  });

  const { data: eventos, isLoading: loadingEventos } = useQuery({
    queryKey: eventosQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evento_musical")
        .select("id, bar_id, cantor_id, data_evento, horario, estilo_musical, banner_evento, bar:bar_id(id,nome_bar), cantor:cantor_id(id,nome)")
        .order("data_evento", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EventoMusical[];
    },
    enabled: viewMode === "eventos",
  });

  const { data: barOptions } = useQuery({
    queryKey: ["admin-musica-busca-bar", barSearch],
    queryFn: async () => {
      let query = supabase.from("bar").select("id, nome_bar").order("nome_bar", { ascending: true }).limit(8);
      if (barSearch.trim()) query = query.ilike("nome_bar", `%${barSearch.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: dialogOpen && viewMode === "eventos",
  });

  const { data: cantorOptions } = useQuery({
    queryKey: ["admin-musica-busca-cantor", cantorSearch],
    queryFn: async () => {
      let query = supabase.from("cantor").select("id, nome").order("nome", { ascending: true }).limit(8);
      if (cantorSearch.trim()) query = query.ilike("nome", `%${cantorSearch.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: dialogOpen && viewMode === "eventos",
  });

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 8);
    if (numbers.length <= 5) return numbers;
    return numbers.replace(/(\d{5})(\d{0,3})/, "$1-$2");
  };

  const buildLocalFromAddress = () => {
    const partes = [
      logradouro.trim(),
      numero.trim() ? `nº ${numero.trim()}` : "",
      complemento.trim(),
      bairro.trim(),
      localidade.trim() && uf.trim() ? `${localidade.trim()} - ${uf.trim()}` : localidade.trim(),
      cep.trim(),
    ].filter(Boolean);

    return partes.join(", ");
  };

  const buscarCep = async (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 8);
    setCep(formatCep(value));

    if (numbers.length < 8) {
      setLogradouro("");
      setBairro("");
      setLocalidade("");
      setUf("");
      return;
    }

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${numbers}/json/`);
      const data = await response.json();

      if (!data?.erro) {
        setLogradouro(data.logradouro || "");
        setBairro(data.bairro || "");
        setLocalidade(data.localidade || "");
        setUf(data.uf || "");
      } else {
        toast.error("CEP nao encontrado");
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast.error("Erro ao buscar CEP");
    } finally {
      setLoadingCep(false);
    }
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (viewMode === "bar") {
        if (!barForm.nome_bar.trim()) throw new Error("Nome do bar e obrigatorio");

        const localFinal = buildLocalFromAddress() || barForm.local.trim();
        const payload = {
          nome_bar: barForm.nome_bar.trim(),
          logo: barForm.logo.trim() || null,
          local: localFinal || null,
          cep: cep.replace(/\D/g, "") || null,
          logradouro: logradouro.trim() || null,
          numero: numero.trim() || null,
          complemento: complemento.trim() || null,
          bairro: bairro.trim() || null,
          cidade: localidade.trim() || null,
          uf: uf.trim() || null,
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

      if (viewMode === "cantor") {
        if (!cantorForm.nome.trim()) throw new Error("Nome do cantor e obrigatorio");

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
        return;
      }

      if (!eventoForm.bar_id || !eventoForm.data_evento || !eventoForm.horario || !eventoForm.estilo_musical.trim()) {
        throw new Error("Bar, data, hora e estilo musical sao obrigatorios");
      }

      const payload = {
        bar_id: eventoForm.bar_id,
        cantor_id: eventoForm.cantor_id || null,
        data_evento: eventoForm.data_evento,
        horario: eventoForm.horario,
        estilo_musical: eventoForm.estilo_musical.trim(),
        banner_evento: eventoForm.banner_evento.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase.from("evento_musical").update(payload).eq("id", editingId);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("evento_musical").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      if (viewMode === "bar") {
        queryClient.invalidateQueries({ queryKey: barsQueryKey });
        toast.success(editingId ? "Bar atualizado!" : "Bar criado!");
      } else if (viewMode === "cantor") {
        queryClient.invalidateQueries({ queryKey: cantoresQueryKey });
        toast.success(editingId ? "Cantor atualizado!" : "Cantor criado!");
      } else {
        queryClient.invalidateQueries({ queryKey: eventosQueryKey });
        toast.success(editingId ? "Evento atualizado!" : "Evento criado!");
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
      if (viewMode === "cantor") {
        const { error } = await supabase.from("cantor").delete().eq("id", id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("evento_musical").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (viewMode === "bar") {
        queryClient.invalidateQueries({ queryKey: barsQueryKey });
        toast.success("Bar excluido!");
      } else if (viewMode === "cantor") {
        queryClient.invalidateQueries({ queryKey: cantoresQueryKey });
        toast.success("Cantor excluido!");
      } else {
        queryClient.invalidateQueries({ queryKey: eventosQueryKey });
        toast.success("Evento excluido!");
      }
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  const resetForms = () => {
    setBarForm({ nome_bar: "", logo: "", local: "" });
    setCantorForm({ nome: "", instagram: "", foto: "" });
    setEventoForm({ bar_id: "", cantor_id: "", data_evento: "", horario: "", estilo_musical: "", banner_evento: "" });
    setBarSearch("");
    setCantorSearch("");
    setShowBarSuggestions(false);
    setShowCantorSuggestions(false);
    setCep("");
    setLogradouro("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setLocalidade("");
    setUf("");
    setLoadingCep(false);
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

  const openEditBar = (item: any) => {
    setEditingId(item.id);
    setBarForm({
      nome_bar: item.nome_bar || "",
      logo: item.logo || "",
      local: item.local || "",
    });
    setCep((item.cep || "")?.replace(/(\d{5})(\d{3})/, "$1-$2"));
    setLogradouro(item.logradouro || "");
    setNumero(item.numero || "");
    setComplemento(item.complemento || "");
    setBairro(item.bairro || "");
    setLocalidade(item.cidade || "");
    setUf(item.uf || "");
    setDialogOpen(true);
  };

  const openEditCantor = (item: Cantor) => {
    setEditingId(item.id);
    setCantorForm({ nome: item.nome || "", instagram: item.instagram || "", foto: item.foto || "" });
    setDialogOpen(true);
  };

  const openEditEvento = (item: EventoMusical) => {
    setEditingId(item.id);
    setEventoForm({
      bar_id: item.bar_id,
      cantor_id: item.cantor_id || "",
      data_evento: item.data_evento,
      horario: item.horario || "",
      estilo_musical: item.estilo_musical || "",
      banner_evento: item.banner_evento || "",
    });
    setBarSearch(item.bar?.nome_bar || "");
    setCantorSearch(item.cantor?.nome || "");
    setDialogOpen(true);
  };

  const title = viewMode === "bar" ? "Bar" : viewMode === "cantor" ? "Cantor" : "Evento";
  const isLoading = viewMode === "bar" ? loadingBars : viewMode === "cantor" ? loadingCantores : loadingEventos;

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
        <TabsList className="grid w-full max-w-[460px] grid-cols-3">
          <TabsTrigger value="bar" className="gap-1.5"><Store className="h-4 w-4" />Bar</TabsTrigger>
          <TabsTrigger value="cantor" className="gap-1.5"><UserRound className="h-4 w-4" />Cantor</TabsTrigger>
          <TabsTrigger value="eventos" className="gap-1.5"><CalendarDays className="h-4 w-4" />Eventos</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : viewMode === "bar" ? (
        !bars || bars.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum bar cadastrado.</div>
        ) : (
          <div className="space-y-3">
            {bars.map((item: any) => (
              <div key={item.id} className="rounded-xl bg-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-foreground">{item.nome_bar}</p>
                    {item.local && <p className="text-xs text-muted-foreground break-words">{item.local}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => openEditBar(item)}>
                      <Pencil className="h-3.5 w-3.5" />Editar
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8 gap-1.5" onClick={() => confirm("Excluir este bar?") && deleteMutation.mutate(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />Excluir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : viewMode === "cantor" ? (
        !cantores || cantores.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum cantor cadastrado.</div>
        ) : (
          <div className="space-y-3">
            {cantores.map((item) => (
              <div key={item.id} className="rounded-xl bg-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-foreground">{item.nome}</p>
                    {item.instagram && <p className="text-xs text-muted-foreground break-all">@{item.instagram.replace(/^@/, "")}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => openEditCantor(item)}>
                      <Pencil className="h-3.5 w-3.5" />Editar
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8 gap-1.5" onClick={() => confirm("Excluir este cantor?") && deleteMutation.mutate(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />Excluir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : !eventos || eventos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum evento cadastrado.</div>
      ) : (
        <div className="space-y-3">
          {eventos.map((item) => (
            <div key={item.id} className="rounded-xl bg-muted p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="font-medium text-foreground">{item.estilo_musical || "Sem estilo"}</p>
                  <p className="text-xs text-muted-foreground break-words">
                    {item.bar?.nome_bar || "Bar"} • {item.cantor?.nome || "Sem cantor"} • {item.data_evento} {item.horario ? `as ${item.horario}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => openEditEvento(item)}>
                    <Pencil className="h-3.5 w-3.5" />Editar
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8 gap-1.5" onClick={() => confirm("Excluir este evento?") && deleteMutation.mutate(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />Excluir
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? `Editar ${title}` : `Novo ${title}`}</DialogTitle>
          </DialogHeader>

          {viewMode === "bar" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do bar *</Label>
                <Input value={barForm.nome_bar} onChange={(e) => setBarForm((prev) => ({ ...prev, nome_bar: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Logo</Label>
                <ImageUpload images={barForm.logo ? [barForm.logo] : []} onChange={(images) => setBarForm((prev) => ({ ...prev, logo: images[0] || "" }))} maxImages={1} bucket="avatars" folder="musica-ao-vivo/bar" />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={cep} onChange={(e) => buscarCep(e.target.value)} placeholder="00000-000" />
                {loadingCep && <p className="text-xs text-muted-foreground">Buscando CEP...</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2"><Label>Rua</Label><Input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} placeholder="Rua/Avenida" /></div>
                <div className="space-y-2"><Label>Numero</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="123" /></div>
                <div className="space-y-2"><Label>Complemento</Label><Input value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Sala, loja..." /></div>
                <div className="space-y-2"><Label>Bairro</Label><Input value={bairro} onChange={(e) => setBairro(e.target.value)} /></div>
                <div className="space-y-2"><Label>Cidade</Label><Input value={localidade} onChange={(e) => setLocalidade(e.target.value)} /></div>
                <div className="space-y-2"><Label>UF</Label><Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} placeholder="MG" /></div>
              </div>
            </div>
          )}

          {viewMode === "cantor" && (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={cantorForm.nome} onChange={(e) => setCantorForm((prev) => ({ ...prev, nome: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Instagram</Label><Input value={cantorForm.instagram} onChange={(e) => setCantorForm((prev) => ({ ...prev, instagram: e.target.value }))} placeholder="@usuario" /></div>
              <div className="space-y-2"><Label>Foto</Label><ImageUpload images={cantorForm.foto ? [cantorForm.foto] : []} onChange={(images) => setCantorForm((prev) => ({ ...prev, foto: images[0] || "" }))} maxImages={1} bucket="avatars" folder="musica-ao-vivo/cantor" /></div>
            </div>
          )}

          {viewMode === "eventos" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Bar *</Label>
                <div className="relative">
                  <Input
                    value={barSearch}
                    onChange={(e) => { setBarSearch(e.target.value); setShowBarSuggestions(true); }}
                    onFocus={() => setShowBarSuggestions(true)}
                    onBlur={() => window.setTimeout(() => setShowBarSuggestions(false), 120)}
                    placeholder="Buscar bar"
                  />
                  {showBarSuggestions && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-auto py-1">
                      {(barOptions || []).map((opt: any) => (
                        <button
                          key={opt.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setEventoForm((prev) => ({ ...prev, bar_id: opt.id }));
                            setBarSearch(opt.nome_bar);
                            setShowBarSuggestions(false);
                          }}
                        >
                          {opt.nome_bar}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cantor (opcional)</Label>
                <div className="relative">
                  <Input
                    value={cantorSearch}
                    onChange={(e) => {
                      setCantorSearch(e.target.value);
                      setEventoForm((prev) => ({ ...prev, cantor_id: "" }));
                      setShowCantorSuggestions(true);
                    }}
                    onFocus={() => setShowCantorSuggestions(true)}
                    onBlur={() => window.setTimeout(() => setShowCantorSuggestions(false), 120)}
                    placeholder="Buscar cantor"
                  />
                  {showCantorSuggestions && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-auto py-1">
                      {(cantorOptions || []).map((opt: any) => (
                        <button
                          key={opt.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setEventoForm((prev) => ({ ...prev, cantor_id: opt.id }));
                            setCantorSearch(opt.nome);
                            setShowCantorSuggestions(false);
                          }}
                        >
                          {opt.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    setEventoForm((prev) => ({ ...prev, cantor_id: "" }));
                    setCantorSearch("");
                    setShowCantorSuggestions(false);
                  }}
                >
                  Remover cantor
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={eventoForm.data_evento}
                  onChange={(e) => setEventoForm((prev) => ({ ...prev, data_evento: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Hora *</Label>
                <Input
                  type="time"
                  value={eventoForm.horario}
                  onChange={(e) => setEventoForm((prev) => ({ ...prev, horario: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Estilo musical *</Label>
                <Input
                  value={eventoForm.estilo_musical}
                  onChange={(e) => setEventoForm((prev) => ({ ...prev, estilo_musical: e.target.value }))}
                  placeholder="Sertanejo, pagode, rock..."
                />
              </div>

              <div className="space-y-2">
                <Label>Banner do evento</Label>
                <ImageUpload
                  images={eventoForm.banner_evento ? [eventoForm.banner_evento] : []}
                  onChange={(images) => setEventoForm((prev) => ({ ...prev, banner_evento: images[0] || "" }))}
                  maxImages={1}
                  bucket="avatars"
                  folder="musica-ao-vivo/evento"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
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
