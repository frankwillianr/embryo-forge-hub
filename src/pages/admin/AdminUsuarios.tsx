import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, Ban, MessageCircleOff, CreditCard, FileText, Check } from "lucide-react";
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

interface Usuario {
  id: string;
  nome: string;
  email: string;
  foto_url: string | null;
  created_at: string;
  pagamentos_count: number;
  postagens_count: number;
  comentarios_bloqueados: boolean;
  usuario_bloqueado: boolean;
}

const AdminUsuarios = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Buscar usuários com estatísticas
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["admin-usuarios"],
    queryFn: async () => {
      // Buscar profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email, foto_url, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;
      if (!profiles) return [];

      // Buscar contagem de pagamentos por usuário
      const { data: pagamentos } = await supabase
        .from("pagamento_banner")
        .select("user_id");

      // Buscar contagem de postagens (banners)
      const { data: banners } = await supabase
        .from("banner")
        .select("user_id");

      // Buscar usuários bloqueados
      const { data: bloqueados } = await supabase
        .from("usuarios_bloqueados")
        .select("user_id, tipo");

      // Montar dados completos
      return profiles.map((profile) => {
        const pagamentosCount = pagamentos?.filter(p => p.user_id === profile.id).length || 0;
        const postagensCount = banners?.filter(b => b.user_id === profile.id).length || 0;
        const bloqueioComentarios = bloqueados?.some(b => b.user_id === profile.id && b.tipo === "comentarios");
        const bloqueioTotal = bloqueados?.some(b => b.user_id === profile.id && b.tipo === "total");

        return {
          ...profile,
          pagamentos_count: pagamentosCount,
          postagens_count: postagensCount,
          comentarios_bloqueados: bloqueioComentarios || false,
          usuario_bloqueado: bloqueioTotal || false,
        } as Usuario;
      });
    },
  });

  // Bloquear/desbloquear comentários
  const toggleComentariosMutation = useMutation({
    mutationFn: async ({ userId, bloquear }: { userId: string; bloquear: boolean }) => {
      if (bloquear) {
        const { error } = await supabase
          .from("usuarios_bloqueados")
          .upsert({ user_id: userId, tipo: "comentarios" }, { onConflict: "user_id,tipo" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("usuarios_bloqueados")
          .delete()
          .eq("user_id", userId)
          .eq("tipo", "comentarios");
        if (error) throw error;
      }
    },
    onSuccess: (_, { bloquear }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast.success(bloquear ? "Comentários bloqueados!" : "Comentários liberados!");
    },
    onError: () => {
      toast.error("Erro ao atualizar bloqueio");
    },
  });

  // Bloquear/desbloquear usuário completamente
  const toggleUsuarioMutation = useMutation({
    mutationFn: async ({ userId, bloquear }: { userId: string; bloquear: boolean }) => {
      if (bloquear) {
        const { error } = await supabase
          .from("usuarios_bloqueados")
          .upsert({ user_id: userId, tipo: "total" }, { onConflict: "user_id,tipo" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("usuarios_bloqueados")
          .delete()
          .eq("user_id", userId)
          .eq("tipo", "total");
        if (error) throw error;
      }
    },
    onSuccess: (_, { bloquear }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast.success(bloquear ? "Usuário bloqueado!" : "Usuário desbloqueado!");
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Usuários</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gerencie os usuários da plataforma
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {usuarios?.length || 0} usuários
        </Badge>
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-gray-600 font-medium">Usuário</TableHead>
              <TableHead className="text-gray-600 font-medium">Email</TableHead>
              <TableHead className="text-gray-600 font-medium text-center">Pagamentos</TableHead>
              <TableHead className="text-gray-600 font-medium text-center">Postagens</TableHead>
              <TableHead className="text-gray-600 font-medium">Cadastro</TableHead>
              <TableHead className="text-gray-600 font-medium">Status</TableHead>
              <TableHead className="text-gray-600 font-medium text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuariosFiltrados?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              usuariosFiltrados?.map((usuario) => (
                <TableRow 
                  key={usuario.id} 
                  className={usuario.usuario_bloqueado ? "bg-red-50/50" : ""}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={usuario.foto_url || undefined} />
                        <AvatarFallback className="bg-gray-100 text-gray-600 text-sm">
                          {usuario.nome?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-gray-900">
                        {usuario.nome || "Sem nome"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm">
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
                  <TableCell className="text-gray-500 text-sm">
                    {format(new Date(usuario.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {usuario.usuario_bloqueado ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Bloqueado
                        </Badge>
                      ) : usuario.comentarios_bloqueados ? (
                        <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-700">
                          Sem comentários
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">
                          Ativo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {/* Bloquear Comentários */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${
                                  usuario.comentarios_bloqueados
                                    ? "text-orange-600 hover:text-orange-700"
                                    : "text-gray-500 hover:text-orange-600"
                                }`}
                                disabled={usuario.usuario_bloqueado}
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
                                    ? `O usuário "${usuario.nome}" poderá voltar a comentar na plataforma.`
                                    : `O usuário "${usuario.nome}" não poderá mais comentar em nenhuma cidade.`}
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

                      {/* Bloquear Usuário */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${
                                  usuario.usuario_bloqueado
                                    ? "text-red-600 hover:text-red-700"
                                    : "text-gray-500 hover:text-red-600"
                                }`}
                              >
                                {usuario.usuario_bloqueado ? (
                                  <User className="h-4 w-4" />
                                ) : (
                                  <Ban className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px]">
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {usuario.usuario_bloqueado
                                    ? "Desbloquear usuário?"
                                    : "Bloquear usuário?"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {usuario.usuario_bloqueado
                                    ? `O usuário "${usuario.nome}" terá acesso restaurado à plataforma.`
                                    : `O usuário "${usuario.nome}" será completamente bloqueado. Não poderá comentar, postar ou interagir.`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    toggleUsuarioMutation.mutate({
                                      userId: usuario.id,
                                      bloquear: !usuario.usuario_bloqueado,
                                    })
                                  }
                                  className={
                                    usuario.usuario_bloqueado
                                      ? "bg-green-600 hover:bg-green-700"
                                      : "bg-red-600 hover:bg-red-700"
                                  }
                                >
                                  {usuario.usuario_bloqueado ? "Desbloquear" : "Bloquear"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TooltipTrigger>
                        <TooltipContent>
                          {usuario.usuario_bloqueado
                            ? "Desbloquear usuário"
                            : "Bloquear usuário"}
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

export default AdminUsuarios;
