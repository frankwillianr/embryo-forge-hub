import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Clock, CheckCircle, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AdminCidadeAloPrefeituraProps {
  cidadeId: string;
}

const statusConfig = {
  pendente: { label: "Pendente", variant: "secondary" as const, icon: Clock },
  aprovado: { label: "Aprovado", variant: "default" as const, icon: CheckCircle },
  rejeitado: { label: "Rejeitado", variant: "destructive" as const, icon: XCircle },
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
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (!denuncias || denuncias.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/30">
        <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">Nenhuma denúncia</h3>
        <p className="text-muted-foreground text-sm">
          Esta cidade ainda não possui denúncias do Alô Prefeitura.
        </p>
      </div>
    );
  }

  // Agrupar por status
  const pendentes = denuncias.filter((d: any) => d.status === "pendente");
  const aprovados = denuncias.filter((d: any) => d.status === "aprovado");
  const rejeitados = denuncias.filter((d: any) => d.status === "rejeitado");

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
          <Clock className="h-6 w-6 mx-auto text-yellow-600 mb-2" />
          <p className="text-2xl font-bold">{pendentes.length}</p>
          <p className="text-sm text-muted-foreground">Pendentes</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
          <CheckCircle className="h-6 w-6 mx-auto text-green-600 mb-2" />
          <p className="text-2xl font-bold">{aprovados.length}</p>
          <p className="text-sm text-muted-foreground">Aprovados</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
          <XCircle className="h-6 w-6 mx-auto text-red-600 mb-2" />
          <p className="text-2xl font-bold">{rejeitados.length}</p>
          <p className="text-sm text-muted-foreground">Rejeitados</p>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Bairro</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {denuncias.map((item: any) => {
              const status = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.pendente;
              const StatusIcon = status.icon;
              
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.titulo}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.categoria || "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.bairro || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminCidadeAloPrefeitura;
