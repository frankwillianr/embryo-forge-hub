import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import BottomNavBar from "@/components/navigation/BottomNavBar";
import { useSwipeBack } from "@/hooks/useSwipeBack";

interface EventoMusicalItem {
  id: string;
  bar_id: string;
  cantor_id: string | null;
  data_evento: string;
  horario: string | null;
  estilo_musical: string | null;
  banner_evento: string | null;
  bar?: { nome_bar: string; logo?: string | null; local?: string | null; cidade?: string | null } | null;
}

const normalizeText = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizarImagem = (value?: string | null) => {
  if (!value) return null;
  let valor = String(value).trim().replace(/^"+|"+$/g, "");
  if (!valor) return null;
  if (/^https?:\/\//i.test(valor)) return valor;
  const baseUrl = "https://umauozcntfxgphzbiifz.supabase.co";
  const path = valor.replace(/^\/+/, "");
  return `${baseUrl}/storage/v1/object/public/avatars/${path}`;
};

const extrairHora = (dataEvento: string, horario?: string | null) => {
  const candidatos = [horario || "", dataEvento || ""];
  for (const valor of candidatos) {
    const texto = String(valor).trim();
    if (!texto) continue;
    const match = texto.match(/(\d{1,2}):(\d{2})/);
    if (!match) continue;
    const hh = match[1].padStart(2, "0");
    const mm = match[2];
    return `${hh}:${mm}`;
  }
  return null;
};

const formatarDataBadge = (dataEvento: string) => {
  const d = new Date(`${dataEvento}T00:00:00`);
  const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(d);
  const diaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(d)
    .replace(".", "")
    .toLowerCase();
  const mes = new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(d)
    .replace(".", "")
    .toLowerCase();
  return { dia, diaSemana, mes };
};

const MusicaAoVivoListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useSwipeBack({ onBack: () => navigate(`/cidade/${slug}`) });

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["musica-ao-vivo-lista", slug],
    queryFn: async () => {
      const now = new Date();
      const hoje = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const { data: cidadeData } = await supabase
        .from("cidade")
        .select("nome")
        .eq("slug", slug)
        .maybeSingle();
      if (!cidadeData?.nome || !slug) return [];

      const cidadeNomeNormalizado = normalizeText(cidadeData.nome);
      const cidadeSlugNormalizado = normalizeText(slug).replace(/-/g, " ");

      const { data: barsData, error: barsError } = await supabase
        .from("bar")
        .select("id, nome_bar, logo, local, cidade")
        .or(`cidade.ilike.%${cidadeData.nome}%,cidade.ilike.%${slug}%`);
      if (barsError) return [];

      const barsFiltrados = (barsData || []).filter((bar: any) => {
        const cidadeBar = normalizeText(bar.cidade);
        return cidadeBar === cidadeNomeNormalizado || cidadeBar === cidadeSlugNormalizado;
      });

      const barIds = Array.from(new Set(barsFiltrados.map((b: any) => b.id)));
      if (!barIds.length) return [];

      const { data: eventosData, error: eventosError } = await supabase
        .from("evento_musical")
        .select("id, bar_id, cantor_id, data_evento, horario, estilo_musical, banner_evento")
        .gte("data_evento", hoje)
        .in("bar_id", barIds)
        .order("data_evento", { ascending: true });
      if (eventosError) return [];

      const barsMap = new Map((barsFiltrados || []).map((b: any) => [b.id, b]));
      const lista = ((eventosData || []) as EventoMusicalItem[]).map((evento) => ({
        ...evento,
        bar: barsMap.get(evento.bar_id) || null,
      }));

      return lista.sort((a, b) => {
        const horaA = extrairHora(a.data_evento, a.horario) || "00:00";
        const horaB = extrairHora(b.data_evento, b.horario) || "00:00";
        return new Date(`${a.data_evento}T${horaA}:00`).getTime() - new Date(`${b.data_evento}T${horaB}:00`).getTime();
      });
    },
    enabled: !!slug,
  });

  return (
    <div id="swipe-back-page" className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold flex-1">Música ao vivo</h1>
      </header>

      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : eventos.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum show encontrado.
          </div>
        ) : (
          <div className="space-y-3">
            {eventos.map((item) => {
              const badge = formatarDataBadge(item.data_evento);
              const hora = extrairHora(item.data_evento, item.horario) || "hora a definir";
              return (
                <div key={item.id} className="relative overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex min-h-[92px]">
                    <div className="w-24 h-auto relative shrink-0">
                      {normalizarImagem(item.banner_evento) ? (
                        <img
                          src={normalizarImagem(item.banner_evento) || ""}
                          alt={item.bar?.nome_bar || "Show"}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900" />
                      )}
                    </div>
                    <div className="flex-1 p-3 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.bar?.nome_bar || "Bar"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.estilo_musical || "Show ao vivo"}</p>
                      <p className="text-xs text-muted-foreground mt-1">{hora} hrs</p>
                    </div>
                    <div className="px-2 py-2 flex items-center">
                      <div className="rounded-xl bg-blue-600/90 border border-blue-300/30 px-2 py-1.5 text-center min-w-[54px]">
                        <p className="text-[14px] font-bold text-white leading-none">{badge.dia}</p>
                        <p className="text-[10px] font-semibold uppercase text-white/95 leading-none mt-1">{badge.diaSemana}</p>
                        <p className="text-[10px] font-medium text-white/95 leading-none mt-1">{badge.mes}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNavBar slug={slug} />
    </div>
  );
};

export default MusicaAoVivoListPage;
