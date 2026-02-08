import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Building2,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Eye,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type EmpresaStatus = "aguardando_pagamento" | "pendente" | "ativo" | "recusado" | "expirado";

interface Empresa {
  id: string;
  nome: string;
  whatsapp: string;
  categoria: string;
  status: EmpresaStatus;
  created_at: string;
  data_inicio: string | null;
  data_fim: string | null;
  cidade: {
    id: string;
    nome: string;
  };
}

const statusConfig: Record<EmpresaStatus, { label: string; color: string; icon: React.ReactNode }> = {
  aguardando_pagamento: {
    label: "Aguardando Pagamento",
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    icon: <CreditCard className="h-3 w-3" />,
  },
  pendente: {
    label: "Pendente Aprovação",
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

const AdminEmpresas = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCidade, setSelectedCidade] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "ativos_hoje" | "expirados">("all");
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [actionType, setActionType] = useState<"aprovar" | "recusar" | null>(null);

  // Fetch cidades
  const { data: cidades } = useQuery({
    queryKey: ["admin-cidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Fetch empresas
  const { data: empresas, isLoading } = useQuery({
    queryKey: ["admin-empresas", selectedCidade],
    queryFn: async () => {
      let query = supabase
        .from("rel_cidade_servico_empresa")
        .select(`
          id,
          nome,
          whatsapp,
          categoria,
          status,
          created_at,
          data_inicio,
          data_fim,
          cidade:cidade_id (id, nome)
        `)
        .order("created_at", { ascending: false });

      if (selectedCidade !== "all") {
        query = query.eq("cidade_id", selectedCidade);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Empresa[];
    },
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, aprovar }: { id: string; status: EmpresaStatus; aprovar?: boolean }) => {
      const updates: Record<string, unknown> = { status };
      
      // Se está aprovando, definir datas
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
      queryClient.invalidateQueries({ queryKey: ["admin-empresas"] });
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
      return (
        empresa.data_fim &&
        empresa.data_fim < hoje
      );
    }

    return true;
  });

  const getEmpresasByStatus = (status: EmpresaStatus) => {
    return filteredEmpresas?.filter((e) => e.status === status) || [];
  };

  const renderEmpresaTable = (empresasList: Empresa[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Empresa</TableHead>
          <TableHead>Cidade</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Criado em</TableHead>
          <TableHead>Validade</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {empresasList.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              Nenhuma empresa encontrada
            </TableCell>
          </TableRow>
        ) : (
          empresasList.map((empresa) => (
            <TableRow key={empresa.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{empresa.nome}</p>
                  <p className="text-sm text-muted-foreground">{empresa.whatsapp}</p>
                </div>
              </TableCell>
              <TableCell>{empresa.cidade?.nome}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {empresa.categoria?.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell>
                {format(new Date(empresa.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </TableCell>
              <TableCell>
                {empresa.data_inicio && empresa.data_fim ? (
                  <span className="text-sm">
                    {format(new Date(empresa.data_inicio), "dd/MM/yyyy")} -{" "}
                    {format(new Date(empresa.data_fim), "dd/MM/yyyy")}
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
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Aprovar
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
                        <XCircle className="h-4 w-4 mr-1" />
                        Recusar
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Empresas
          </h1>
          <p className="text-muted-foreground">
            Gerencie as empresas cadastradas no guia de serviços
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
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
            <Select value={selectedCidade} onValueChange={setSelectedCidade}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Todas as cidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cidades?.map((cidade) => (
                  <SelectItem key={cidade.id} value={cidade.id}>
                    {cidade.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativos_hoje">Ativos hoje</SelectItem>
                <SelectItem value="expirados">Expirados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(Object.keys(statusConfig) as EmpresaStatus[]).filter(s => s !== "expirado").map((status) => {
          const config = statusConfig[status];
          const count = getEmpresasByStatus(status).length;
          return (
            <Card key={status}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${config.color}`}>
                    {config.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <Tabs defaultValue="aguardando_pagamento">
            <CardHeader className="pb-0">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="aguardando_pagamento" className="gap-1">
                  <CreditCard className="h-4 w-4" />
                  Aguardando ({getEmpresasByStatus("aguardando_pagamento").length})
                </TabsTrigger>
                <TabsTrigger value="pendente" className="gap-1">
                  <Clock className="h-4 w-4" />
                  Pendentes ({getEmpresasByStatus("pendente").length})
                </TabsTrigger>
                <TabsTrigger value="ativo" className="gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Ativos ({getEmpresasByStatus("ativo").length})
                </TabsTrigger>
                <TabsTrigger value="recusado" className="gap-1">
                  <XCircle className="h-4 w-4" />
                  Recusados ({getEmpresasByStatus("recusado").length})
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-4">
              <TabsContent value="aguardando_pagamento" className="m-0">
                {renderEmpresaTable(getEmpresasByStatus("aguardando_pagamento"))}
              </TabsContent>
              <TabsContent value="pendente" className="m-0">
                {renderEmpresaTable(getEmpresasByStatus("pendente"))}
              </TabsContent>
              <TabsContent value="ativo" className="m-0">
                {renderEmpresaTable(getEmpresasByStatus("ativo"))}
              </TabsContent>
              <TabsContent value="recusado" className="m-0">
                {renderEmpresaTable(getEmpresasByStatus("recusado"))}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      )}

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
    </div>
  );
};

export default AdminEmpresas;
