import { useEffect, useMemo, useState } from "react";

const getTimeLeft = (target: Date) => {
  const diffMs = Math.max(0, target.getTime() - Date.now());
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return {
    days,
    hours,
    minutes,
    finished: diffMs === 0,
  };
};

export const useCountdown = (targetIso: string) => {
  const target = useMemo(() => new Date(targetIso), [targetIso]);
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(target));

  useEffect(() => {
    setTimeLeft(getTimeLeft(target));

    const interval = window.setInterval(() => {
      setTimeLeft(getTimeLeft(target));
    }, 60000);

    return () => window.clearInterval(interval);
  }, [target]);

  return timeLeft;
};
