import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Pencil,
  Filter,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import EmpresaEditModal from "./EmpresaEditModal";
import EmpresaCreateModal from "./EmpresaCreateModal";

type EmpresaStatus = "aguardando_pagamento" | "pendente" | "ativo" | "recusado" | "expirado";

interface AdminCidadeEmpresasProps {
  cidadeId: string;
}

interface Empresa {
  id: string;
  nome: string;
  whatsapp: string;
  categoria: string;
  status: EmpresaStatus;
  created_at: string;
  data_inicio: string | null;
  data_fim: string | null;
}

const statusConfig: Record<EmpresaStatus, { label: string; color: string; icon: React.ReactNode }> = {
  aguardando_pagamento: {
    label: "Aguardando Pagamento",
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    icon: <CreditCard className="h-3 w-3" />,
  },
  pendente: {
    label: "Pendente",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: <Clock className="h-3 w-3" />,
  },
  ativo: {
    label: "Ativo",
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  recusado: {
    label: "Recusado",
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    icon: <XCircle className="h-3 w-3" />,
  },
  expirado: {
    label: "Expirado",
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    icon: <Clock className="h-3 w-3" />,
  },
};

const AdminCidadeEmpresas = ({ cidadeId }: AdminCidadeEmpresasProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "ativos_hoje" | "expirados">("all");
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [actionType, setActionType] = useState<"aprovar" | "recusar" | null>(null);
  const [editingEmpresaId, setEditingEmpresaId] = useState<string | null>(null);
  const [creatingEmpresa, setCreatingEmpresa] = useState(false);

  // Fetch empresas for this city
  const { data: empresas, isLoading } = useQuery({
    queryKey: ["admin-cidade-empresas", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome, whatsapp, categoria, status, created_at, data_inicio, data_fim")
        .eq("cidade_id", cidadeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Empresa[];
    },
    enabled: !!cidadeId,
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, aprovar }: { id: string; status: EmpresaStatus; aprovar?: boolean }) => {
      const updates: Record<string, unknown> = { status };
      
      if (aprovar) {
        const hoje = new Date();
        const fimAno = new Date(hoje);
        fimAno.setFullYear(fimAno.getFullYear() + 1);
        
        updates.data_inicio = hoje.toISOString().split("T")[0];
        updates.data_fim = fimAno.toISOString().split("T")[0];
      }

      const { error } = await supabase
        .from("rel_cidade_servico_empresa")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-empresas", cidadeId] });
      toast.success("Status atualizado com sucesso!");
      setSelectedEmpresa(null);
      setActionType(null);
    },
    onError: (error) => {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    },
  });

  const handleAction = () => {
    if (!selectedEmpresa || !actionType) return;

    if (actionType === "aprovar") {
      updateStatus.mutate({ id: selectedEmpresa.id, status: "ativo", aprovar: true });
    } else {
      updateStatus.mutate({ id: selectedEmpresa.id, status: "recusado" });
    }
  };

  // Filter empresas
  const filteredEmpresas = empresas?.filter((empresa) => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!empresa.nome.toLowerCase().includes(search)) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== "all" && empresa.status !== statusFilter) {
      return false;
    }

    // Active filter
    const hoje = new Date().toISOString().split("T")[0];
    if (activeFilter === "ativos_hoje") {
      return (
        empresa.status === "ativo" &&
        empresa.data_inicio &&
        empresa.data_fim &&
        empresa.data_inicio <= hoje &&
        empresa.data_fim >= hoje
      );
    }
    if (activeFilter === "expirados") {
      return empresa.data_fim && empresa.data_fim < hoje;
    }

    return true;
  });

  // Stats
  const getCount = (status: EmpresaStatus) => empresas?.filter((e) => e.status === status).length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-yellow-600" />
            <span className="text-2xl font-bold text-yellow-700">{getCount("aguardando_pagamento")}</span>
          </div>
          <p className="text-xs text-yellow-600 mt-1">Aguardando Pagamento</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-2xl font-bold text-blue-700">{getCount("pendente")}</span>
          </div>
          <p className="text-xs text-blue-600 mt-1">Pendentes</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-2xl font-bold text-green-700">{getCount("ativo")}</span>
          </div>
          <p className="text-xs text-green-600 mt-1">Ativos</p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-2xl font-bold text-red-700">{getCount("recusado")}</span>
          </div>
          <p className="text-xs text-red-600 mt-1">Recusados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="aguardando_pagamento">Aguardando Pagamento</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="recusado">Recusados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativos_hoje">Ativos hoje</SelectItem>
            <SelectItem value="expirados">Expirados</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          onClick={() => setCreatingEmpresa(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Adicionar empresa
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filteredEmpresas || filteredEmpresas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma empresa encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredEmpresas.map((empresa) => {
                const config = statusConfig[empresa.status as EmpresaStatus] || statusConfig.aguardando_pagamento;
                return (
                  <TableRow key={empresa.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{empresa.nome}</p>
                        <p className="text-sm text-muted-foreground">{empresa.whatsapp}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {empresa.categoria?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${config.color} flex items-center gap-1 w-fit`}>
                        {config.icon}
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(empresa.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {empresa.data_inicio && empresa.data_fim ? (
                        <span className="text-sm">
                          {format(new Date(empresa.data_inicio), "dd/MM/yy")} -{" "}
                          {format(new Date(empresa.data_fim), "dd/MM/yy")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {empresa.status === "pendente" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => {
                                setSelectedEmpresa(empresa);
                                setActionType("aprovar");
                              }}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => {
                                setSelectedEmpresa(empresa);
                                setActionType("recusar");
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingEmpresaId(empresa.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!selectedEmpresa && !!actionType} onOpenChange={() => {
        setSelectedEmpresa(null);
        setActionType(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "aprovar" ? "Aprovar empresa?" : "Recusar empresa?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "aprovar"
                ? `A empresa "${selectedEmpresa?.nome}" será ativada por 1 ano a partir de hoje.`
                : `A empresa "${selectedEmpresa?.nome}" será marcada como recusada.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStatus.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={updateStatus.isPending}
              className={actionType === "recusar" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {updateStatus.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {actionType === "aprovar" ? "Aprovar" : "Recusar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Modal */}
      <EmpresaEditModal
        empresaId={editingEmpresaId}
        cidadeId={cidadeId}
        open={!!editingEmpresaId}
        onOpenChange={(open) => !open && setEditingEmpresaId(null)}
      />

      <EmpresaCreateModal
        cidadeId={cidadeId}
        open={creatingEmpresa}
        onOpenChange={setCreatingEmpresa}
      />
    </div>
  );
};

export default AdminCidadeEmpresas;
