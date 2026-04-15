import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Cidade = {
  id: string;
  nome: string;
};

type PushTokenRow = {
  cidade_id: string | null;
  platform: string | null;
  user_id: string | null;
  updated_at: string | null;
  device_token: string | null;
};

type PushLogRow = {
  created_at: string;
  cidade_id: string | null;
  cidade_slug: string | null;
  app_platform: string | null;
  evento: string;
  user_id: string | null;
  push_permission_status: string | null;
  push_token_presente: boolean | null;
  push_token_prefix: string | null;
  push_error: string | null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("pt-BR");
};

const formatToken = (token?: string | null) => {
  if (!token) return "-";
  return token.length <= 22 ? token : `${token.slice(0, 22)}...`;
};

const AdminVerificarIos = () => {
  const [selectedCidadeId, setSelectedCidadeId] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    return window.localStorage.getItem("admin:selectedCidadeId") || "all";
  });
  const [searchTerm, setSearchTerm] = useState("");

  const { data: cidades = [] } = useQuery({
    queryKey: ["admin-ios-cidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cidade").select("id, nome").order("nome");
      if (error) throw error;
      return (data || []) as Cidade[];
    },
  });

  const { data: pushTokens = [], isLoading: loadingTokens } = useQuery({
    queryKey: ["admin-ios-push-tokens", selectedCidadeId],
    queryFn: async () => {
      let query = supabase
        .from("rel_cidade_push_tokens")
        .select("cidade_id, platform, user_id, updated_at, device_token")
        .order("updated_at", { ascending: false })
        .limit(2000);

      if (selectedCidadeId !== "all") {
        query = query.eq("cidade_id", selectedCidadeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PushTokenRow[];
    },
  });

  const { data: pushLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["admin-ios-push-logs", selectedCidadeId],
    queryFn: async () => {
      let query = supabase
        .from("usuario_log_login" as any)
        .select("created_at, cidade_id, cidade_slug, app_platform, evento, user_id, push_permission_status, push_token_presente, push_token_prefix, push_error")
        .order("created_at", { ascending: false })
        .limit(500);

      if (selectedCidadeId !== "all") {
        query = query.eq("cidade_id", selectedCidadeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PushLogRow[];
    },
  });

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return pushLogs;
    return pushLogs.filter((row) => {
      const raw = [
        row.app_platform,
        row.evento,
        row.push_error,
        row.push_token_prefix,
        row.user_id,
        row.cidade_slug,
      ]
        .join(" ")
        .toLowerCase();
      return raw.includes(term);
    });
  }, [pushLogs, searchTerm]);

  const tokensByPlatform = useMemo(() => {
    const summary = { ios: 0, android: 0, web: 0, other: 0 };
    for (const row of pushTokens) {
      const p = (row.platform || "").toLowerCase();
      if (p === "ios") summary.ios += 1;
      else if (p === "android") summary.android += 1;
      else if (p === "web") summary.web += 1;
      else summary.other += 1;
    }
    return summary;
  }, [pushTokens]);

  const logsByPlatform = useMemo(() => {
    const summary = { ios: 0, android: 0, web: 0, other: 0 };
    for (const row of pushLogs) {
      const p = (row.app_platform || "").toLowerCase();
      if (p === "ios") summary.ios += 1;
      else if (p === "android") summary.android += 1;
      else if (p === "web") summary.web += 1;
      else summary.other += 1;
    }
    return summary;
  }, [pushLogs]);

  const iosLogs = useMemo(
    () => filteredLogs.filter((row) => (row.app_platform || "").toLowerCase() === "ios"),
    [filteredLogs],
  );

  const latestTokens = useMemo(() => pushTokens.slice(0, 15), [pushTokens]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Verificar iOS</h1>
          <p className="mt-1 text-sm text-gray-500">Diagnostico de tokens e logs de push para iPhone</p>
        </div>
        <div className="w-full sm:w-[320px]">
          <label className="mb-1 block text-xs font-medium text-gray-500">Cidade</label>
          <Select
            value={selectedCidadeId}
            onValueChange={(value) => {
              setSelectedCidadeId(value);
              if (typeof window !== "undefined" && value !== "all") {
                window.localStorage.setItem("admin:selectedCidadeId", value);
              }
            }}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Todas as cidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {cidades.map((cidade) => (
                <SelectItem key={cidade.id} value={cidade.id}>
                  {cidade.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Tokens iOS</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{tokensByPlatform.ios}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Tokens Android</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{tokensByPlatform.android}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Logs iOS</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{logsByPlatform.ios}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Logs Web</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{logsByPlatform.web}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Ultimos tokens salvos</h2>
            <p className="text-xs text-gray-500">Top 15 por atualizacao</p>
          </div>
          {loadingTokens && <span className="text-xs text-gray-500">Carregando...</span>}
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="px-2 py-2 font-medium">Atualizado</th>
                <th className="px-2 py-2 font-medium">Platform</th>
                <th className="px-2 py-2 font-medium">User</th>
                <th className="px-2 py-2 font-medium">Token</th>
              </tr>
            </thead>
            <tbody>
              {latestTokens.map((row, idx) => (
                <tr key={`${row.device_token || idx}-${idx}`} className="border-b">
                  <td className="px-2 py-2">{formatDateTime(row.updated_at)}</td>
                  <td className="px-2 py-2">{row.platform || "-"}</td>
                  <td className="px-2 py-2">{row.user_id ? row.user_id.slice(0, 8) : "-"}</td>
                  <td className="px-2 py-2 font-mono text-xs">{formatToken(row.device_token)}</td>
                </tr>
              ))}
              {latestTokens.length === 0 && !loadingTokens && (
                <tr>
                  <td colSpan={4} className="px-2 py-6 text-center text-gray-500">
                    Nenhum token encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Logs iOS recentes</h2>
            <p className="text-xs text-gray-500">Eventos do usuario_log_login com app_platform = ios</p>
          </div>
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar em evento/erro/token/user"
            className="w-full sm:w-[320px]"
          />
        </div>
        {loadingLogs ? (
          <p className="text-sm text-gray-500">Carregando logs...</p>
        ) : iosLogs.length === 0 ? (
          <p className="text-sm text-amber-700">
            Nenhum log iOS encontrado nesta selecao. Se houver muitos iPhones instalados, isso indica build publicada
            sem gravacao de log/token neste backend, ou app apontando para outro projeto Supabase.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="px-2 py-2 font-medium">Quando</th>
                  <th className="px-2 py-2 font-medium">Evento</th>
                  <th className="px-2 py-2 font-medium">Permissao</th>
                  <th className="px-2 py-2 font-medium">Token?</th>
                  <th className="px-2 py-2 font-medium">Erro</th>
                </tr>
              </thead>
              <tbody>
                {iosLogs.slice(0, 80).map((row, idx) => (
                  <tr key={`${row.created_at}-${row.evento}-${idx}`} className="border-b">
                    <td className="px-2 py-2">{formatDateTime(row.created_at)}</td>
                    <td className="px-2 py-2">{row.evento}</td>
                    <td className="px-2 py-2">{row.push_permission_status || "-"}</td>
                    <td className="px-2 py-2">{row.push_token_presente ? "sim" : "nao"}</td>
                    <td className="px-2 py-2 text-xs text-red-600">{row.push_error || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminVerificarIos;

