import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Check, Search, Send, UserCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AdminCidadePushNotificationsProps {
  cidadeId: string;
}

type PushPlatformFilter = "todos" | "ios" | "android";
type PushTargetMode = "cidade" | "usuarios";
type UserOrder = "last_seen" | "nome";

interface PushUser {
  user_id: string;
  nome: string | null;
  email: string | null;
  tokens_count: number;
  platforms: string | null;
  last_seen: string | null;
}

const parseFunctionError = async (error: any): Promise<string> => {
  try {
    const status = error?.context?.status;
    let payload: any = null;

    if (error?.context && typeof error.context.clone === "function") {
      const cloned = error.context.clone();
      const text = await cloned.text();
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { raw: text };
        }
      }
    }

    const details =
      payload?.error ||
      payload?.message ||
      payload?.msg ||
      payload?.raw ||
      error?.message ||
      "Erro desconhecido";

    return status ? `HTTP ${status}: ${details}` : details;
  } catch {
    return error?.message || "Erro desconhecido";
  }
};

const formatLastSeen = (value?: string | null) => {
  if (!value) return "Sem login recente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem login recente";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const AdminCidadePushNotifications = ({ cidadeId }: AdminCidadePushNotificationsProps) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<PushPlatformFilter>("todos");
  const [targetMode, setTargetMode] = useState<PushTargetMode>("cidade");
  const [orderBy, setOrderBy] = useState<UserOrder>("last_seen");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const { data: usersData = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["admin-push-users", cidadeId, searchTerm, orderBy],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_buscar_usuarios_push", {
        p_cidade_id: cidadeId,
        p_busca: searchTerm,
        p_order: orderBy,
        p_limit: 200,
      });

      if (error) throw error;
      return (data || []) as PushUser[];
    },
  });

  const { data: pushCountData, isLoading: loadingTokens } = useQuery({
    queryKey: ["admin-cidade-push-count", cidadeId, platformFilter, targetMode, selectedUserIds],
    queryFn: async () => {
      const payload: Record<string, unknown> = {
        cidadeId,
        platform: platformFilter === "todos" ? undefined : platformFilter,
        dryRun: true,
      };

      if (targetMode === "usuarios") {
        payload.userIds = selectedUserIds;
      }

      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: payload,
      });
      if (error) {
        const detailed = await parseFunctionError(error);
        console.error("Erro detalhado no dryRun de push:", detailed, error);
        throw new Error(detailed);
      }
      return data;
    },
  });

  const tokensCount = useMemo(() => {
    return pushCountData?.wouldSend ?? 0;
  }, [pushCountData]);

  const selectedUsersCount = selectedUserIds.length;

  const visibleUserIds = useMemo(() => usersData.map((u) => u.user_id), [usersData]);

  const areAllVisibleSelected = useMemo(() => {
    if (visibleUserIds.length === 0) return false;
    return visibleUserIds.every((id) => selectedUserIds.includes(id));
  }, [visibleUserIds, selectedUserIds]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      return [...prev, userId];
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedUserIds((prev) => {
      if (areAllVisibleSelected) {
        return prev.filter((id) => !visibleUserIds.includes(id));
      }

      const merged = new Set([...prev, ...visibleUserIds]);
      return Array.from(merged);
    });
  };

  const handleSendPush = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Preencha titulo e mensagem.");
      return;
    }

    if (targetMode === "usuarios" && selectedUserIds.length === 0) {
      toast.error("Selecione pelo menos um usuario.");
      return;
    }

    try {
      setSending(true);
      toast.loading("Enviando push...");

      const payload: Record<string, unknown> = {
        cidadeId,
        platform: platformFilter === "todos" ? undefined : platformFilter,
        title: title.trim(),
        body: body.trim(),
      };

      if (targetMode === "usuarios") {
        payload.userIds = selectedUserIds;
      }

      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: payload,
      });

      toast.dismiss();

      if (error) {
        const detailed = await parseFunctionError(error);
        toast.error(`Erro ao enviar push: ${detailed}`);
        return;
      }

      if (!data?.success) {
        const detailed =
          data?.error ||
          data?.message ||
          (Array.isArray(data?.failureReasons) && data.failureReasons.length > 0
            ? data.failureReasons.join(" | ")
            : null) ||
          "Falha ao enviar push.";
        toast.error(`Falha ao enviar push: ${detailed}`);
        return;
      }

      if ((data?.failureCount ?? 0) > 0) {
        toast.warning(`Push parcial. Sucesso: ${data.successCount ?? 0} | Falhas: ${data.failureCount ?? 0}`);
      } else {
        toast.success(`Push enviado. Sucesso: ${data.successCount ?? 0} | Falhas: ${data.failureCount ?? 0}`);
      }
    } catch (err) {
      toast.dismiss();
      toast.error("Erro inesperado ao enviar push.");
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-gray-700" />
        <h2 className="text-lg font-semibold text-gray-900">Push Notificacao</h2>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTargetMode("cidade")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              targetMode === "cidade" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            Cidade inteira
          </button>
          <button
            type="button"
            onClick={() => setTargetMode("usuarios")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              targetMode === "usuarios" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            Usuarios especificos
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPlatformFilter("todos")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              platformFilter === "todos" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setPlatformFilter("ios")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              platformFilter === "ios" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            iOS
          </button>
          <button
            type="button"
            onClick={() => setPlatformFilter("android")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              platformFilter === "android" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            Android
          </button>
        </div>

        <p className="text-sm text-gray-600">
          Dispositivos encontrados ({platformFilter}):
          <span className="ml-2 font-semibold text-gray-900">{loadingTokens ? "..." : tokensCount}</span>
        </p>
      </div>

      {targetMode === "usuarios" && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <p className="text-sm font-semibold text-gray-900">Selecionar usuarios</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOrderBy("last_seen")}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  orderBy === "last_seen" ? "bg-black text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                Ultimo login
              </button>
              <button
                type="button"
                onClick={() => setOrderBy("nome")}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  orderBy === "nome" ? "bg-black text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                Nome
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Selecionados: {selectedUsersCount}</span>
            <button type="button" className="underline" onClick={toggleSelectAllVisible}>
              {areAllVisibleSelected ? "Desmarcar visiveis" : "Selecionar visiveis"}
            </button>
          </div>

          <div className="max-h-72 overflow-auto border rounded-md divide-y">
            {loadingUsers ? (
              <p className="p-3 text-sm text-gray-500">Carregando usuarios...</p>
            ) : usersData.length === 0 ? (
              <p className="p-3 text-sm text-gray-500">Nenhum usuario encontrado para esse filtro.</p>
            ) : (
              usersData.map((u) => {
                const selected = selectedUserIds.includes(u.user_id);
                return (
                  <button
                    key={u.user_id}
                    type="button"
                    onClick={() => toggleUser(u.user_id)}
                    className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${selected ? "bg-gray-50" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center ${
                          selected ? "bg-black border-black text-white" : "bg-white border-gray-300"
                        }`}
                      >
                        {selected ? <Check className="h-3.5 w-3.5" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.nome || "Sem nome"}</p>
                        <p className="text-xs text-gray-600 truncate">{u.email || "sem email"}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Tokens: {u.tokens_count} | Plataformas: {u.platforms || "-"}
                        </p>
                        <p className="text-xs text-gray-500">Ultimo login: {formatLastSeen(u.last_seen)}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Titulo</label>
          <Input
            placeholder="Ex.: Comunicado importante"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Mensagem</label>
          <Textarea
            placeholder="Digite a mensagem da notificacao..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={500}
          />
        </div>

        <Button onClick={handleSendPush} disabled={sending} className="bg-black hover:bg-black/90 text-white">
          {targetMode === "usuarios" ? <UserCheck className="h-4 w-4 mr-2" /> : <Users className="h-4 w-4 mr-2" />}
          <Send className="h-4 w-4 mr-2" />
          {sending ? "Enviando..." : "Enviar Push"}
        </Button>
      </div>
    </div>
  );
};

export default AdminCidadePushNotifications;
