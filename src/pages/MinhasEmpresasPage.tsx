import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Loader2, Plus, Edit, Clock, CheckCircle, CreditCard, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type EmpresaStatus = "aguardando_pagamento" | "pendente" | "ativo" | "recusado" | "expirado";

const statusConfig: Record<EmpresaStatus, { label: string; color: string; icon: React.ReactNode }> = {
  aguardando_pagamento: {
    label: "Aguardando Pagamento",
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    icon: <CreditCard className="h-3 w-3" />,
  },
  pendente: {
    label: "Pendente",
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

const MinhasEmpresasPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch user's empresas
  const { data: empresas, isLoading } = useQuery({
    queryKey: ["minhas-empresas", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select(`
          id,
          nome,
          categoria,
          status,
          created_at,
          data_inicio,
          data_fim,
          cidade:cidade_id (id, nome, slug)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch cidade for navigation
  const { data: cidade } = useQuery({
    queryKey: ["cidade", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome, slug")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const getStatus = (empresa: typeof empresas extends (infer T)[] ? T : never): EmpresaStatus => {
    if (empresa.status === "ativo" && empresa.data_fim) {
      const hoje = new Date().toISOString().split("T")[0];
      if (empresa.data_fim < hoje) {
        return "expirado";
      }
    }
    return empresa.status as EmpresaStatus;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/cidade/${slug}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">
          Minhas Empresas
        </h1>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !empresas || empresas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Nenhuma empresa cadastrada
            </h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Cadastre sua empresa no guia de serviços e seja encontrado por milhares de pessoas
            </p>
            <Button
              onClick={() => navigate(`/cidade/${slug}/servicos`)}
              className="bg-[#331D4A] hover:bg-[#331D4A]/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar empresa
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {empresas.map((empresa) => {
              const status = getStatus(empresa);
              const config = statusConfig[status];
              
              return (
                <Card key={empresa.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {empresa.nome}
                        </h3>
                        <p className="text-sm text-muted-foreground capitalize mt-1">
                          {empresa.categoria?.replace(/_/g, " ")}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant="outline"
                            className={`${config.color} flex items-center gap-1`}
                          >
                            {config.icon}
                            {config.label}
                          </Badge>
                        </div>
                        {empresa.data_fim && status === "ativo" && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Válido até {format(new Date(empresa.data_fim), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/cidade/${slug}/minhas-empresas/${empresa.id}/editar`)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MinhasEmpresasPage;
