import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface AdminCidadeAdminsProps {
  cidadeId: string;
}

interface UserProfile {
  id: string;
  nome: string | null;
  email: string | null;
  cpf: string | null;
}

interface CidadeAdminRow {
  rel_id: string;
  user_id: string;
  nome: string | null;
  email: string | null;
  cpf: string | null;
  created_at: string;
}

const isFunctionParamMismatch = (error: unknown, functionName: string, paramName: string) => {
  const message = (error as { message?: string } | null)?.message?.toLowerCase() || "";
  return (
    message.includes("could not find the function") &&
    message.includes(`public.${functionName}`.toLowerCase()) &&
    message.includes(`(${paramName.toLowerCase()})`)
  );
};

const formatCpf = (cpf: string | null) => {
  const digits = (cpf || "").replace(/\D/g, "");
  if (digits.length !== 11) return cpf || "-";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const AdminCidadeAdmins = ({ cidadeId }: AdminCidadeAdminsProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const normalizedTerm = useMemo(() => searchTerm.trim(), [searchTerm]);

  const {
    data: adminRows = [],
    isLoading: loadingAdmins,
    isError: adminListError,
    error: adminListErrorData,
  } = useQuery({
    queryKey: ["admin-cidade-admins", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_listar_admins_cidade", {
        p_cidade_id: cidadeId,
      });
      if (error) {
        if (isFunctionParamMismatch(error, "admin_listar_admins_cidade", "p_cidade_id")) {
          const fallback = await supabase.rpc("admin_listar_admins_cidade", {
            cidade_id: cidadeId,
          });
          if (fallback.error) throw fallback.error;
          return (fallback.data || []) as CidadeAdminRow[];
        }
        throw error;
      }
      return (data || []) as CidadeAdminRow[];
    },
  });

  const {
    data: searchResults = [],
    isFetching: searchingUsers,
    isError: searchError,
    error: searchErrorData,
  } = useQuery({
    queryKey: ["admin-cidade-admins-search", cidadeId, normalizedTerm],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_buscar_usuarios", {
        p_cidade_id: cidadeId,
        p_busca: normalizedTerm,
        p_limit: 10,
      });
      if (error) {
        if (isFunctionParamMismatch(error, "admin_buscar_usuarios", "p_cidade_id")) {
          const fallback = await supabase.rpc("admin_buscar_usuarios", {
            cidade_id: cidadeId,
            busca: normalizedTerm,
            limit: 10,
          });
          if (fallback.error) throw fallback.error;
          return (fallback.data || []) as UserProfile[];
        }
        throw error;
      }
      return (data || []) as UserProfile[];
    },
    enabled: normalizedTerm.length >= 2,
  });

  const addAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("rel_cidade_admin")
        .insert({ cidade_id: cidadeId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-admins", cidadeId] });
      toast.success("Usuario vinculado como admin da cidade");
      setSelectedUser(null);
      setSearchTerm("");
    },
    onError: (error) => {
      const message = (error as Error).message || "";
      if (message.includes("duplicate key")) {
        toast.error("Este usuario ja e admin desta cidade");
        return;
      }
      toast.error("Erro ao vincular admin");
    },
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("rel_cidade_admin")
        .delete()
        .eq("cidade_id", cidadeId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-admins", cidadeId] });
      toast.success("Admin removido da cidade");
    },
    onError: () => {
      toast.error("Erro ao remover admin");
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Admins da cidade</h2>
        <p className="text-sm text-gray-500">
          Busque por email, CPF ou nome e vincule o usuario como admin.
        </p>
      </div>

      <div className="space-y-3">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Digite email, CPF ou nome"
            className="pl-10"
          />
        </div>

        {searchingUsers && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando usuarios...
          </div>
        )}

        {searchError && (
          <div className="text-sm text-red-600">
            Erro ao buscar usuarios: {(searchErrorData as Error)?.message || "falha na funcao de busca"}
          </div>
        )}

        {!searchingUsers && !searchError && normalizedTerm.length >= 2 && searchResults.length === 0 && (
          <div className="text-sm text-gray-500">Nenhum usuario encontrado para esta busca.</div>
        )}

        {!selectedUser && searchResults.length > 0 && (
          <div className="rounded-lg border border-gray-200 divide-y max-w-xl">
            {searchResults.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUser(user)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50"
              >
                <p className="text-sm font-medium text-gray-900">{user.nome || "Sem nome"}</p>
                <p className="text-xs text-gray-500">
                  {user.email || "sem email"} | CPF {formatCpf(user.cpf)}
                </p>
              </button>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="max-w-xl rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" />
                {selectedUser.nome || "Sem nome"}
              </p>
              <p className="text-xs text-gray-500">
                {selectedUser.email || "sem email"} | CPF {formatCpf(selectedUser.cpf)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setSelectedUser(null)}>
                Trocar
              </Button>
              <Button
                type="button"
                onClick={() => addAdminMutation.mutate(selectedUser.id)}
                disabled={addAdminMutation.isPending}
              >
                {addAdminMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Marcar como admin
              </Button>
            </div>
          </div>
        )}
      </div>

      {adminListError && (
        <div className="text-sm text-red-600">
          Erro ao listar admins: {(adminListErrorData as Error)?.message || "falha na funcao de listagem"}
        </div>
      )}

      <div className="rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Cadastrado em</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingAdmins ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando admins...
                  </div>
                </TableCell>
              </TableRow>
            ) : adminRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500">
                  Nenhum admin vinculado a esta cidade.
                </TableCell>
              </TableRow>
            ) : (
              adminRows.map((row) => (
                <TableRow key={row.rel_id}>
                  <TableCell>{row.nome || "Sem nome"}</TableCell>
                  <TableCell>{row.email || "-"}</TableCell>
                  <TableCell>{formatCpf(row.cpf || null)}</TableCell>
                  <TableCell>{new Date(row.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => removeAdminMutation.mutate(row.user_id)}
                      disabled={removeAdminMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remover
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminCidadeAdmins;
