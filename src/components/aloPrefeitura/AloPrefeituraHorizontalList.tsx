import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Megaphone, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AloPrefeituraCard from "./AloPrefeituraCard";
import NovaDenunciaModal from "./NovaDenunciaModal";
import type { AloPrefeitura, AloPrefeituraImagem } from "@/types/aloPrefeitura";

interface AloPrefeituraHorizontalListProps {
  cidadeSlug?: string;
}

const AloPrefeituraHorizontalList = ({ cidadeSlug }: AloPrefeituraHorizontalListProps) => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["alo-prefeitura-home", cidadeSlug],
    queryFn: async () => {
      // Busca cidade pelo slug
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return { items: [], cidadeId: null };

      // Busca itens aprovados da cidade
      const { data: itemsData, error: itemsError } = await supabase
        .from("rel_cidade_alo_prefeitura")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .eq("status", "aprovado")
        .order("created_at", { ascending: false })
        .limit(10);

      if (itemsError) throw itemsError;
      if (!itemsData || itemsData.length === 0) return { items: [], cidadeId: cidadeData.id };

      // Busca imagens
      const itemIds = itemsData.map((j) => j.id);
      const { data: imagensData, error: imagensError } = await supabase
        .from("rel_cidade_alo_prefeitura_imagens")
        .select("*")
        .in("alo_prefeitura_id", itemIds)
        .order("ordem");

      if (imagensError) throw imagensError;

      // Agrupa imagens
      const imagensPorItem = (imagensData || []).reduce((acc, img) => {
        if (!acc[img.alo_prefeitura_id]) acc[img.alo_prefeitura_id] = [];
        acc[img.alo_prefeitura_id].push(img as AloPrefeituraImagem);
        return acc;
      }, {} as Record<string, AloPrefeituraImagem[]>);

      return {
        items: itemsData.map((j) => ({
          ...j,
          imagens: imagensPorItem[j.id] || [],
        })) as AloPrefeitura[],
        cidadeId: cidadeData.id,
      };
    },
    enabled: !!cidadeSlug,
  });

  const items = data?.items || [];
  const cidadeId = data?.cidadeId;

  if (isLoading) {
    return (
      <div className="px-5 py-6">
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-64 space-y-3">
              <div className="aspect-[4/3] bg-muted/50 animate-pulse rounded-2xl" />
              <div className="space-y-2">
                <div className="h-2 w-16 bg-muted/50 animate-pulse rounded" />
                <div className="h-4 w-full bg-muted/50 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      {/* Header minimalista */}
      <div className="flex items-center justify-between px-5 mb-1">
        <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <Megaphone className="h-4 w-4 text-primary" />
          Voz do Povo
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="text-xs font-medium px-2.5 py-1 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/15 transition-colors flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Denunciar
          </button>
          <button
            onClick={() => {
              console.log(`[NAV] Alo Prefeitura "Ver todas" clicado, scrollY atual: ${window.scrollY}`);
              navigate(`/cidade/${cidadeSlug}/alo-prefeitura`);
            }}
            className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
          >
            Ver todas
          </button>
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground/70 px-5 mb-3">
        Fale, reclame, cobre. tudo em anônimo
      </p>

      {/* Scroll horizontal */}
      {items.length > 0 ? (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 px-5 pb-2">
            {items.map((item) => (
              <AloPrefeituraCard key={item.id} item={item} cidadeSlug={cidadeSlug} />
            ))}
          </div>
        </div>
      ) : (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma denúncia publicada ainda.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-2 text-sm text-primary font-medium"
          >
            Seja o primeiro a denunciar
          </button>
        </div>
      )}

      {/* Modal de nova denúncia */}
      {cidadeId && (
        <NovaDenunciaModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          cidadeId={cidadeId}
          cidadeSlug={cidadeSlug || ""}
        />
      )}
    </div>
  );
};

export default AloPrefeituraHorizontalList;
