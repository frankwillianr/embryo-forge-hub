import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Search, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface EmpresaCreateModalProps {
  cidadeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserProfile {
  id: string;
  nome: string | null;
  email: string | null;
  cpf: string | null;
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
  const d = (cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf || "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const EmpresaCreateModal = ({ cidadeId, open, onOpenChange }: EmpresaCreateModalProps) => {
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const cpfDigits = useMemo(() => userSearch.replace(/\D/g, ""), [userSearch]);
  const normalizedTerm = useMemo(() => userSearch.trim(), [userSearch]);

  const { data: userResults = [], isFetching: searchingUsers } = useQuery({
    queryKey: ["admin-empresa-user-search", cidadeId, normalizedTerm],
    queryFn: async () => {
      const term = normalizedTerm || cpfDigits;
      if (!term) return [] as UserProfile[];
      const termLower = normalizedTerm.toLowerCase();
      const cpfTerm = cpfDigits.length >= 3 ? cpfDigits : "";
      const isEmailSearch = normalizedTerm.includes("@");

      const strictMatch = (u: UserProfile) => {
        const email = (u.email || "").toLowerCase();
        const nome = (u.nome || "").toLowerCase();
        const cpf = (u.cpf || "").replace(/\D/g, "");
        const matchText = termLower.length >= 3 && (isEmailSearch ? email.includes(termLower) : (email.includes(termLower) || nome.includes(termLower)));
        const matchCpf = cpfTerm.length >= 3 && cpf.includes(cpfTerm);
        return matchText || matchCpf;
      };

      const { data, error } = await supabase.rpc("admin_buscar_usuarios", {
        p_cidade_id: cidadeId,
        p_busca: term,
        p_limit: 30,
      });

      if (error) {
        if (isFunctionParamMismatch(error, "admin_buscar_usuarios", "p_cidade_id")) {
          const fallback = await supabase.rpc("admin_buscar_usuarios", {
            cidade_id: cidadeId,
            busca: term,
            limit: 30,
          });
          if (fallback.error) throw fallback.error;
          const rows = (fallback.data || []) as UserProfile[];
          return rows.filter(strictMatch).slice(0, 8);
        }
        throw error;
      }

      const rows = (data || []) as UserProfile[];
      return rows.filter(strictMatch).slice(0, 8);
    },
    enabled: open && (normalizedTerm.length >= 3 || cpfDigits.length >= 3),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser?.id) throw new Error("Selecione um usuario por email/CPF");
      if (nome.trim().length < 3) throw new Error("Nome da empresa invalido");
      const valorNumber = Number(valor.replace(",", "."));
      if (!Number.isFinite(valorNumber) || valorNumber <= 0) throw new Error("Informe um valor valido");

      const { data: empresa, error } = await supabase.from("rel_cidade_servico_empresa").insert({
        cidade_id: cidadeId,
        user_id: selectedUser.id,
        nome: nome.trim(),
        whatsapp: "00000000000",
        categoria: "geral",
        status: "aguardando_pagamento",
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
      }).select("id").single();

      if (error) throw error;

      const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
        "create-asaas-empresa-payment",
        {
          body: {
            empresa_id: empresa.id,
            valor: valorNumber,
          },
        }
      );

      if (paymentError) {
        let detailedMessage = paymentError.message;
        const context = (paymentError as { context?: Response }).context;
        if (context) {
          try {
            const json = await context.json();
            if (json?.error) detailedMessage = String(json.error);
            else if (json?.message) detailedMessage = String(json.message);
          } catch {
            // segue com a mensagem padrão se não conseguir parsear o corpo
          }
        }
        throw new Error(`Falha ao gerar pagamento: ${detailedMessage}`);
      }

      const paymentUrl = paymentData?.payment_url;
      if (typeof paymentUrl === "string" && paymentUrl.startsWith("http")) {
        window.open(paymentUrl, "_blank", "noopener,noreferrer");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cidade-empresas", cidadeId] });
      toast.success("Empresa criada e cobrança gerada no Asaas");
      onOpenChange(false);
      setSelectedUser(null);
      setUserSearch("");
      setNome("");
      setValor("");
      setDataInicio("");
      setDataFim("");
    },
    onError: (error) => {
      toast.error((error as Error).message || "Erro ao criar empresa");
    },
  });

  const isValid = !!selectedUser?.id && nome.trim().length >= 3 && Number(valor.replace(",", ".")) > 0;
  const canSearchUser = normalizedTerm.length >= 3 || cpfDigits.length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar empresa</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Vincular usuario (email ou CPF) *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite email, CPF ou nome"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchingUsers && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Buscando usuarios...
              </div>
            )}
            {!searchingUsers && canSearchUser && !selectedUser && userResults.length > 0 && (
              <div className="text-xs text-emerald-600 font-medium">
                Usuario encontrado ({userResults.length}). Selecione abaixo.
              </div>
            )}
            {!searchingUsers && canSearchUser && !selectedUser && userResults.length === 0 && (
              <div className="text-xs text-amber-700 font-medium">
                Nenhum usuario encontrado para essa busca.
              </div>
            )}
            {!selectedUser && userResults.length > 0 && (
              <div className="rounded-md border divide-y max-h-56 overflow-auto">
                {userResults.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    className="w-full px-3 py-2 text-left hover:bg-muted/40"
                    onClick={() => setSelectedUser(u)}
                  >
                    <p className="text-sm font-medium">{u.nome || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.email || "sem email"} {u.cpf ? `• CPF ${formatCpf(u.cpf)}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {selectedUser && (
              <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5" />
                    {selectedUser.nome || "Sem nome"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedUser.email || "sem email"} {selectedUser.cpf ? `• CPF ${formatCpf(selectedUser.cpf)}` : ""}
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedUser(null)}>
                  Trocar
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Nome da empresa *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Eletrica Silva"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^\d,.\-]/g, ""))}
                placeholder="299,90"
              />
            </div>
            <div className="space-y-2">
              <Label>Data inicio</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!isValid || createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar empresa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmpresaCreateModal;
