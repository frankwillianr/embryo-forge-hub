import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DoacaoCategoriasProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const CATEGORIAS_FALLBACK = [
  { id: "fallback-moveis", nome: "Móveis", icone: "🪑" },
  { id: "fallback-eletro", nome: "Eletrodomésticos", icone: "🔌" },
  { id: "fallback-roupas", nome: "Roupas", icone: "👕" },
  { id: "fallback-infantil", nome: "Infantil", icone: "🧸" },
  { id: "fallback-saude", nome: "Saúde", icone: "🩺" },
  { id: "fallback-outros", nome: "Outros", icone: "🎁" },
];

const DoacaoCategorias = ({ selectedId, onSelect }: DoacaoCategoriasProps) => {
  const { data: categorias } = useQuery({
    queryKey: ["doacoes-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_doacao_categoria")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const categoriasParaExibir = categorias && categorias.length > 0 ? categorias : CATEGORIAS_FALLBACK;
  const semCategoriasDoBanco = !categorias || categorias.length === 0;

  return (
    <div className="overflow-x-auto scrollbar-hide scroll-smooth border-b border-border/30">
      <div className="flex px-4" style={{ gap: "15px" }}>
        <button
          onClick={() => onSelect(null)}
          className={`flex-shrink-0 flex items-center gap-1 px-2 pb-2.5 pt-3 text-[13px] font-medium transition-all relative ${
            selectedId === null ? "text-foreground" : "text-muted-foreground/60"
          }`}
        >
          <span>Todos</span>
          {selectedId === null && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-primary" />
          )}
        </button>

        {categoriasParaExibir.map((cat: any) => (
          <button
            key={cat.id}
            onClick={() => {
              if (!semCategoriasDoBanco) onSelect(cat.id);
            }}
            disabled={semCategoriasDoBanco}
            className={`flex-shrink-0 flex items-center gap-1 px-2 pb-2.5 pt-3 text-[13px] font-medium transition-all relative ${
              !semCategoriasDoBanco && selectedId === cat.id
                ? "text-foreground"
                : "text-muted-foreground/60"
            } ${semCategoriasDoBanco ? "opacity-80 cursor-default" : ""}`}
          >
            <span>{cat.icone}</span>
            <span>{cat.nome}</span>
            {!semCategoriasDoBanco && selectedId === cat.id && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DoacaoCategorias;
