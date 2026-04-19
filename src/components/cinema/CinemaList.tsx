import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film, Clock, Tag, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CinemaCard from "./CinemaCard";
import type { Cinema } from "@/types/cinema";
import cinemaBanner from "@/assets/cinema-banner.jpg";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CinemaListProps {
  cidadeSlug?: string;
}

const cleanText = (value?: string | null): string =>
  (value || "")
    .replace(/`r`n/gi, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getClassificacaoClasses = (classificacao?: string | null): string => {
  const value = cleanText(classificacao).toUpperCase();
  if (!value) return "bg-zinc-100 text-zinc-700 border-zinc-300";
  if (value === "L") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (value.includes("10")) return "bg-blue-100 text-blue-800 border-blue-300";
  if (value.includes("12")) return "bg-amber-100 text-amber-800 border-amber-300";
  if (value.includes("14")) return "bg-orange-100 text-orange-800 border-orange-300";
  if (value.includes("16")) return "bg-red-100 text-red-800 border-red-300";
  if (value.includes("18")) return "bg-zinc-900 text-white border-zinc-900";
  return "bg-zinc-100 text-zinc-700 border-zinc-300";
};

const toLocalTodayIso = () => {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
};

const normalizeIsoDate = (value: string): string | null => {
  const v = value.trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
};

const normalizeDateAny = (value?: string | null): string | null => {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  return null;
};

const getSortedDias = (filme: Cinema): string[] =>
  (filme.dias_exibicao || [])
    .map(normalizeIsoDate)
    .filter((d): d is string => !!d)
    .sort();

const getFirstDiaIso = (filme: Cinema): string | null => {
  const dias = getSortedDias(filme);
  return dias.length > 0 ? dias[0] : null;
};

const getSituacao = (filme: Cinema): string => {
  const situacao = cleanText(filme.situacao_exibicao || filme.status || "").toLowerCase();
  return situacao;
};

const isEmCartazHoje = (filme: Cinema, todayIso: string): boolean => {
  const dias = getSortedDias(filme);
  if (dias.length > 0) return dias.includes(todayIso);

  const situacao = getSituacao(filme);
  if (situacao === "em_cartaz") return true;
  if (situacao === "em_breve" || situacao === "pre_venda") return false;

  const estreia = normalizeDateAny(filme.data_estreia);
  if (!estreia) return false;
  return estreia <= todayIso;
};

const isEmBreve = (filme: Cinema, todayIso: string): boolean => {
  const dias = getSortedDias(filme);
  if (dias.length > 0) return dias[0] > todayIso;

  const situacao = getSituacao(filme);
  if (situacao === "em_breve" || situacao === "pre_venda") return true;
  if (situacao === "em_cartaz") return false;

  const estreia = normalizeDateAny(filme.data_estreia);
  if (!estreia) return false;
  return estreia > todayIso;
};

const toBrDate = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const CinemaList = ({ cidadeSlug }: CinemaListProps) => {
  const [activeTab, setActiveTab] = useState<"em_cartaz" | "em_breve">("em_cartaz");
  const [selectedFilme, setSelectedFilme] = useState<Cinema | null>(null);

  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : null;
  };

  const { data: filmes = [], isLoading } = useQuery({
    queryKey: ["cinema-list", cidadeSlug],
    queryFn: async () => {
      const { data: cidadeData, error: cidadeError } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();

      if (cidadeError) throw cidadeError;
      if (!cidadeData) return [];

      const { data, error } = await supabase
        .from("rel_cidade_cinema")
        .select("*")
        .eq("cidade_id", cidadeData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Cinema[];
    },
    enabled: !!cidadeSlug,
  });

  const todayIso = toLocalTodayIso();
  const filteredFilmes = filmes.filter((f) => {
    if (activeTab === "em_cartaz") {
      return isEmCartazHoje(f, todayIso);
    }
    return isEmBreve(f, todayIso);
  });
  const orderedFilmes = [...filteredFilmes].sort((a, b) => {
    if (activeTab !== "em_breve") return 0;
    const aDate = getFirstDiaIso(a) || "9999-99-99";
    const bDate = getFirstDiaIso(b) || "9999-99-99";
    return aDate.localeCompare(bDate);
  });
  const getEstreiaBr = (filme: Cinema): string | null => {
    if (filme.data_estreia) return toBrDate(filme.data_estreia);
    const dias = getSortedDias(filme);
    if (dias.length === 0) return null;
    return toBrDate(dias[0]);
  };
  const embedUrl = selectedFilme?.trailer_url
    ? getYouTubeEmbedUrl(selectedFilme.trailer_url)
    : null;

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-28 h-40 bg-muted/50 animate-pulse rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-3/4 bg-muted/50 animate-pulse rounded" />
              <div className="h-3 w-1/2 bg-muted/50 animate-pulse rounded" />
              <div className="h-3 w-full bg-muted/50 animate-pulse rounded" />
              <div className="flex gap-1.5 mt-4">
                <div className="h-5 w-12 bg-muted/50 animate-pulse rounded-full" />
                <div className="h-5 w-12 bg-muted/50 animate-pulse rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Banner Hero */}
      <div className="relative h-52 overflow-hidden border-b border-border">
        <img
          src={cinemaBanner}
          alt="Cinema"
          className="w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/35 to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,160,46,0.38),transparent_45%)]" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3 backdrop-blur-md shadow-lg">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90">
              <Film className="h-3.5 w-3.5" />
              Cinema da cidade
            </div>
            <h2 className="mt-2 text-[22px] leading-tight font-black text-white">
              Filmes em Cartaz
            </h2>
            <p className="mt-1 text-xs text-white/80">
              Sessoes, horarios e trailers para voce escolher.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-4">
        <button
          onClick={() => setActiveTab("em_cartaz")}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
            activeTab === "em_cartaz"
              ? "text-primary"
              : "text-muted-foreground"
          }`}
        >
          Em Cartaz
          {activeTab === "em_cartaz" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("em_breve")}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
            activeTab === "em_breve"
              ? "text-primary"
              : "text-muted-foreground"
          }`}
        >
          Em Breve
          {activeTab === "em_breve" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {/* Lista de filmes */}
      {filteredFilmes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Film className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">
            {activeTab === "em_cartaz"
              ? "Nenhum filme em cartaz"
              : "Nenhum filme em breve"}
          </p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-5">
          {orderedFilmes.map((filme) => (
            <div key={filme.id} onClick={() => setSelectedFilme(filme)} className="cursor-pointer">
              <CinemaCard
                cinema={filme}
                showHorarios={activeTab === "em_cartaz"}
                onOpenDetails={() => setSelectedFilme(filme)}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedFilme} onOpenChange={(open) => !open && setSelectedFilme(null)}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg p-0 overflow-hidden rounded-[10px] max-h-[85vh] flex flex-col">
          {selectedFilme && (
            <div className="overflow-y-auto flex-1">
              {selectedFilme.banner_url && (
                <div className="aspect-[2/3] max-h-[280px] w-full overflow-hidden">
                  <img
                    src={selectedFilme.banner_url}
                    alt={cleanText(selectedFilme.nome_filme)}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-4 space-y-3">
                <DialogHeader>
                  <DialogTitle className="text-lg leading-tight">
                    {cleanText(selectedFilme.nome_filme)}
                  </DialogTitle>
                </DialogHeader>
                {(selectedFilme.classificacao || getEstreiaBr(selectedFilme)) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedFilme.classificacao && (
                      <Badge variant="outline" className={`text-[11px] h-6 ${getClassificacaoClasses(selectedFilme.classificacao)}`}>
                        Classificacao: {selectedFilme.classificacao}
                      </Badge>
                    )}
                    {getEstreiaBr(selectedFilme) && (
                      <span className="text-xs text-muted-foreground">
                        Estreia: {getEstreiaBr(selectedFilme)}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedFilme.genero && (
                    <Badge variant="outline" className="text-[11px] h-6 gap-1 bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700">
                      <Tag className="h-3 w-3" />
                      {cleanText(selectedFilme.genero)}
                    </Badge>
                  )}
                  {selectedFilme.duracao && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Timer className="h-3.5 w-3.5" />
                      {cleanText(selectedFilme.duracao)}
                    </span>
                  )}
                </div>

                {selectedFilme.sinopse && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cleanText(selectedFilme.sinopse)}
                  </p>
                )}

                {selectedFilme.horarios && selectedFilme.horarios.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium text-foreground">Horarios</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedFilme.horarios.map((hora, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-medium px-3 py-1 rounded-full bg-red-600 text-white"
                        >
                          {hora}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {embedUrl && (
                  <div className="pt-1">
                    <div className="aspect-video w-full rounded-xl overflow-hidden">
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CinemaList;

