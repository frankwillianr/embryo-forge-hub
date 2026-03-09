import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Clock,
  MessageCircle,
  Instagram,
  Phone,
  ChevronDown,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIAS_SERVICO } from "@/lib/categoriasServico";

const BOLA_SIZE = 44;
const BOLA_ANCHOR = BOLA_SIZE / 2;

function createBolaLogoIcon(empresa: EmpresaMapa): L.DivIcon {
  const escapedUrl = empresa.logomarca_url
    ? empresa.logomarca_url.replace(/"/g, "&quot;").replace(/</g, "&lt;")
    : "";
  const inicial = ((empresa.nome?.trim() || "?")[0].toUpperCase()).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = empresa.logomarca_url
    ? `<div class="mapa-bola-logo" style="width:${BOLA_SIZE}px;height:${BOLA_SIZE}px;border-radius:50%;overflow:hidden;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);background:#e5e7eb;"><img src="${escapedUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" /></div>`
    : `<div class="mapa-bola-logo mapa-bola-fallback" style="width:${BOLA_SIZE}px;height:${BOLA_SIZE}px;border-radius:50%;overflow:hidden;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);background:#6366f1;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;">${inicial}</div>`;
  return L.divIcon({
    html,
    className: "mapa-bola-wrapper leaflet-div-icon",
    iconSize: [BOLA_SIZE, BOLA_SIZE],
    iconAnchor: [BOLA_ANCHOR, BOLA_ANCHOR],
  });
}

const GV_CENTER: [number, number] = [-18.8544, -41.9453];
const GV_ZOOM = 13;
const GV_MIN_ZOOM = 14;
const GV_MAX_ZOOM = 18;

const diasOrdem = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

type EmpresaMapa = {
  id: string;
  nome: string;
  categoria: string;
  latitude: number;
  longitude: number;
  logomarca_url: string | null;
};

type HorarioDia = { dia: string; aberto: boolean; abertura: string; fechamento: string };
type EmpresaCompleta = EmpresaMapa & {
  descricao: string | null;
  whatsapp: string | null;
  instagram: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_complemento: string | null;
  endereco_cep: string | null;
  horario_funcionamento: HorarioDia[] | null;
  banner_oferta_url: string | null;
  video_url: string | null;
  fotos?: { id: string; url: string; ordem: number }[];
};

interface MapaEmpresasViewProps {
  cidadeId: string;
  cidadeSlug: string;
  cidadeNome?: string;
  onClose: () => void;
}

function AjustarBounds({ empresas }: { empresas: EmpresaMapa[] }) {
  const map = useMap();
  useEffect(() => {
    if (empresas.length === 0) return;
    if (empresas.length === 1) {
      map.setView([empresas[0].latitude, empresas[0].longitude], 15);
      return;
    }
    const bounds = L.latLngBounds(
      empresas.map((e) => [e.latitude, e.longitude] as L.LatLngExpression)
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [map, empresas]);
  return null;
}

function AplicarLimitesZoom() {
  const map = useMap();
  useEffect(() => {
    map.setMinZoom(GV_MIN_ZOOM);
    map.setMaxZoom(GV_MAX_ZOOM);
    const curZoom = map.getZoom();
    if (curZoom < GV_MIN_ZOOM) map.setZoom(GV_MIN_ZOOM);
    if (curZoom > GV_MAX_ZOOM) map.setZoom(GV_MAX_ZOOM);
  }, [map]);
  return null;
}

export default function MapaEmpresasView({
  cidadeId,
  cidadeSlug,
  cidadeNome,
  onClose,
}: MapaEmpresasViewProps) {
  const navigate = useNavigate();
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAllHours, setShowAllHours] = useState(false);

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["mapa-empresas", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome, categoria, latitude, longitude, logomarca_url")
        .eq("cidade_id", cidadeId)
        .eq("status", "ativo")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return (data || []) as EmpresaMapa[];
    },
    enabled: !!cidadeId,
  });

  const { data: empresaDetalhe, isLoading: loadingDetalhe } = useQuery({
    queryKey: ["mapa-empresa-detalhe", selectedEmpresaId],
    queryFn: async () => {
      if (!selectedEmpresaId) return null;
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select(`
          id, nome, categoria, latitude, longitude, descricao, whatsapp, instagram,
          endereco_rua, endereco_numero, endereco_bairro, endereco_complemento, endereco_cep,
          horario_funcionamento, banner_oferta_url, video_url, logomarca_url,
          fotos:rel_cidade_servico_empresa_foto(id, url, ordem)
        `)
        .eq("id", selectedEmpresaId)
        .maybeSingle();
      if (error) throw error;
      return data as EmpresaCompleta | null;
    },
    enabled: !!selectedEmpresaId,
  });

  // Reset state when modal opens
  useEffect(() => {
    if (selectedEmpresaId) {
      setCurrentImageIndex(0);
      setShowAllHours(false);
    }
  }, [selectedEmpresaId]);

  const formatEndereco = (e: EmpresaCompleta) => {
    const parts = [e.endereco_rua, e.endereco_numero, e.endereco_bairro].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const formatWhatsApp = (num: string) => {
    if (!num) return "";
    return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
  };

  const getStatusHoje = (horarios: HorarioDia[] | null) => {
    if (!horarios?.length) return { aberto: false, texto: "", horario: null };
    const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const hoje = dias[new Date().getDay()];
    const h = horarios.find((x) => x.dia === hoje);
    if (!h?.aberto) return { aberto: false, texto: "Fechado hoje", horario: null };
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();
    const [ah, am] = h.abertura.split(":").map(Number);
    const [fh, fm] = h.fechamento.split(":").map(Number);
    const a = ah * 60 + am;
    const f = fh * 60 + fm;
    if (min >= a && min < f) return { aberto: true, texto: "Aberto agora", horario: `Fecha às ${h.fechamento}` };
    if (min < a) return { aberto: false, texto: "Fechado", horario: `Abre às ${h.abertura}` };
    return { aberto: false, texto: "Fechado", horario: null };
  };

  const handleWhatsApp = (whatsapp: string) => {
    const message = encodeURIComponent("Olá! Vi seu perfil no app e gostaria de mais informações.");
    window.open(`https://wa.me/55${whatsapp}?text=${message}`, "_blank");
  };

  const handleInstagram = (instagram: string) => {
    window.open(`https://instagram.com/${instagram}`, "_blank");
  };

  const images = empresaDetalhe?.fotos
    ? [...empresaDetalhe.fotos].sort((a, b) => a.ordem - b.ordem)
    : [];

  const horariosOrdenados = empresaDetalhe?.horario_funcionamento
    ? [...empresaDetalhe.horario_funcionamento].sort(
        (a, b) => diasOrdem.indexOf(a.dia) - diasOrdem.indexOf(b.dia)
      )
    : [];

  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-40 flex flex-col bg-background">
      <header className="flex items-center gap-3 p-4 pt-safe border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">
          Mapa{cidadeNome ? ` – ${cidadeNome}` : ""}
        </h1>
      </header>
      <div className="flex-1 min-h-0 w-full relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-[1000]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : null}
        <MapContainer
          center={GV_CENTER}
          zoom={GV_ZOOM}
          minZoom={GV_MIN_ZOOM}
          maxZoom={GV_MAX_ZOOM}
          className="w-full h-full z-0"
          scrollWheelZoom
        >
          <AplicarLimitesZoom />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {empresas.map((empresa) => (
            <Marker
              key={empresa.id}
              position={[empresa.latitude, empresa.longitude]}
              icon={createBolaLogoIcon(empresa)}
              eventHandlers={{
                click: () => setSelectedEmpresaId(empresa.id),
              }}
            />
          ))}
          <AjustarBounds empresas={empresas} />
        </MapContainer>
        {!isLoading && empresas.length === 0 ? (
          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-lg bg-background/95 backdrop-blur border border-border px-3 py-2 text-sm text-muted-foreground shadow-sm">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>
              Nenhuma empresa com localização no mapa ainda.
            </span>
          </div>
        ) : null}
      </div>

      {/* Modal da empresa */}
      <Dialog open={!!selectedEmpresaId} onOpenChange={(open) => !open && setSelectedEmpresaId(null)}>
        <DialogContent className="w-[calc(100%-20px)] max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0 rounded-[10px]">
          <VisuallyHidden>
            <DialogTitle>Empresa</DialogTitle>
            <DialogDescription>Informações da empresa</DialogDescription>
          </VisuallyHidden>
          {loadingDetalhe ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : empresaDetalhe ? (
            <>
              {/* Botão fechar */}
              <button
                onClick={() => setSelectedEmpresaId(null)}
                className="absolute top-3 right-3 z-10 p-2 bg-background/80 backdrop-blur-md rounded-full border border-border/50"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Imagem */}
              <div className="relative aspect-[4/3] bg-muted">
                {images.length > 0 ? (
                  <>
                    <img
                      src={images[currentImageIndex].url}
                      alt={empresaDetalhe.nome}
                      className="w-full h-full object-cover"
                    />
                    {images.length > 1 && (
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                        {images.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentImageIndex(index)}
                            className={`h-1.5 rounded-full transition-all ${
                              index === currentImageIndex
                                ? "w-5 bg-white"
                                : "w-1.5 bg-white/50"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : empresaDetalhe.banner_oferta_url ? (
                  <img
                    src={empresaDetalhe.banner_oferta_url}
                    alt={empresaDetalhe.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-5xl">🏢</span>
                  </div>
                )}
              </div>

              {/* Conteúdo */}
              <div className="p-5 space-y-5">
                {/* Cabeçalho */}
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    {empresaDetalhe.logomarca_url && (
                      <img
                        src={empresaDetalhe.logomarca_url}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover border border-border"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-foreground leading-tight">
                        {empresaDetalhe.nome}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {CATEGORIAS_SERVICO[empresaDetalhe.categoria] || empresaDetalhe.categoria}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  {getStatusHoje(empresaDetalhe.horario_funcionamento).texto && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-sm ${
                          getStatusHoje(empresaDetalhe.horario_funcionamento).aberto
                            ? "text-green-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            getStatusHoje(empresaDetalhe.horario_funcionamento).aberto
                              ? "bg-green-500"
                              : "bg-muted-foreground"
                          }`}
                        />
                        {getStatusHoje(empresaDetalhe.horario_funcionamento).texto}
                      </span>
                      {getStatusHoje(empresaDetalhe.horario_funcionamento).horario && (
                        <span className="text-sm text-muted-foreground">
                          · {getStatusHoje(empresaDetalhe.horario_funcionamento).horario}
                        </span>
                      )}
                    </div>
                  )}

                  {empresaDetalhe.descricao && (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {empresaDetalhe.descricao}
                    </p>
                  )}
                </div>

                {/* Ações */}
                <div className="flex gap-3">
                  {empresaDetalhe.whatsapp && (
                    <button
                      onClick={() => handleWhatsApp(empresaDetalhe.whatsapp!)}
                      className="flex-1 h-11 flex items-center justify-center gap-2 text-sm font-medium rounded-xl border border-border hover:bg-muted/50 transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </button>
                  )}
                  {empresaDetalhe.instagram && (
                    <button
                      onClick={() => handleInstagram(empresaDetalhe.instagram!)}
                      className="h-11 px-5 flex items-center justify-center rounded-xl border border-border hover:bg-muted/50 transition-colors"
                    >
                      <Instagram className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Vídeo */}
                {empresaDetalhe.video_url && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Vídeo
                    </h3>
                    <div className="rounded-xl overflow-hidden bg-black">
                      <video
                        src={empresaDetalhe.video_url}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {/* Informações */}
                <div className="space-y-1">
                  {/* Telefone */}
                  {empresaDetalhe.whatsapp && (
                    <div className="flex items-center gap-4 p-3 rounded-xl">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Telefone</p>
                        <p className="text-sm font-medium">{formatWhatsApp(empresaDetalhe.whatsapp)}</p>
                      </div>
                    </div>
                  )}

                  {/* Endereço */}
                  {formatEndereco(empresaDetalhe) && (
                    <div className="flex items-start gap-4 p-3 rounded-xl">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Endereço</p>
                        <p className="text-sm font-medium">
                          {formatEndereco(empresaDetalhe)}
                          {empresaDetalhe.endereco_complemento && ` - ${empresaDetalhe.endereco_complemento}`}
                        </p>
                        {empresaDetalhe.endereco_cep && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            CEP {empresaDetalhe.endereco_cep}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Horários */}
                  {horariosOrdenados.length > 0 && (
                    <div className="rounded-xl">
                      <button
                        onClick={() => setShowAllHours(!showAllHours)}
                        className="w-full flex items-center gap-4 p-3 hover:bg-muted/50 rounded-xl transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-xs text-muted-foreground">Horários</p>
                          <p className="text-sm font-medium">Ver todos os horários</p>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            showAllHours ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {showAllHours && (
                        <div className="px-3 pb-3 pt-1 space-y-1.5">
                          {horariosOrdenados.map((h) => {
                            const isHoje =
                              diasOrdem.indexOf(h.dia) ===
                              (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
                            return (
                              <div
                                key={h.dia}
                                className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-sm ${
                                  isHoje ? "bg-muted/70" : ""
                                }`}
                              >
                                <span className={isHoje ? "font-medium" : "text-muted-foreground"}>
                                  {h.dia}
                                  {isHoje && (
                                    <span className="ml-1.5 text-xs text-muted-foreground">(hoje)</span>
                                  )}
                                </span>
                                <span className={h.aberto ? "" : "text-muted-foreground"}>
                                  {h.aberto ? `${h.abertura} - ${h.fechamento}` : "Fechado"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Botão ver página completa */}
                <button
                  onClick={() => {
                    setSelectedEmpresaId(null);
                    navigate(`/cidade/${cidadeSlug}/servicos/${empresaDetalhe.categoria}/${empresaDetalhe.id}`);
                  }}
                  className="w-full flex items-center justify-center gap-2 h-12 bg-muted/80 text-foreground rounded-full text-sm font-medium border border-border/50 hover:bg-muted transition-colors"
                >
                  Ver página completa
                </button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
