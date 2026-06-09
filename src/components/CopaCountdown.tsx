import { useCountdown } from "@/hooks/useCountdown";

interface CopaCountdownProps {
  compact?: boolean;
}

const items = [
  { key: "days", label: "dias" },
  { key: "hours", label: "hrs" },
  { key: "minutes", label: "min" },
] as const;

const CopaCountdown = ({ compact = false }: CopaCountdownProps) => {
  const countdown = useCountdown("2026-06-09T15:00:00-03:00");

  if (countdown.finished) {
    return (
      <div className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-extrabold text-yellow-200">
        Sorteio em andamento
      </div>
    );
  }

  return (
    <div className={compact ? "flex items-center gap-1.5" : "flex items-center gap-2"}>
      {items.map((item) => (
        <div
          key={item.key}
          className={[
            "min-w-0 flex-1 rounded-xl border border-white/15 bg-black/24 text-center shadow-inner",
            compact ? "px-1.5 py-1.5" : "px-2 py-2",
          ].join(" ")}
        >
          <div className={compact ? "text-base font-black leading-none text-yellow-200" : "text-2xl font-black leading-none text-yellow-200"}>
            {String(countdown[item.key]).padStart(2, "0")}
          </div>
          <div className={compact ? "mt-1 text-[9px] font-bold uppercase text-white/72" : "mt-1 text-[10px] font-bold uppercase text-white/72"}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CopaCountdown;
