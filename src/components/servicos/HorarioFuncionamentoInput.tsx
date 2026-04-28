import { Input } from "@/components/ui/input";

interface HorarioFuncionamentoInputProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

const normalizeHorario24h = (value: string) => {
  const trimmed = value.trim();
  const amPmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = amPmMatch[2];
    const period = amPmMatch[3].toUpperCase();

    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  return trimmed;
};

const maskHorario24h = (value: string) => {
  const normalized = normalizeHorario24h(value);
  const digits = normalized.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const clampHorario24h = (value: string) => {
  const masked = maskHorario24h(value);
  const [rawHours = "", rawMinutes = ""] = masked.split(":");

  if (rawHours.length < 2 || rawMinutes.length < 2) return masked;

  const hours = Math.min(Number(rawHours), 23);
  const minutes = Math.min(Number(rawMinutes), 59);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const HorarioFuncionamentoInput = ({
  value,
  onChange,
  ariaLabel,
}: HorarioFuncionamentoInputProps) => {
  return (
    <Input
      type="text"
      inputMode="numeric"
      pattern="[0-9]{2}:[0-9]{2}"
      maxLength={5}
      placeholder="00:00"
      value={maskHorario24h(value)}
      onChange={(e) => onChange(maskHorario24h(e.target.value))}
      onBlur={(e) => onChange(clampHorario24h(e.target.value))}
      aria-label={ariaLabel}
      className="w-20 h-8 text-sm text-center tabular-nums"
    />
  );
};

export default HorarioFuncionamentoInput;
