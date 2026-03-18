import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, TrendingUp, Users, CalendarDays, Activity, Clock3, LocateFixed } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import L from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { supabase } from "@/integrations/supabase/client";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";

const formatCount = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return value.toLocaleString("pt-BR");
};

const formatDayLabel = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dt = new Date(year, month - 1, day);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

type AccessAnalytics = {
  daily: Array<{ date: string; users: number }>;
  summary: { today: number; week: number; month: number };
  peak: { period: string; users: number };
};

type AccessGeoPoint = {
  latitude: number;
  longitude: number;
  users: number;
  events: number;
};

type AccessGeoResponse = {
  points: AccessGeoPoint[];
  totals: {
    users: number;
    events: number;
  };
};

const periodLabelMap: Record<string, string> = {
  manha: "Manha",
  tarde: "Tarde",
  noite: "Noite",
  madrugada: "Madrugada",
  "-": "-",
};

const GV_CENTER: [number, number] = [-18.8544, -41.9555];
const GV_DEFAULT_ZOOM = 15;
const DASHBOARD_CITY_SLUG = "gv";

const getTodayLocalIsoDate = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const AccessMapBounds = ({ points }: { points: AccessGeoPoint[] }) => {
  const map = useMap();

  useEffect(() => {
    if (!points.length) {
      map.setView(GV_CENTER, GV_DEFAULT_ZOOM);
      return;
    }

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 11);
      return;
    }

    const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 });
  }, [map, points]);

  return null;
};

const RegisterAccessMap = ({ onReady }: { onReady: (map: L.Map) => void }) => {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  return null;
};

