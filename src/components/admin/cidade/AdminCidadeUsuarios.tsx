import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, MessageCircleOff, CreditCard, FileText, Check, Users } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface AdminCidadeUsuariosProps {
  cidadeId: string;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  foto_url: string | null;
  created_at?: string;
  pagamentos_count: number;
  postagens_count: number;
  comentarios_bloqueados: boolean;
}

const isFunctionParamMismatch = (error: unknown, functionName: string, paramName: string) => {
  const message = (error as { message?: string } | null)?.message?.toLowerCase() || "";
  return (
    message.includes("could not find the function") &&
    message.includes(`public.${functionName}`.toLowerCase()) &&
    message.includes(`(${paramName.toLowerCase()})`)
  );
};

const AdminCidadeUsuarios = ({ cidadeId }: AdminCidadeUsuariosProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["admin-cidade-usuarios", cidadeId],
    queryFn: async () => {
      const userMeta = new Map<string, { nome: string; email: string }>();
      const userIdSet = new Set<string>();

      const addUserIds = (rows: Array<{ user_id?: string | null }> | null | undefined) => {
        (rows || []).forEach((r) => {
          const id = r.user_id;
          if (id) userIdSet.add(id);
        });
      };

      // 1) RPC de busca de usuarios (fonte principal para admins)
      const rpc = await supabase.rpc("admin_buscar_usuarios", {
        p_cidade_id: cidadeId,
        p_busca: "",
        p_limit: 50,
      });

      let rpcRows = rpc.data as Array<{ id: string; nome: string | null; email: string | null; cpf: string | null }> | null;
      if (rpc.error) {
        if (isFunctionParamMismatch(rpc.error, "admin_buscar_usuarios", "p_cidade_id")) {
          const fallback = await supabase.rpc("admin_buscar_usuarios", {
            cidade_id: cidadeId,
            busca: "",
            limit: 50,
          });
          if (fallback.error) throw fallback.error;
          rpcRows = fallback.data as Array<{ id: string; nome: string | null; email: string | null; cpf: string | null }> | null;
        } else {
          throw rpc.error;
        }
      }

      (rpcRows || []).forEach((u) => {
        userIdSet.add(u.id);
        userMeta.set(u.id, { nome: u.nome || "Sem nome", email: u.email || "" });
      });

      // 2) Complemento por interacoes da cidade
      const { data: pagamentos } = await supabase.from("pagamento_banner").select("user_id").eq("cidade_id", cidadeId);
      const { data: banners } = await supabase.from("banner").select("user_id").eq("cidade_id", cidadeId);
      const { data: jornais } = await supabase.from("rel_cidade_jornal").select("id").eq("cidade_id", cidadeId);
      const { data: alos } = await supabase.from("rel_cidade_alo_prefeitura").select("user_id").eq("cidade_id", cidadeId);
      const { data: checkins } = await supabase.from("checkin").select("user_id").eq("cidade_id", cidadeId);
      const { data: cupons } = await supabase.from("usuario_cupom").select("user_id").eq("cidade_id", cidadeId);
      const { data: cuponsEmpresa } = await supabase.from("usuario_cupom_empresa").select("user_id").eq("cidade_id", cidadeId);
      const { data: solicitacoes } = await supabase.from("solicitacao_orcamento").select("user_id").eq("cidade_id", cidadeId);
      const { data: empresas } = await supabase.from("rel_cidade_servico_empresa").select("user_id").eq("cidade_id", cidadeId);
      const { data: desapegas } = await supabase.from("rel_cidade_desapega").select("user_id").eq("cidade_id", cidadeId);
      const { data: doacoes } = await supabase.from("rel_cidade_doacao").select("user_id").eq("cidade_id", cidadeId);

      addUserIds(pagamentos as Array<{ user_id?: string | null }> | undefined);
      addUserIds(banners as Array<{ user_id?: string | null }> | undefined);
      addUserIds(alos as Array<{ user_id?: string | null }> | undefined);
      addUserIds(checkins as Array<{ user_id?: string | null }> | undefined);
      addUserIds(cupons as Array<{ user_id?: string | null }> | undefined);
      addUserIds(cuponsEmpresa as Array<{ user_id?: string | null }> | undefined);
      addUserIds(solicitacoes as Array<{ user_id?: string | null }> | undefined);
      addUserIds(empresas as Array<{ user_id?: string | null }> | undefined);
      addUserIds(desapegas as Array<{ user_id?: string | null }> | undefined);
      addUserIds(doacoes as Array<{ user_id?: string | null }> | undefined);

      const jornalIds = (jornais || []).map((j) => j.id);
      let comentariosUserIds: string[] = [];
      if (jornalIds.length > 0) {
        const { data: comentarios } = await supabase
          .from("rel_cidade_jornal_comentarios")
          .select("user_id")
          .in("jornal_id", jornalIds);
        comentariosUserIds = (comentarios || []).map((c) => c.user_id).filter(Boolean) as string[];
        comentariosUserIds.forEach((id) => userIdSet.add(id));
      }

      // 3) Complemento por analytics de acesso da cidade (usuarios logados)
      const { data: cidadeData } = await supabase
        .from("cidade")
        .select("slug")
        .eq("id", cidadeId)
        .maybeSingle();

      if (cidadeData?.slug) {
        const { data: accessUsers } = await supabase
          .from("app_access_event")
          .select("user_id")
          .eq("cidade_slug", cidadeData.slug)
          .not("user_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1000);

        addUserIds(accessUsers as Array<{ user_id?: string | null }> | undefined);
      }

      // 4) Fallback: se vier muito pouco, tenta profiles direto para nao travar operacao
      if (userIdSet.size <= 1) {
        const { data: globalProfiles } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .order("created_at", { ascending: false })
          .limit(200);

        (globalProfiles || []).forEach((p) => {
          userIdSet.add(p.id);
          userMeta.set(p.id, { nome: p.nome || "Sem nome", email: p.email || "" });
        });
      }

      const userIds = Array.from(userIdSet);
      if (userIds.length === 0) return [] as Usuario[];

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, nome, email, foto_url, created_at")
        .in("id", userIds);

      const profileMap = new Map((profileRows || []).map((p) => [p.id, p]));

      const { data: bloqueados } = await supabase
        .from("rel_cidade_jornal_comentarios_bloqueados")
        .select("user_id")
        .eq("cidade_id", cidadeId);
      const bloqueadosIds = (bloqueados || []).map((b) => b.user_id);

      return userIds.map((id) => {
        const profile = profileMap.get(id);
        const meta = userMeta.get(id);
        const pagamentosCount = (pagamentos || []).filter((p) => p.user_id === id).length;
        const postagensCount =
          (banners || []).filter((b) => b.user_id === id).length + comentariosUserIds.filter((uid) => uid === id).length;

        return {
          id,
          nome: profile?.nome || meta?.nome || "Sem nome",
          email: profile?.email || meta?.email || "",
          foto_url: profile?.foto_url || null,
          created_at: profile?.created_at,
          pagamentos_count: pagamentosCount,
          postagens_count: postagensCount,
          comentarios_bloqueados: bloqueadosIds.includes(id),
        } as Usuario;
      });
    },
  });

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
      toast.success(bloquear ? "Usuario bloqueado de comentar!" : "Usuario pode comentar novamente!");
    },
    onError: () => {
      toast.error("Erro ao atualizar bloqueio");
    },
  });

  const usuariosFiltrados = usuarios?.filter((u) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return u.nome?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">Carregando...</div>;
  }

  if (!usuarios || usuarios.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-gray-50">
        <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <h3 className="font-semibold text-lg mb-2 text-gray-900">Nenhum usuario</h3>
        <p className="text-gray-500 text-sm">Nenhum usuario encontrado para esta cidade.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Usuarios ({usuarios.length})</h3>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-white border-gray-200"
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-gray-600">Usuario</TableHead>
              <TableHead className="text-gray-600">Email</TableHead>
              <TableHead className="text-gray-600 text-center">Pagamentos</TableHead>
              <TableHead className="text-gray-600 text-center">Postagens</TableHead>
              <TableHead className="text-gray-600">Status</TableHead>
              <TableHead className="text-gray-600 text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuariosFiltrados?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                  Nenhum usuario encontrado
                </TableCell>
              </TableRow>
            ) : (
              usuariosFiltrados?.map((usuario) => (
                <TableRow key={usuario.id} className={usuario.comentarios_bloqueados ? "bg-orange-50/50" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={usuario.foto_url || undefined} />
                        <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                          {usuario.nome?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-gray-900">{usuario.nome || "Sem nome"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{usuario.email || "-"}</TableCell>
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
                        Sem comentarios
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">
                        Ativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
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
                                    ? "Liberar comentarios?"
                                    : "Bloquear comentarios?"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {usuario.comentarios_bloqueados
                                    ? `O usuario "${usuario.nome}" podera voltar a comentar nesta cidade.`
                                    : `O usuario "${usuario.nome}" nao podera mais comentar nesta cidade.`}
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
                          {usuario.comentarios_bloqueados ? "Liberar comentarios" : "Bloquear comentarios"}
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
