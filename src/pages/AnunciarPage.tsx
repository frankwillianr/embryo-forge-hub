import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Car, ShoppingBag, Briefcase, Building2, PawPrint, Megaphone } from "lucide-react";

const anunciarOptions = [
  {
    id: "veiculos",
    title: "Veículos",
    description: "Anuncie carros, motos e outros veículos",
    icon: Car,
    path: "veiculos/novo",
    color: "bg-blue-500",
  },
  {
    id: "desapega",
    title: "Desapega",
    description: "Venda itens usados ou seminovos",
    icon: ShoppingBag,
    path: "desapega/novo",
    color: "bg-green-500",
  },
  {
    id: "vagas",
    title: "Vagas de Emprego",
    description: "Publique oportunidades de trabalho",
    icon: Briefcase,
    path: "vagas/nova",
    color: "bg-purple-500",
  },
  {
    id: "servicos",
    title: "Serviços / Empresas",
    description: "Cadastre sua empresa ou serviço",
    icon: Building2,
    path: "servicos",
    color: "bg-orange-500",
  },
  {
    id: "pets",
    title: "Pets Perdidos",
    description: "Registre animais perdidos ou encontrados",
    icon: PawPrint,
    path: "pets/novo",
    color: "bg-pink-500",
  },
  {
    id: "banner",
    title: "Anunciar Banner",
    description: "Destaque seu negócio com um banner",
    icon: Megaphone,
    path: "banner/novo",
    color: "bg-primary",
  },
];

const AnunciarPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const handleOptionClick = (path: string) => {
    navigate(`/cidade/${slug}/${path}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pt-safe">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(`/cidade/${slug}`)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Anunciar</h1>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative h-32 bg-gradient-to-br from-primary to-[#E80560] flex items-center justify-center">
        <div className="text-center text-white">
          <Megaphone className="h-10 w-10 mx-auto mb-2" />
          <h2 className="text-xl font-bold">O que você quer anunciar?</h2>
        </div>
      </div>

      {/* Options Grid */}
      <div className="p-4 space-y-3">
        {anunciarOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option.path)}
              className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className={`w-12 h-12 ${option.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-foreground">{option.title}</h3>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
              <ArrowLeft className="h-5 w-5 text-muted-foreground rotate-180" />
            </button>
          );
        })}
      </div>

      {/* Info Footer */}
      <div className="p-4 pt-0">
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Seus anúncios ficam visíveis para toda a cidade de{" "}
            <span className="font-medium text-foreground">{slug?.toUpperCase()}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnunciarPage;
