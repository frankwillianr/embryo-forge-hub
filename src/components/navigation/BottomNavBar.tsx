import { useNavigate } from "react-router-dom";
import { Home, Newspaper, Film, Briefcase, BadgePercent, Menu } from "lucide-react";

type BottomNavTab = "home" | "jornal" | "cinema" | "servicos" | "ofertas" | "menu";

interface BottomNavBarProps {
  slug?: string;
  active?: BottomNavTab;
  onHomeClick?: () => void;
  onJornalClick?: () => void;
  onCinemaClick?: () => void;
  onServicosClick?: () => void;
  onOfertasClick?: () => void;
  onMenuClick?: () => void;
}

const baseItemClass = "flex flex-col items-center justify-center gap-1.5 py-2 transition-colors";
const activeClass = "text-primary";
const inactiveClass = "text-gray-400 hover:text-white";

const BottomNavBar = ({
  slug,
  active,
  onHomeClick,
  onJornalClick,
  onCinemaClick,
  onServicosClick,
  onOfertasClick,
  onMenuClick,
}: BottomNavBarProps) => {
  const navigate = useNavigate();

  const goHome = () => {
    if (onHomeClick) return onHomeClick();
    navigate(`/cidade/${slug}`);
  };

  const goJornal = () => {
    if (onJornalClick) return onJornalClick();
    navigate(`/cidade/${slug}/jornal`);
  };

  const goCinema = () => {
    if (onCinemaClick) return onCinemaClick();
    navigate(`/cidade/${slug}?tab=cinema`);
  };

  const goServicos = () => {
    if (onServicosClick) return onServicosClick();
    navigate(`/cidade/${slug}/servicos`);
  };

  const goOfertas = () => {
    if (onOfertasClick) return onOfertasClick();
    navigate(`/cidade/${slug}/ofertas`);
  };

  const goMenu = () => {
    if (onMenuClick) return onMenuClick();
    navigate(`/cidade/${slug}?tab=menu`);
  };

  return (
    <nav className="fixed bottom-[20px] left-[2px] right-[2px] z-50 w-auto bg-[#1a1a2e]/95 border border-white/8 rounded-2xl shadow-2xl backdrop-blur-sm">
      <div className="grid grid-cols-6 items-center w-full">
        <button onClick={goHome} className={`${baseItemClass} ${active === "home" ? activeClass : inactiveClass}`}>
          <Home className="h-5 w-5" />
          <span className="text-[8px] font-medium">Home</span>
        </button>
        <button
          onClick={goJornal}
          className={`${baseItemClass} ${active === "jornal" ? activeClass : inactiveClass}`}
        >
          <Newspaper className="h-5 w-5" />
          <span className="text-[8px] font-medium leading-[1.05] text-center">
            Jornal da
            <br />
            cidade
          </span>
        </button>
        <button
          onClick={goCinema}
          className={`${baseItemClass} ${active === "cinema" ? activeClass : inactiveClass}`}
        >
          <Film className="h-5 w-5" />
          <span className="text-[8px] font-medium">Cinema</span>
        </button>
        <button
          onClick={goServicos}
          className={`${baseItemClass} ${active === "servicos" ? activeClass : inactiveClass}`}
        >
          <Briefcase className="h-5 w-5" />
          <span className="text-[8px] font-medium leading-[1.05] text-center">
            Onde ir &
            <br />
            Serviços
          </span>
        </button>
        <button
          onClick={goOfertas}
          className={`${baseItemClass} ${active === "ofertas" ? activeClass : inactiveClass}`}
        >
          <BadgePercent className="h-5 w-5" />
          <span className="text-[8px] font-medium leading-[1.05] text-center">
            Mural de
            <br />
            ofertas
          </span>
        </button>
        <button
          onClick={goMenu}
          className={`${baseItemClass} ${active === "menu" ? activeClass : inactiveClass}`}
        >
          <Menu className="h-5 w-5" />
          <span className="text-[8px] font-medium">Menu</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNavBar;
