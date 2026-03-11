import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const CURRENT_BUILD_ID = __APP_BUILD_ID__;
const CHECK_INTERVAL_MS = 60_000;

type VersionPayload = {
  buildId?: string;
};

const UpdateAvailableBanner = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkForUpdate = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as VersionPayload;
        if (!cancelled && payload.buildId && payload.buildId !== CURRENT_BUILD_ID) {
          setHasUpdate(true);
        }
      } catch {
        // sem ruido para o usuario; tenta novamente no proximo ciclo
      }
    };

    checkForUpdate();
    const interval = window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const refreshNow = async () => {
    try {
      setIsRefreshing(true);
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.update()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      // fallback normal abaixo
    } finally {
      window.location.reload();
    }
  };

  if (!hasUpdate) return null;

  return (
    <div className="fixed top-4 left-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-xl border border-primary/30 bg-card/95 backdrop-blur px-4 py-3 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          Nova atualizacao disponivel. Atualize para continuar usando.
        </p>
        <Button size="sm" onClick={refreshNow} disabled={isRefreshing}>
          {isRefreshing ? "Atualizando..." : "Atualizar agora"}
        </Button>
      </div>
    </div>
  );
};

export default UpdateAvailableBanner;
