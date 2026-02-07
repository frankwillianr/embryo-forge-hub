import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Film, ExternalLink } from "lucide-react";
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

interface AdminCidadeCinemaProps {
  cidadeId: string;
}

const AdminCidadeCinema = ({ cidadeId }: AdminCidadeCinemaProps) => {
  const { data: filmes, isLoading } = useQuery({
    queryKey: ["admin-cidade-cinema", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_cinema")
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

  if (!filmes || filmes.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/30">
        <Film className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">Nenhum filme cadastrado</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Esta cidade ainda não possui filmes em cartaz.
        </p>
        <Button variant="outline" asChild>
          <a href="/admin/cinema">
            <ExternalLink className="h-4 w-4 mr-2" />
            Gerenciar Cinema
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filmes cadastrados ({filmes.length})</h3>
        <Button variant="outline" size="sm" asChild>
          <a href="/admin/cinema">
            <ExternalLink className="h-4 w-4 mr-2" />
            Gerenciar Cinema
          </a>
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Poster</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Gênero</TableHead>
              <TableHead>Classificação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filmes.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell>
                  {item.poster_url ? (
                    <img
                      src={item.poster_url}
                      alt={item.titulo}
                      className="w-12 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-16 bg-muted rounded flex items-center justify-center">
                      <Film className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {item.titulo || "Sem título"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{item.genero || "—"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{item.classificacao || "—"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminCidadeCinema;
