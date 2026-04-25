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

const baseItemClass = "mx-1 my-1 flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-all";
const activeClass = "bg-white/25 text-white border border-white/30 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]";
const inactiveClass = "text-white hover:bg-white/5";

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
  const iconStateClass = (tab: BottomNavTab) =>
    active === tab
      ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.45)] brightness-125 scale-110"
      : "drop-shadow-[0_0_6px_rgba(255,255,255,0.25)] brightness-110";

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 w-auto bg-[#1a1a2e]/95 rounded-t-2xl shadow-2xl backdrop-blur-sm">
      <div className="grid grid-cols-5 items-center w-full">
        <button
          onClick={goJornal}
          className={`${baseItemClass} ${active === "jornal" ? activeClass : inactiveClass}`}
        >
          <Newspaper className={`h-5 w-5 text-sky-400 transition-all ${iconStateClass("jornal")}`} />
          <span className="text-[11px] font-normal leading-[1.5] text-center">
            Jornal da
            <br />
            cidade
          </span>
        </button>
        <button
          onClick={goCinema}
          className={`${baseItemClass} ${active === "cinema" ? activeClass : inactiveClass}`}
        >
          <Film className={`h-5 w-5 text-amber-400 transition-all ${iconStateClass("cinema")}`} />
          <span className="text-[11px] font-normal leading-[1.5] text-center">
            Filmes em
            <br />
            cartaz
          </span>
        </button>
        <button onClick={goHome} className={`${baseItemClass} ${active === "home" ? activeClass : inactiveClass}`}>
          <Home className={`h-5 w-5 text-emerald-400 transition-all ${iconStateClass("home")}`} />
          <span className="text-[11px] font-normal leading-[1.5] text-center">
            Pagina
            <br />
            inicial
          </span>
        </button>
        <button
          onClick={goServicos}
          className={`${baseItemClass} ${active === "servicos" ? activeClass : inactiveClass}`}
        >
          <Briefcase className={`h-5 w-5 text-violet-400 transition-all ${iconStateClass("servicos")}`} />
          <span className="text-[11px] font-normal leading-[1.5] text-center">
            Onde ir &
            <br />
            Serviços
          </span>
        </button>
        <button
          onClick={goOfertas}
          className={`${baseItemClass} ${active === "ofertas" ? activeClass : inactiveClass}`}
        >
          <BadgePercent className={`h-5 w-5 text-[#ff2d55] drop-shadow-[0_0_10px_rgba(255,45,85,0.85)] transition-all ${iconStateClass("ofertas")}`} />
          <span className="text-[11px] font-normal leading-[1.5] text-center">
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
