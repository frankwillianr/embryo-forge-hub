import { useNavigate } from "react-router-dom";
import { Home, Newspaper, Film, Briefcase, BadgePercent } from "lucide-react";

type BottomNavTab = "home" | "jornal" | "cinema" | "servicos" | "ofertas";

interface BottomNavBarProps {
  slug?: string;
  active?: BottomNavTab;
  onHomeClick?: () => void;
  onJornalClick?: () => void;
  onCinemaClick?: () => void;
  onServicosClick?: () => void;
  onOfertasClick?: () => void;
}

const baseItemClass = "mx-1 my-1 flex flex-col items-center justify-center gap-1.5 rounded-xl py-2 transition-all";
const activeClass = "bg-white/10 text-white";
const inactiveClass = "text-gray-400 hover:bg-white/5 hover:text-white";

const forceScrollTop = () => {
  window.scrollTo({ top: 0, behavior: "auto" });

  const candidates = Array.from(document.querySelectorAll<HTMLElement>("*"));
  candidates.forEach((el) => {
    const canScroll = el.scrollHeight > el.clientHeight + 10 || el.scrollWidth > el.clientWidth + 10;
    if (canScroll) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
  });
};

const BottomNavBar = ({
  slug,
  active,
  onHomeClick,
  onJornalClick,
  onCinemaClick,
  onServicosClick,
  onOfertasClick,
}: BottomNavBarProps) => {
  const navigate = useNavigate();

  const goHome = () => {
    if (onHomeClick) return onHomeClick();
    navigate(`/cidade/${slug}`);
  };

  const goJornal = () => {
    if (onJornalClick) return onJornalClick();
    forceScrollTop();
    navigate(`/cidade/${slug}/jornal`, { state: { scrollToTop: true } });
    requestAnimationFrame(forceScrollTop);
    setTimeout(forceScrollTop, 120);
  };

  const goCinema = () => {
    if (onCinemaClick) return onCinemaClick();
    forceScrollTop();
    navigate(`/cidade/${slug}?tab=cinema`);
    requestAnimationFrame(forceScrollTop);
    setTimeout(forceScrollTop, 120);
  };

  const goServicos = () => {
    if (onServicosClick) return onServicosClick();
    navigate(`/cidade/${slug}/servicos`);
  };

  const goOfertas = () => {
    if (onOfertasClick) return onOfertasClick();
    navigate(`/cidade/${slug}/ofertas`);
  };

  return (
    <nav className="fixed bottom-[20px] left-[2px] right-[2px] z-50 w-auto bg-[#1a1a2e]/95 border border-white/8 rounded-2xl shadow-2xl backdrop-blur-sm">
      <div className="grid grid-cols-5 items-center w-full">
        <button
          onClick={goJornal}
          className={`${baseItemClass} ${active === "jornal" ? activeClass : inactiveClass}`}
        >
          <Newspaper className="h-5 w-5 text-sky-400" />
          <span className="text-[9px] font-medium leading-[1.05] text-center">
            Jornal da
            <br />
            cidade
          </span>
        </button>
        <button
          onClick={goCinema}
          className={`${baseItemClass} ${active === "cinema" ? activeClass : inactiveClass}`}
        >
          <Film className="h-5 w-5 text-amber-400" />
          <span className="text-[9px] font-medium leading-[1.05] text-center">
            Filmes em
            <br />
            cartaz
          </span>
        </button>
        <button onClick={goHome} className={`${baseItemClass} ${active === "home" ? activeClass : inactiveClass}`}>
          <Home className="h-5 w-5 text-emerald-400" />
          <span className="text-[9px] font-medium leading-[1.05] text-center">
            Pagina
            <br />
            inicial
          </span>
        </button>
        <button
          onClick={goServicos}
          className={`${baseItemClass} ${active === "servicos" ? activeClass : inactiveClass}`}
        >
          <Briefcase className="h-5 w-5 text-violet-400" />
          <span className="text-[9px] font-medium leading-[1.05] text-center">
            Onde ir &
            <br />
            Serviços
          </span>
        </button>
        <button
          onClick={goOfertas}
          className={`${baseItemClass} ${active === "ofertas" ? activeClass : inactiveClass}`}
        >
          <BadgePercent className="h-5 w-5 text-red-400" />
          <span className="text-[9px] font-medium leading-[1.05] text-center">
            Mural de
            <br />
            ofertas
          </span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNavBar;
