import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, TrendingUp, Users, CalendarDays, Activity, Clock3, Menu } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";

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

const periodLabelMap: Record<string, string> = {
  manha: "Manha",
  tarde: "Tarde",
  noite: "Noite",
  madrugada: "Madrugada",
  "-": "-",
};

const AdminDashboard = () => {
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

  const chartData = useMemo(
    () =>
      (accessAnalytics?.daily || []).map((item) => ({
        date: item.date,
        label: formatDayLabel(item.date),
        users: Number(item.users || 0),
      })),
    [accessAnalytics?.daily],
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
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="lg:hidden"
          onClick={() => window.dispatchEvent(new Event("admin:toggle-sidebar"))}
          aria-label="Abrir menu admin"
        >
          <Menu className="h-4 w-4" />
        </Button>
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
