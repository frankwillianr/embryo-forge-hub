import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, Ban, MessageCircleOff, CreditCard, FileText, Check, Users } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminCidadeUsuariosProps {
  cidadeId: string;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  foto_url: string | null;
  created_at: string;
  pagamentos_count: number;
  postagens_count: number;
  comentarios_bloqueados: boolean;
}

const AdminCidadeUsuarios = ({ cidadeId }: AdminCidadeUsuariosProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Buscar usuários que interagiram com esta cidade
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["admin-cidade-usuarios", cidadeId],
    queryFn: async () => {
      // Buscar pagamentos de banners nesta cidade
      const { data: pagamentos } = await supabase
        .from("pagamento_banner")
        .select("user_id")
        .eq("cidade_id", cidadeId);

      // Buscar banners nesta cidade
      const { data: banners } = await supabase
        .from("banner")
        .select("user_id")
        .eq("cidade_id", cidadeId);

      // Buscar comentários nesta cidade (via jornais)
      const { data: jornais } = await supabase
        .from("rel_cidade_jornal")
        .select("id")
        .eq("cidade_id", cidadeId);

      const jornalIds = jornais?.map((j) => j.id) || [];
      
      let comentariosUserIds: string[] = [];
      if (jornalIds.length > 0) {
        const { data: comentarios } = await supabase
          .from("rel_cidade_jornal_comentarios")
          .select("user_id")
          .in("jornal_id", jornalIds);
        comentariosUserIds = comentarios?.map((c) => c.user_id) || [];
      }

      // Combinar todos os user_ids únicos
      const allUserIds = [
        ...(pagamentos?.map((p) => p.user_id) || []),
        ...(banners?.map((b) => b.user_id) || []),
        ...comentariosUserIds,
      ];
      
      const uniqueUserIds = [...new Set(allUserIds.filter(Boolean))];

      if (uniqueUserIds.length === 0) return [];

      // Buscar profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email, foto_url, created_at")
        .in("id", uniqueUserIds);

      if (profilesError) throw profilesError;
      if (!profiles) return [];

      // Buscar usuários bloqueados de comentar nesta cidade
      const { data: bloqueados } = await supabase
        .from("rel_cidade_jornal_comentarios_bloqueados")
        .select("user_id")
        .eq("cidade_id", cidadeId);

      const bloqueadosIds = bloqueados?.map((b) => b.user_id) || [];

      // Montar dados completos
      return profiles.map((profile) => {
        const pagamentosCount = pagamentos?.filter(p => p.user_id === profile.id).length || 0;
        const postagensCount = banners?.filter(b => b.user_id === profile.id).length || 0;
        const comentariosBloqueados = bloqueadosIds.includes(profile.id);

        return {
          ...profile,
          pagamentos_count: pagamentosCount,
          postagens_count: postagensCount,
          comentarios_bloqueados: comentariosBloqueados,
        } as Usuario;
      });
    },
  });

  // Bloquear/desbloquear comentários
  const toggleComentariosMutation = useMutation({
    mutationFn: async ({ userId, bloquear }: { userId: string; bloquear: boolean }) => {
      if (bloquear) {
        const { error } = await supabase
          .from("rel_cidade_jornal_comentarios_bloqueados")
          .insert({ cidade_id: cidadeId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rel_cidade_jornal_comentarios_bloqueados")
          .delete()
          .eq("cidade_id", cidadeId)
          .eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: (_, { bloquear }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-usuarios", cidadeId] });
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-bloqueados-full", cidadeId] });
      toast.success(bloquear ? "Usuário bloqueado de comentar!" : "Usuário pode comentar novamente!");
    },
    onError: () => {
      toast.error("Erro ao atualizar bloqueio");
    },
  });

  // Filtrar usuários
  const usuariosFiltrados = usuarios?.filter((u) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.nome?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term)
    );
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">Carregando...</div>;
  }

  if (!usuarios || usuarios.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-gray-50">
        <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <h3 className="font-semibold text-lg mb-2 text-gray-900">Nenhum usuário</h3>
        <p className="text-gray-500 text-sm">
          Esta cidade ainda não possui usuários com interações.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          Usuários ({usuarios.length})
        </h3>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-white border-gray-200"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-gray-600">Usuário</TableHead>
              <TableHead className="text-gray-600">Email</TableHead>
              <TableHead className="text-gray-600 text-center">Pagamentos</TableHead>
              <TableHead className="text-gray-600 text-center">Postagens</TableHead>
              <TableHead className="text-gray-600">Status</TableHead>
              <TableHead className="text-gray-600 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuariosFiltrados?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              usuariosFiltrados?.map((usuario) => (
                <TableRow 
                  key={usuario.id} 
                  className={usuario.comentarios_bloqueados ? "bg-orange-50/50" : ""}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={usuario.foto_url || undefined} />
                        <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                          {usuario.nome?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-gray-900">
                        {usuario.nome || "Sem nome"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {usuario.email}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm text-gray-600">{usuario.pagamentos_count}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm text-gray-600">{usuario.postagens_count}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {usuario.comentarios_bloqueados ? (
                      <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-700">
                        Sem comentários
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">
                        Ativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      {/* Bloquear/Liberar Comentários */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${
                                  usuario.comentarios_bloqueados
                                    ? "text-green-600 hover:text-green-700"
                                    : "text-gray-500 hover:text-orange-600"
                                }`}
                              >
                                {usuario.comentarios_bloqueados ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <MessageCircleOff className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px]">
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {usuario.comentarios_bloqueados
                                    ? "Liberar comentários?"
                                    : "Bloquear comentários?"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {usuario.comentarios_bloqueados
                                    ? `O usuário "${usuario.nome}" poderá voltar a comentar nesta cidade.`
                                    : `O usuário "${usuario.nome}" não poderá mais comentar nesta cidade.`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    toggleComentariosMutation.mutate({
                                      userId: usuario.id,
                                      bloquear: !usuario.comentarios_bloqueados,
                                    })
                                  }
                                  className={
                                    usuario.comentarios_bloqueados
                                      ? "bg-green-600 hover:bg-green-700"
                                      : "bg-orange-600 hover:bg-orange-700"
                                  }
                                >
                                  {usuario.comentarios_bloqueados ? "Liberar" : "Bloquear"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TooltipTrigger>
                        <TooltipContent>
                          {usuario.comentarios_bloqueados
                            ? "Liberar comentários"
                            : "Bloquear comentários"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
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

export default AdminCidadeUsuarios;
