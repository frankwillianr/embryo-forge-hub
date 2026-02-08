import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Trash2, Ban, User } from "lucide-react";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminCidadeComentariosProps {
  cidadeId: string;
}

interface Comentario {
  id: string;
  jornal_id: string;
  user_id: string;
  comentario: string;
  created_at: string;
  jornal?: {
    titulo: string;
  };
  profile?: {
    nome: string;
    foto_url: string | null;
  };
}

const AdminCidadeComentarios = ({ cidadeId }: AdminCidadeComentariosProps) => {
  const queryClient = useQueryClient();

  // Buscar comentários da cidade
  const { data: comentarios, isLoading } = useQuery({
    queryKey: ["admin-cidade-comentarios", cidadeId],
    queryFn: async () => {
      // Primeiro busca os jornais da cidade
      const { data: jornais, error: jornaisError } = await supabase
        .from("rel_cidade_jornal")
        .select("id, titulo")
        .eq("cidade_id", cidadeId);

      if (jornaisError) throw jornaisError;
      if (!jornais || jornais.length === 0) return [];

      const jornalIds = jornais.map((j) => j.id);

      // Busca comentários desses jornais
      const { data: comentariosData, error: comentariosError } = await supabase
        .from("rel_cidade_jornal_comentarios")
        .select("*")
        .in("jornal_id", jornalIds)
        .order("created_at", { ascending: false });

      if (comentariosError) throw comentariosError;
      if (!comentariosData || comentariosData.length === 0) return [];

      // Buscar profiles dos usuários
      const userIds = [...new Set(comentariosData.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, foto_url")
        .in("id", userIds);

      // Montar os comentários com dados completos
      return comentariosData.map((c) => ({
        ...c,
        jornal: jornais.find((j) => j.id === c.jornal_id),
        profile: profiles?.find((p) => p.id === c.user_id),
      })) as Comentario[];
    },
  });

  // Buscar usuários bloqueados com dados do profile
  const { data: usuariosBloqueadosData } = useQuery({
    queryKey: ["admin-cidade-bloqueados-full", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_jornal_comentarios_bloqueados")
        .select("user_id, created_at")
        .eq("cidade_id", cidadeId);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Buscar profiles
      const userIds = data.map((b) => b.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, foto_url")
        .in("id", userIds);

      return data.map((b) => ({
        ...b,
        profile: profiles?.find((p) => p.id === b.user_id),
      }));
    },
  });

  const usuariosBloqueados = usuariosBloqueadosData?.map((b) => b.user_id) || [];

  // Deletar comentário
  const deletarMutation = useMutation({
    mutationFn: async (comentarioId: string) => {
      const { error } = await supabase
        .from("rel_cidade_jornal_comentarios")
        .delete()
        .eq("id", comentarioId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-comentarios", cidadeId] });
      toast.success("Comentário excluído!");
    },
    onError: () => {
      toast.error("Erro ao excluir comentário");
    },
  });

  // Bloquear usuário
  const bloquearMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("rel_cidade_jornal_comentarios_bloqueados")
        .insert({ cidade_id: cidadeId, user_id: userId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-bloqueados-full", cidadeId] });
      toast.success("Usuário bloqueado de comentar!");
    },
    onError: () => {
      toast.error("Erro ao bloquear usuário");
    },
  });

  // Desbloquear usuário
  const desbloquearMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("rel_cidade_jornal_comentarios_bloqueados")
        .delete()
        .eq("cidade_id", cidadeId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-bloqueados-full", cidadeId] });
      toast.success("Usuário desbloqueado!");
    },
    onError: () => {
      toast.error("Erro ao desbloquear usuário");
    },
  });

  const isUsuarioBloqueado = (userId: string) => {
    return usuariosBloqueados?.includes(userId) || false;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">Carregando...</div>;
  }

  if (!comentarios || comentarios.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-gray-50">
        <MessageCircle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <h3 className="font-semibold text-lg mb-2 text-gray-900">Nenhum comentário</h3>
        <p className="text-gray-500 text-sm">
          Esta cidade ainda não possui comentários nas notícias.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          Comentários ({comentarios.length})
        </h3>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-gray-600">Usuário</TableHead>
              <TableHead className="text-gray-600">Comentário</TableHead>
              <TableHead className="text-gray-600">Notícia</TableHead>
              <TableHead className="text-gray-600">Data</TableHead>
              <TableHead className="text-gray-600 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comentarios.map((comentario) => {
              const bloqueado = isUsuarioBloqueado(comentario.user_id);
              return (
                <TableRow key={comentario.id} className={bloqueado ? "bg-red-50/50" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={comentario.profile?.foto_url || undefined} />
                        <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                          {comentario.profile?.nome?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {comentario.profile?.nome || "Usuário"}
                        </p>
                        {bloqueado && (
                          <span className="text-[10px] text-red-600 font-medium">
                            BLOQUEADO
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm text-gray-700 truncate">
                      {comentario.comentario}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {comentario.jornal?.titulo || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {format(new Date(comentario.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {/* Deletar */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px]">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja apagar este comentário? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deletarMutation.mutate(comentario.id)}
                              className="bg-red-600 text-white hover:bg-red-700"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {/* Bloquear/Desbloquear */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${
                              bloqueado
                                ? "text-green-600 hover:text-green-700"
                                : "text-gray-500 hover:text-orange-600"
                            }`}
                          >
                            {bloqueado ? <User className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px]">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {bloqueado ? "Desbloquear usuário?" : "Bloquear usuário?"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {bloqueado
                                ? `O usuário "${comentario.profile?.nome}" poderá voltar a comentar nas notícias desta cidade.`
                                : `O usuário "${comentario.profile?.nome}" não poderá mais comentar nas notícias desta cidade.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                bloqueado
                                  ? desbloquearMutation.mutate(comentario.user_id)
                                  : bloquearMutation.mutate(comentario.user_id)
                              }
                              className={
                                bloqueado
                                  ? "bg-green-600 text-white hover:bg-green-700"
                                  : "bg-orange-600 text-white hover:bg-orange-700"
                              }
                            >
                              {bloqueado ? "Desbloquear" : "Bloquear"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Seção de Usuários Bloqueados */}
      {usuariosBloqueadosData && usuariosBloqueadosData.length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="font-semibold text-gray-900">
            Usuários Bloqueados ({usuariosBloqueadosData.length})
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-gray-600">Usuário</TableHead>
                  <TableHead className="text-gray-600">Bloqueado em</TableHead>
                  <TableHead className="text-gray-600 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuariosBloqueadosData.map((bloqueio) => (
                  <TableRow key={bloqueio.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={bloqueio.profile?.foto_url || undefined} />
                          <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                            {bloqueio.profile?.nome?.charAt(0).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-gray-900">
                          {bloqueio.profile?.nome || "Usuário"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {format(new Date(bloqueio.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                          >
                            <User className="h-4 w-4 mr-1" />
                            Desbloquear
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[10px]">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Desbloquear usuário?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O usuário "{bloqueio.profile?.nome}" poderá voltar a comentar nas notícias desta cidade.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => desbloquearMutation.mutate(bloqueio.user_id)}
                              className="bg-green-600 text-white hover:bg-green-700"
                            >
                              Desbloquear
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCidadeComentarios;
