import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface DesapegaCategoriasProps {
  cidadeId?: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const DesapegaCategorias = ({
  cidadeId,
  selectedId,
  onSelect,
}: DesapegaCategoriasProps) => {
  const { data: categorias } = useQuery({
    queryKey: ["desapega-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_desapega_categoria")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (!categorias || categorias.length === 0) return null;

  return (
    <ScrollArea className="w-full border-b border-border">
      <div className="flex gap-2 p-4">
        {/* Todos */}
        <button
          onClick={() => onSelect(null)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedId === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Todos
        </button>

        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedId === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <span>{cat.icone}</span>
            <span>{cat.nome}</span>
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

export default DesapegaCategorias;
