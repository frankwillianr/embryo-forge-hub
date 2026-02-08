import { MapPin, TrendingUp, Users } from "lucide-react";

const stats = [
  {
    title: "Total de Cidades",
    value: "0",
    icon: MapPin,
    description: "Cidades cadastradas",
  },
  {
    title: "Usuários",
    value: "0",
    icon: Users,
    description: "Usuários ativos",
  },
  {
    title: "Acessos",
    value: "0",
    icon: TrendingUp,
    description: "Nos últimos 30 dias",
  },
];

const AdminDashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm">Visão geral do sistema</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.title} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">
                {stat.title}
              </span>
              <stat.icon className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-3xl font-semibold text-gray-900">{stat.value}</div>
            <p className="text-xs text-gray-400 mt-1">
              {stat.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
