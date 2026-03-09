import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Megaphone, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import NovaDenunciaModal from "./NovaDenunciaModal";
import type { AloPrefeitura, AloPrefeituraImagem } from "@/types/aloPrefeitura";

interface AloPrefeituraVerticalListProps {
  cidadeSlug?: string;
}

const AloPrefeituraVerticalList = ({ cidadeSlug }: AloPrefeituraVerticalListProps) => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["alo-prefeitura-section", cidadeSlug],
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
        .order("created_at", { ascending: false });

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
      <div className="px-4 py-4">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-24 h-20 bg-muted/50 animate-pulse rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-2 w-16 bg-muted/50 animate-pulse rounded" />
                <div className="h-3 w-full bg-muted/50 animate-pulse rounded" />
                <div className="h-3 w-3/4 bg-muted/50 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header com título e botão */}
      <div className="px-4 py-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Voz do Povo</h2>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="text-sm font-medium px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Denunciar
          </button>
        </div>
        <p className="text-[12px] text-muted-foreground/70 mt-1">
          Denúncias e reclamações da comunidade
        </p>
      </div>

      {/* Lista vertical */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              Nenhuma denúncia publicada ainda.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="text-sm text-primary font-medium"
            >
              Seja o primeiro a denunciar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const primeiraImagem = item.imagens?.[0]?.imagem_url;
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/cidade/${cidadeSlug}/alo-prefeitura/${item.id}`)}
                  className="flex gap-3 cursor-pointer group"
                >
                  {/* Thumbnail */}
                  <div className="w-24 h-20 rounded-xl overflow-hidden bg-muted/30 flex-shrink-0">
                    {primeiraImagem ? (
                      <img
                        src={primeiraImagem}
                        alt={item.titulo}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted/20 to-muted/40 flex items-center justify-center">
                        <Megaphone className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">
                      {format(new Date(item.created_at), "dd MMM", { locale: ptBR })}
                    </p>
                    <h3 className="text-[13px] font-medium text-foreground line-clamp-2 leading-tight tracking-tight">
                      {item.titulo}
                    </h3>
                    {item.descricao && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {item.descricao}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

export default AloPrefeituraVerticalList;
