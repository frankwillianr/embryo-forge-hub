import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AdminCidadeJornalProps {
  cidadeId: string;
}

const AdminCidadeJornal = ({ cidadeId }: AdminCidadeJornalProps) => {
  const { data: noticias, isLoading } = useQuery({
    queryKey: ["admin-cidade-jornal", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_jornal")
        .select(`
          *,
          jornal:jornal_id (*)
        `)
        .eq("cidade_id", cidadeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (!noticias || noticias.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/30">
        <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">Nenhuma notícia vinculada</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Esta cidade ainda não possui notícias do jornal vinculadas.
        </p>
        <Button variant="outline">
          <ExternalLink className="h-4 w-4 mr-2" />
          Gerenciar Jornal
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Notícias vinculadas ({noticias.length})</h3>
        <Button variant="outline" size="sm">
          <ExternalLink className="h-4 w-4 mr-2" />
          Gerenciar Jornal
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {noticias.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {item.jornal?.titulo || "Sem título"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{item.jornal?.categoria || "—"}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.jornal?.created_at
                    ? new Date(item.jornal.created_at).toLocaleDateString("pt-BR")
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={item.jornal?.publicado ? "default" : "outline"}>
                    {item.jornal?.publicado ? "Publicado" : "Rascunho"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminCidadeJornal;
