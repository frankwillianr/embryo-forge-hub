import { Briefcase, Dog, Bus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickAccessCardsProps {
  cidadeSlug?: string;
}

const cards = [
  {
    id: "vagas",
    title: "Vagas de Emprego",
    subtitle: "Encontre oportunidades",
    icon: Briefcase,
    gradient: "from-orange-500 to-amber-400",
    bgPattern: "bg-gradient-to-br",
  },
  {
    id: "pets",
    title: "Pets Perdidos",
    subtitle: "Ajude a encontrar",
    icon: Dog,
    gradient: "from-pink-500 to-rose-400",
    bgPattern: "bg-gradient-to-br",
  },
  {
    id: "onibus",
    title: "Horário de Ônibus",
    subtitle: "Confira os horários",
    icon: Bus,
    gradient: "from-blue-500 to-cyan-400",
    bgPattern: "bg-gradient-to-br",
  },
];

const QuickAccessCards = ({ cidadeSlug }: QuickAccessCardsProps) => {
  const navigate = useNavigate();

  const handleClick = (id: string) => {
    // Future navigation - for now just placeholder
    console.log(`Clicked on ${id}`);
    // navigate(`/cidade/${cidadeSlug}/${id}`);
  };

  return (
    <section className="px-4 py-4">
      <div className="grid grid-cols-3 gap-2">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleClick(card.id)}
            className={`aspect-square rounded-2xl ${card.bgPattern} ${card.gradient} p-2.5 flex flex-col justify-between text-white shadow-lg hover:shadow-xl transition-all active:scale-95 relative overflow-hidden`}
          >
            {/* Background decoration */}
            <div className="absolute -right-3 -bottom-3 opacity-20">
              <card.icon className="w-14 h-14" strokeWidth={1} />
            </div>
            
            {/* Icon */}
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <card.icon className="w-4 h-4 text-white" />
            </div>
            
            {/* Text */}
            <div className="text-left relative z-10">
              <h3 className="text-[10px] font-bold leading-tight">{card.title}</h3>
              <p className="text-[8px] opacity-80 mt-0.5 line-clamp-1">{card.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default QuickAccessCards;
