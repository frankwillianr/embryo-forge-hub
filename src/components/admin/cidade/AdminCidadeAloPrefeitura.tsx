import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Clock, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AdminCidadeAloPrefeituraProps {
  cidadeId: string;
}

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-amber-100 text-amber-700" },
  aprovado: { label: "Aprovado", color: "bg-green-100 text-green-700" },
  rejeitado: { label: "Rejeitado", color: "bg-red-100 text-red-700" },
};

const AdminCidadeAloPrefeitura = ({ cidadeId }: AdminCidadeAloPrefeituraProps) => {
  const { data: denuncias, isLoading } = useQuery({
    queryKey: ["admin-cidade-alo-prefeitura", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alo_prefeitura")
        .select("*")
        .eq("cidade_id", cidadeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">Carregando...</div>;
  }

  if (!denuncias || denuncias.length === 0) {
    return (
      <div className="text-center py-12">
        <Phone className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <h3 className="font-medium text-gray-900 mb-1">Nenhuma denúncia</h3>
        <p className="text-gray-400 text-sm">
          Esta cidade ainda não possui denúncias do Alô Prefeitura.
        </p>
      </div>
    );
  }

  const pendentes = denuncias.filter((d: any) => d.status === "pendente");
  const aprovados = denuncias.filter((d: any) => d.status === "aprovado");
  const rejeitados = denuncias.filter((d: any) => d.status === "rejeitado");

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <Clock className="h-5 w-5 mx-auto text-amber-500 mb-2" />
          <p className="text-2xl font-semibold text-gray-900">{pendentes.length}</p>
          <p className="text-xs text-gray-400">Pendentes</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <CheckCircle className="h-5 w-5 mx-auto text-green-500 mb-2" />
          <p className="text-2xl font-semibold text-gray-900">{aprovados.length}</p>
          <p className="text-xs text-gray-400">Aprovados</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <XCircle className="h-5 w-5 mx-auto text-red-500 mb-2" />
          <p className="text-2xl font-semibold text-gray-900">{rejeitados.length}</p>
          <p className="text-xs text-gray-400">Rejeitados</p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {denuncias.map((item: any) => {
          const status = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.pendente;
          
          return (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
            >
              <div>
                <p className="font-medium text-gray-900">{item.titulo}</p>
                <div className="flex items-center gap-2 mt-1">
                  {item.categoria && (
                    <Badge variant="outline" className="text-xs border-gray-200 text-gray-500">
                      {item.categoria}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400">
                    {item.bairro || "—"} • {new Date(item.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                {status.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminCidadeAloPrefeitura;
