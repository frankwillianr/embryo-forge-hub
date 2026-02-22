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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, MapPin, Clock, MessageCircle, Instagram, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIAS_SERVICO } from "@/lib/categoriasServico";

// Ícone padrão do Leaflet quebra com bundlers; usar um marcador customizado
const createDefaultIcon = () =>
  L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

const GV_CENTER: [number, number] = [-18.8544, -41.9453];
const GV_ZOOM = 13;

type EmpresaMapa = {
  id: string;
  nome: string;
  categoria: string;
  latitude: number;
  longitude: number;
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

export default function MapaEmpresasView({
  cidadeId,
  cidadeSlug,
  cidadeNome,
  onClose,
}: MapaEmpresasViewProps) {
  const navigate = useNavigate();
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(null);

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["mapa-empresas", cidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, nome, categoria, latitude, longitude")
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
          horario_funcionamento, banner_oferta_url,
          fotos:rel_cidade_servico_empresa_foto(id, url, ordem)
        `)
        .eq("id", selectedEmpresaId)
        .maybeSingle();
      if (error) throw error;
      return data as EmpresaCompleta | null;
    },
    enabled: !!selectedEmpresaId,
  });

  const defaultIcon = createDefaultIcon();

  const formatEndereco = (e: EmpresaCompleta) => {
    const parts = [e.endereco_rua, e.endereco_numero, e.endereco_bairro].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const getStatusHoje = (horarios: HorarioDia[] | null) => {
    if (!horarios?.length) return { texto: "" };
    const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const hoje = dias[new Date().getDay()];
    const h = horarios.find((x) => x.dia === hoje);
    if (!h?.aberto) return { texto: "Fechado hoje" };
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();
    const [ah, am] = h.abertura.split(":").map(Number);
    const [fh, fm] = h.fechamento.split(":").map(Number);
    const a = ah * 60 + am;
    const f = fh * 60 + fm;
    if (min >= a && min < f) return { texto: `Aberto · Fecha às ${h.fechamento}` };
    if (min < a) return { texto: `Abre às ${h.abertura}` };
    return { texto: "Fechado" };
  };

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
          className="w-full h-full z-0"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {empresas.map((empresa) => (
            <Marker
              key={empresa.id}
              position={[empresa.latitude, empresa.longitude]}
              icon={defaultIcon}
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
              Nenhuma empresa com localização no mapa ainda. As empresas podem
              cadastrar endereço e coordenadas no perfil.
            </span>
          </div>
        ) : null}
      </div>

      <Dialog open={!!selectedEmpresaId} onOpenChange={(open) => !open && setSelectedEmpresaId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {loadingDetalhe ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : empresaDetalhe ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{empresaDetalhe.nome}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {CATEGORIAS_SERVICO[empresaDetalhe.categoria] || empresaDetalhe.categoria}
                </p>
                {empresaDetalhe.descricao && (
                  <p className="text-sm text-foreground/90 leading-relaxed">{empresaDetalhe.descricao}</p>
                )}
                {(empresaDetalhe.banner_oferta_url || (empresaDetalhe.fotos?.length && empresaDetalhe.fotos[0]?.url)) && (
                  <div className="rounded-xl overflow-hidden bg-muted aspect-video">
                    <img
                      src={empresaDetalhe.banner_oferta_url || empresaDetalhe.fotos?.[0]?.url}
                      alt={empresaDetalhe.nome}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {getStatusHoje(empresaDetalhe.horario_funcionamento).texto ? (
                  <p className="text-sm flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {getStatusHoje(empresaDetalhe.horario_funcionamento).texto}
                  </p>
                ) : null}
                {formatEndereco(empresaDetalhe) && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Endereço</p>
                      <p className="text-muted-foreground">
                        {formatEndereco(empresaDetalhe)}
                        {empresaDetalhe.endereco_complemento && ` - ${empresaDetalhe.endereco_complemento}`}
                      </p>
                      {empresaDetalhe.endereco_cep && (
                        <p className="text-xs text-muted-foreground mt-0.5">CEP: {empresaDetalhe.endereco_cep}</p>
                      )}
                    </div>
                  </div>
                )}
                {empresaDetalhe.whatsapp && (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/50">
                    <span className="text-sm">
                      ({empresaDetalhe.whatsapp.slice(0, 2)}) {empresaDetalhe.whatsapp.slice(2, 7)}-
                      {empresaDetalhe.whatsapp.slice(7)}
                    </span>
                    <Button
                      size="sm"
                      className="flex items-center gap-1.5"
                      onClick={() =>
                        window.open(
                          `https://wa.me/55${empresaDetalhe.whatsapp}?text=${encodeURIComponent("Olá! Vi seu perfil no app.")}`,
                          "_blank"
                        )
                      }
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  </div>
                )}
                {empresaDetalhe.instagram && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center gap-2"
                    onClick={() => window.open(`https://instagram.com/${empresaDetalhe.instagram}`, "_blank")}
                  >
                    <Instagram className="h-4 w-4" />
                    Instagram
                  </Button>
                )}
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    setSelectedEmpresaId(null);
                    navigate(`/cidade/${cidadeSlug}/servicos/${empresaDetalhe.categoria}/${empresaDetalhe.id}`);
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver página completa da empresa
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
