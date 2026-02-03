import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface OfertasSectionProps {
  cidadeSlug?: string;
}

const OfertasSection = ({ cidadeSlug }: OfertasSectionProps) => {
  const navigate = useNavigate();

  // Buscar cidade
  const { data: cidade } = useQuery({
    queryKey: ["cidade", cidadeSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cidadeSlug,
  });

  // Buscar ofertas (empresas com banner)
  const { data: ofertas, isLoading } = useQuery({
    queryKey: ["ofertas", cidade?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome, categoria, banner_oferta_url")
        .eq("cidade_id", cidade!.id)
        .eq("status", "ativo")
        .not("banner_oferta_url", "is", null);

      if (error) throw error;
      
      // Embaralhar aleatoriamente
      return data?.sort(() => Math.random() - 0.5) || [];
    },
    enabled: !!cidade?.id,
  });

  if (isLoading) {
    return (
      <div className="py-6">
        <div className="px-5 mb-4">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex gap-3 px-5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="w-64 h-28 rounded-2xl flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (!ofertas || ofertas.length === 0) {
    return null;
  }

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            🔥 Ofertas da Cidade
          </h2>
          <p className="text-[12px] text-muted-foreground/70">
            Promoções imperdíveis
          </p>
        </div>
        <button
          onClick={() => navigate(`/cidade/${cidadeSlug}/ofertas`)}
          className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
        >
          Ver todas
        </button>
      </div>

      {/* Lista horizontal */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 px-5 pb-2">
          {ofertas.map((oferta) => (
            <button
              key={oferta.id}
              onClick={() =>
                navigate(
                  `/cidade/${cidadeSlug}/servicos/${oferta.categoria}/${oferta.id}`
                )
              }
              className="relative flex-shrink-0 w-64 h-28 rounded-2xl overflow-hidden shadow-md transition-transform active:scale-[0.98]"
            >
              <img
                src={oferta.banner_oferta_url!}
                alt={oferta.nome}
                className="w-full h-full object-cover"
              />
              {/* Overlay com nome */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white text-sm font-semibold truncate">
                  {oferta.nome}
                </p>
              </div>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};

export default OfertasSection;
