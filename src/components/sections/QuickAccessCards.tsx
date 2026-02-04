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
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleClick(card.id)}
            className={`flex-shrink-0 w-[140px] h-[100px] rounded-2xl ${card.bgPattern} ${card.gradient} p-3 flex flex-col justify-between text-white shadow-lg hover:shadow-xl transition-all active:scale-95 relative overflow-hidden`}
          >
            {/* Background decoration */}
            <div className="absolute -right-4 -bottom-4 opacity-20">
              <card.icon className="w-20 h-20" strokeWidth={1} />
            </div>
            
            {/* Icon */}
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <card.icon className="w-5 h-5 text-white" />
            </div>
            
            {/* Text */}
            <div className="text-left relative z-10">
              <h3 className="text-xs font-bold leading-tight">{card.title}</h3>
              <p className="text-[10px] opacity-80 mt-0.5">{card.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default QuickAccessCards;
