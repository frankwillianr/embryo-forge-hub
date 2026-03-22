import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SugestaoRow = {
  id: string;
  cidade_id: string;
  user_id: string;
  mensagem: string;
  status: string | null;
  created_at: string;
  updated_at: string;
};

const AdminSugestoes = () => {
  const [cidadeFiltro, setCidadeFiltro] = useState<string>(() => {
    if (typeof window === "undefined") return "todas";
    return window.localStorage.getItem("admin:selectedCidadeId") || "todas";
  });

  const { data: cidades = [] } = useQuery({
    queryKey: ["admin-sugestoes-cidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cidade").select("id, nome").order("nome");
      if (error) throw error;
      return data as Array<{ id: string; nome: string }>;
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-sugestoes-lista", cidadeFiltro],
    queryFn: async () => {
      let query = supabase
        .from("rel_cidade_dica_sugestao")
        .select("id, cidade_id, user_id, mensagem, status, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (cidadeFiltro !== "todas") {
        query = query.eq("cidade_id", cidadeFiltro);
      }

      const { data: sugestoesData, error: sugestoesError } = await query;
      if (sugestoesError) throw sugestoesError;

      const sugestoes = (sugestoesData || []) as SugestaoRow[];
      if (sugestoes.length === 0) {
        return {
          sugestoes: [] as SugestaoRow[],
          cidadesMap: {} as Record<string, string>,
          usuariosMap: {} as Record<string, string>,
        };
      }

      const cidadeIds = Array.from(new Set(sugestoes.map((item) => item.cidade_id).filter(Boolean)));
      const userIds = Array.from(new Set(sugestoes.map((item) => item.user_id).filter(Boolean)));

      const [cidadesRes, usersRes] = await Promise.all([
        cidadeIds.length
          ? supabase.from("cidade").select("id, nome").in("id", cidadeIds)
          : Promise.resolve({ data: [], error: null } as const),
        userIds.length
          ? supabase.from("profiles").select("id, nome").in("id", userIds)
          : Promise.resolve({ data: [], error: null } as const),
      ]);

      if (cidadesRes.error) throw cidadesRes.error;
      if (usersRes.error) throw usersRes.error;

      const cidadesMap = Object.fromEntries((cidadesRes.data || []).map((item) => [item.id, item.nome]));
      const usuariosMap = Object.fromEntries((usersRes.data || []).map((item) => [item.id, item.nome || "Usuario"]));

      return {
        sugestoes,
        cidadesMap,
        usuariosMap,
      };
    },
  });

  const sugestoes = data?.sugestoes || [];
  const cidadesMap = data?.cidadesMap || {};
  const usuariosMap = data?.usuariosMap || {};

  const totalComFiltro = useMemo(() => sugestoes.length, [sugestoes.length]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Sugestoes dos usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">Total exibido: {totalComFiltro}</p>
        </div>

        <div className="w-full md:w-72">
          <Select
            value={cidadeFiltro}
            onValueChange={(value) => {
              setCidadeFiltro(value);
              if (typeof window !== "undefined" && value !== "todas") {
                window.localStorage.setItem("admin:selectedCidadeId", value);
              }
            }}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Filtrar por cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as cidades</SelectItem>
              {cidades.map((cidade) => (
                <SelectItem key={cidade.id} value={cidade.id}>
                  {cidade.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Carregando...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Erro ao carregar sugestoes.
        </div>
      ) : sugestoes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          Nenhuma sugestao encontrada.
        </div>
      ) : (
        <div className="space-y-3">
          {sugestoes.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Lightbulb className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{item.mensagem}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>Cidade: {cidadesMap[item.cidade_id] || item.cidade_id}</span>
                    <span>Usuario: {usuariosMap[item.user_id] || item.user_id}</span>
                    <span>Status: {item.status || "novo"}</span>
                    <span>
                      Enviado em:{" "}
                      {new Date(item.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminSugestoes;
