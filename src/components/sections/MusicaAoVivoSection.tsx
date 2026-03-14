import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Music2, MapPin, UserRound, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MusicaAoVivoSectionProps {
  cidadeSlug?: string;
}

interface EventoMusicalItem {
  id: string;
  bar_id: string;
  cantor_id: string;
  data_evento: string;
  horario: string | null;
  estilo_musical: string | null;
  bar?: { nome_bar: string; logo?: string | null; local?: string | null } | null;
  cantor?: { nome: string; foto?: string | null; instagram?: string | null } | null;
}

const MusicaAoVivoSection = ({ cidadeSlug }: MusicaAoVivoSectionProps) => {
  const [eventoSelecionado, setEventoSelecionado] = useState<EventoMusicalItem | null>(null);

  const normalizarFotoCantor = (foto?: string | null) => {
    if (!foto) return null;

    let valor = String(foto).trim().replace(/^"+|"+$/g, "");
    if (!valor) return null;

    if (valor.startsWith("[") && valor.endsWith("]")) {
      try {
        const parsed = JSON.parse(valor);
        if (Array.isArray(parsed) && parsed[0]) {
          valor = String(parsed[0]).trim();
        }
      } catch {
        // ignora parse error
      }
    }

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

  const formatarDataShow = (dataEvento: string, horario?: string | null) => {
    const d = new Date(`${dataEvento}T00:00:00`);
    const diaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
      .format(d)
      .replace(".", "")
      .toLowerCase();
    const data = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }).format(d);

    const horaFormatada = extrairHora(dataEvento, horario);

    return {
      linha1: `${diaSemana}, ${data}`,
      linha2: horaFormatada ? `${horaFormatada} hrs` : "hora a definir",
    };
  };

  const formatarDataBadge = (dataEvento: string) => {
    const d = new Date(`${dataEvento}T00:00:00`);
    const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(d);
    const mes = new Intl.DateTimeFormat("pt-BR", { month: "short" })
      .format(d)
      .replace(".", "")
      .toLowerCase();
    return { dia, mes };
  };

  const getMapaEmbedUrl = (item: EventoMusicalItem) => {
    const busca = item.bar?.local || item.bar?.nome_bar || "";
    if (!busca) return null;
    return `https://www.google.com/maps?q=${encodeURIComponent(busca)}&output=embed`;
  };

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["musica-ao-vivo-home", cidadeSlug],
    queryFn: async () => {
      const now = new Date();
      const hoje = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const { data: eventosData, error: eventosError } = await supabase
        .from("evento_musical")
        .select("id, bar_id, cantor_id, data_evento, horario, estilo_musical")
        .gte("data_evento", hoje)
        .order("data_evento", { ascending: true });

      if (eventosError) {
        console.warn("[MusicaAoVivoSection] erro ao buscar eventos:", eventosError.message);
        return [];
      }

      const eventosBase = (eventosData || []) as EventoMusicalItem[];
      if (eventosBase.length === 0) return [];

      const barIds = Array.from(new Set(eventosBase.map((e) => e.bar_id).filter(Boolean)));
      const cantorIds = Array.from(new Set(eventosBase.map((e) => e.cantor_id).filter(Boolean)));

      const [{ data: barsData }, { data: cantoresData }] = await Promise.all([
        supabase.from("bar").select("id, nome_bar, logo, local").in("id", barIds),
        supabase.from("cantor").select("id, nome, foto, instagram").in("id", cantorIds),
      ]);

      const barsMap = new Map((barsData || []).map((b: any) => [b.id, b]));
      const cantoresMap = new Map((cantoresData || []).map((c: any) => [c.id, c]));

      const eventosComRelacionamento = eventosBase.map((evento) => ({
        ...evento,
        bar: barsMap.get(evento.bar_id) || null,
        cantor: cantoresMap.get(evento.cantor_id) || null,
      }));

      // Ordena do mais próximo para o mais distante considerando data + horário.
      return eventosComRelacionamento.sort((a, b) => {
        const horaA = extrairHora(a.data_evento, a.horario) || "00:00";
        const horaB = extrairHora(b.data_evento, b.horario) || "00:00";
        const dateA = new Date(`${a.data_evento}T${horaA}:00`).getTime();
        const dateB = new Date(`${b.data_evento}T${horaB}:00`).getTime();
        return dateA - dateB;
      });
    },
    enabled: !!cidadeSlug,
  });

  if (isLoading) {
    return (
      <div className="py-6 px-5">
        <div className="space-y-2">
          <div className="h-5 w-36 bg-muted animate-pulse rounded-lg" />
          <div className="h-3 w-56 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (eventos.length === 0) return null;

  return (
    <div className="py-6">
      <div className="flex items-center justify-between px-5 mb-1">
        <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <Music2 className="h-4 w-4 text-primary" />
          Musica ao vivo
        </h2>
      </div>
      <p className="text-[12px] text-muted-foreground/70 px-5 mb-3">
        Confira os proximos shows nos bares da cidade
      </p>

      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-4 px-5 pb-2">
          {eventos.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setEventoSelecionado(item)}
              className="min-w-[170px] max-w-[170px] text-left"
            >
              <div className="relative h-[230px] rounded-[20px] overflow-hidden shadow-lg border border-white/10">
                {normalizarFotoCantor(item.cantor?.foto) || item.bar?.logo ? (
                  <img
                    src={normalizarFotoCantor(item.cantor?.foto) || item.bar?.logo || ""}
                    alt={item.cantor?.nome || item.bar?.nome_bar || "Show"}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900" />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/20" />

                <div className="absolute top-2 left-12 right-2 rounded-full bg-black/55 px-2 py-0.5 border border-white/20">
                  <p className="text-[10px] text-white/95 font-semibold truncate">
                    {item.bar?.nome_bar || "Bar"}
                  </p>
                </div>
                {item.bar?.logo ? (
                  <div className="absolute top-2 left-2 h-8 w-8 rounded-full overflow-hidden border border-white/40 shadow-md bg-white/10">
                    <img
                      src={item.bar.logo}
                      alt={item.bar?.nome_bar || "Logo do bar"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}

                <div className="absolute left-3 right-3 bottom-3">
                  <p className="text-[22px] leading-[1] font-bold text-white drop-shadow-md line-clamp-1">
                    {item.cantor?.nome || "Cantor"}
                  </p>
                  <p className="text-[11px] text-white/85 mt-1 line-clamp-1">
                    {item.estilo_musical || "Show ao vivo"} • {formatarDataShow(item.data_evento, item.horario).linha2}
                  </p>
                </div>

                <div className="absolute bottom-3 right-3 rounded-2xl bg-blue-600/90 border border-blue-300/30 px-2 py-1.5 text-center min-w-[50px]">
                  <p className="text-[14px] font-bold text-white leading-none">{formatarDataBadge(item.data_evento).dia}</p>
                  <p className="text-[10px] font-medium text-white/95 leading-none mt-1">{formatarDataBadge(item.data_evento).mes}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={!!eventoSelecionado} onOpenChange={(open) => !open && setEventoSelecionado(null)}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg rounded-[14px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do show</DialogTitle>
          </DialogHeader>

          {eventoSelecionado && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-3">
                <p className="text-sm font-semibold text-foreground">
                  {eventoSelecionado.estilo_musical || "Show ao vivo"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatarDataShow(eventoSelecionado.data_evento, eventoSelecionado.horario).linha1} • {formatarDataShow(eventoSelecionado.data_evento, eventoSelecionado.horario).linha2}
                </p>
              </div>

              <div className="rounded-xl border bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Bar</p>
                </div>
                <p className="text-sm text-foreground">{eventoSelecionado.bar?.nome_bar || "Bar nao informado"}</p>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 mt-0.5" />
                  <p>{eventoSelecionado.bar?.local || "Localizacao nao informada"}</p>
                </div>
                {getMapaEmbedUrl(eventoSelecionado) ? (
                  <div className="overflow-hidden rounded-lg border">
                    <iframe
                      title={`Mapa ${eventoSelecionado.bar?.nome_bar || ""}`}
                      src={getMapaEmbedUrl(eventoSelecionado) || ""}
                      width="100%"
                      height="170"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Cantor</p>
                </div>
                <div className="flex items-center gap-3">
                  {normalizarFotoCantor(eventoSelecionado.cantor?.foto) ? (
                    <img
                      src={normalizarFotoCantor(eventoSelecionado.cantor?.foto) || ""}
                      alt={eventoSelecionado.cantor?.nome || "Cantor"}
                      className="h-12 w-12 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                      {(eventoSelecionado.cantor?.nome || "C").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">{eventoSelecionado.cantor?.nome || "Cantor nao informado"}</p>
                    {eventoSelecionado.cantor?.instagram?.trim() ? (
                      <a
                        href={`https://instagram.com/${eventoSelecionado.cantor.instagram.replace(/^@/, "").trim()}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline underline-offset-2"
                      >
                        Instagram: @{eventoSelecionado.cantor.instagram.replace(/^@/, "").trim()}
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">Instagram nao informado</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MusicaAoVivoSection;