const AdminDashboard = () => {
  const [selectedMapDate, setSelectedMapDate] = useState(getTodayLocalIsoDate());
  const [accessMap, setAccessMap] = useState<L.Map | null>(null);

  const {
    data: dashboardStats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard_stats");
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : null;
      return {
        cidades: Number(row?.total_cidades ?? 0),
        usuarios: Number(row?.total_usuarios ?? 0),
        acessos: Number(row?.acessos_30_dias ?? 0),
      };
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
  });

  const {
    data: accessAnalytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
  } = useQuery({
    queryKey: ["admin-access-analytics", 30],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_access_analytics", { p_days: 30 });
      if (error) throw error;

      const payload = (data || {}) as Partial<AccessAnalytics>;
      return {
        daily: Array.isArray(payload.daily) ? payload.daily : [],
        summary: payload.summary || { today: 0, week: 0, month: 0 },
        peak: payload.peak || { period: "-", users: 0 },
      } satisfies AccessAnalytics;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
  });

  const {
    data: onlineNow,
    isLoading: onlineLoading,
    isError: onlineError,
  } = useQuery({
    queryKey: ["admin-online-now", 3],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_online_now", { p_window_minutes: 3 });
      if (error) throw error;
      return Number(data ?? 0);
    },
    refetchInterval: 15000,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
  });

  const {
    data: accessGeo,
    isLoading: geoLoading,
    isError: geoError,
  } = useQuery({
    queryKey: ["admin-access-geo-daily", selectedMapDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_access_geo_daily", {
        p_day: selectedMapDate,
        p_cidade_slug: DASHBOARD_CITY_SLUG,
      });
      // Compatibilidade com bancos sem a migration do mapa aplicada.
      if (error?.code === "PGRST202") {
        return {
          points: [],
          totals: { users: 0, events: 0 },
        } satisfies AccessGeoResponse;
      }
      if (error) throw error;

      const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
      const points = rows
        .map((row) => ({
          latitude: Number(row.latitude ?? 0),
          longitude: Number(row.longitude ?? 0),
          users: Number(row.users ?? 0),
          events: Number(row.events ?? 0),
        }))
        .filter(
          (row) =>
            Number.isFinite(row.latitude) &&
            Number.isFinite(row.longitude) &&
            row.latitude >= -90 &&
            row.latitude <= 90 &&
            row.longitude >= -180 &&
            row.longitude <= 180 &&
            row.users > 0,
        )
        .sort((a, b) => b.users - a.users || b.events - a.events);

      const totals = points.reduce(
        (acc, item) => ({
          users: acc.users + item.users,
          events: acc.events + item.events,
        }),
        { users: 0, events: 0 },
      );

      return { points, totals } satisfies AccessGeoResponse;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
  });

  const chartData = useMemo(
    () =>
      (accessAnalytics?.daily || []).map((item) => ({
        date: item.date,
        label: formatDayLabel(item.date),
        users: Number(item.users || 0),
      })),
    [accessAnalytics?.daily],
  );
  const geoMaxUsers = useMemo(
    () => Math.max(...(accessGeo?.points.map((point) => point.users) || [1])),
    [accessGeo?.points],
  );

  const topStats = [
    {
      title: "Usuarios online agora",
      value: onlineLoading ? "..." : onlineError ? "-" : formatCount(onlineNow),
      icon: Activity,
      description: "Sessoes ativas na janela de 3 minutos",
    },
    {
      title: "Total de Cidades",
      value: statsLoading ? "..." : statsError ? "-" : formatCount(dashboardStats?.cidades),
      icon: MapPin,
      description: "Cidades cadastradas",
    },
    {
      title: "Usuarios",
      value: statsLoading ? "..." : statsError ? "-" : formatCount(dashboardStats?.usuarios),
      icon: Users,
      description: "Usuarios cadastrados",
    },
    {
      title: "Acessos (30 dias)",
      value: statsLoading ? "..." : statsError ? "-" : formatCount(dashboardStats?.acessos),
      icon: TrendingUp,
      description: "Usuarios unicos nos ultimos 30 dias",
    },
  ];

  const periodCards = [
    {
      title: "Hoje",
      value: analyticsLoading ? "..." : analyticsError ? "-" : formatCount(accessAnalytics?.summary.today),
      icon: CalendarDays,
      description: "Usuarios unicos hoje",
    },
    {
      title: "Semana",
      value: analyticsLoading ? "..." : analyticsError ? "-" : formatCount(accessAnalytics?.summary.week),
      icon: Activity,
      description: "Usuarios unicos na semana",
    },
    {
      title: "Mes",
      value: analyticsLoading ? "..." : analyticsError ? "-" : formatCount(accessAnalytics?.summary.month),
      icon: Clock3,
      description: "Usuarios unicos no mes",
    },
  ];

  const peakLabel = periodLabelMap[accessAnalytics?.peak.period || "-"] || "-";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Acessos diarios e picos de uso</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {topStats.map((stat) => (
          <div key={stat.title} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">{stat.title}</span>
              <stat.icon className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-3xl font-semibold text-gray-900">{stat.value || "0"}</div>
            <p className="mt-1 text-xs text-gray-400">{stat.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Acessos diarios (30 dias)</h2>
            <p className="text-xs text-gray-500">Usuarios unicos por dia</p>
          </div>
        </div>

        <ChartContainer
          className="h-[260px] w-full"
          config={{
            users: {
              label: "Usuarios",
              color: "hsl(222 89% 56%)",
            },
          }}
        >
          <LineChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={22}
              tickMargin={8}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="users"
              stroke="var(--color-users)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Mapa de origem dos acessos</h2>
            <p className="text-xs text-gray-500">Usuarios unicos por regiao em Governador Valadares no dia selecionado</p>
          </div>
          <div className="w-full max-w-[220px]">
            <label htmlFor="dashboard-map-date" className="mb-1 block text-xs font-medium text-gray-500">
              Dia
            </label>
            <Input
              id="dashboard-map-date"
              type="date"
              value={selectedMapDate}
              max={getTodayLocalIsoDate()}
              onChange={(event) => setSelectedMapDate(event.target.value)}
              className="h-9 bg-white"
            />
          </div>
        </div>

        <div className="mb-3 text-sm text-gray-600">
          {geoLoading || geoError
            ? "Carregando distribuicao geografia..."
            : `${formatCount(accessGeo?.totals.users)} usuarios unicos em ${formatCount(accessGeo?.totals.events)} eventos`}
        </div>

        <div className="h-[520px] overflow-hidden rounded-lg border border-gray-200">
          <div className="relative h-full w-full">
            <MapContainer center={GV_CENTER} zoom={GV_DEFAULT_ZOOM} className="h-full w-full" scrollWheelZoom>
              <RegisterAccessMap onReady={setAccessMap} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <AccessMapBounds points={accessGeo?.points || []} />

              {(accessGeo?.points || []).map((point) => {
                const radius = 5 + (point.users / geoMaxUsers) * 15;

                return (
                  <CircleMarker
                    key={`${point.latitude}-${point.longitude}`}
                    center={[point.latitude, point.longitude]}
                    radius={radius}
                    pathOptions={{
                      color: "#1d4ed8",
                      fillColor: "#3b82f6",
                      fillOpacity: 0.6,
                      weight: 1,
                    }}
                  >
                    <Tooltip direction="top">
                      <div className="text-xs">
                        <div>{formatCount(point.users)} usuarios</div>
                        <div>{formatCount(point.events)} acessos</div>
                        <div>
                          {point.latitude.toFixed(2)}, {point.longitude.toFixed(2)}
                        </div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            <button
              type="button"
              onClick={() => accessMap?.setView(GV_CENTER, GV_DEFAULT_ZOOM, { animate: true })}
              className="absolute left-[10px] top-[78px] z-[1000] h-[30px] w-[30px] rounded-sm border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
              aria-label="Voltar para Governador Valadares"
              title="Voltar para Governador Valadares"
            >
              <LocateFixed className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>

        {!geoLoading && !geoError && (accessGeo?.points.length || 0) === 0 && (
          <p className="mt-3 text-xs text-gray-500">
            Sem localizacao para este dia. Novos pontos aparecem apos os proximos acessos com permissao de geolocalizacao.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {periodCards.map((card) => (
          <div key={card.title} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">{card.title}</span>
              <card.icon className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-2xl font-semibold text-gray-900">{card.value || "0"}</div>
            <p className="mt-1 text-xs text-gray-400">{card.description}</p>
          </div>
        ))}

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Maior pico</span>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">{peakLabel}</div>
          <p className="mt-1 text-xs text-gray-400">
            {analyticsLoading || analyticsError ? "-" : `${formatCount(accessAnalytics?.peak.users)} usuarios`}
          </p>
        </div>
      </div>

      {(statsError || analyticsError || onlineError) && (
        <p className="text-sm text-red-600">
          Nao foi possivel carregar as metricas. Confirme se as migrations de dashboard e analytics foram aplicadas.
        </p>
      )}
    </div>
  );
};

export default AdminDashboard;
