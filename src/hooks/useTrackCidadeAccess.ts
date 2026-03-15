import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ACCESS_SESSION_KEY = "gc_access_session_id_v1";
const ACCESS_GEO_CACHE_KEY = "gc_access_geo_cache_v1";
const ACCESS_OFFLINE_RPC_MISSING_KEY = "gc_access_offline_rpc_missing_v1";
const ACCESS_THROTTLE_MS = 30 * 60 * 1000;
const ONLINE_HEARTBEAT_MS = 90 * 1000;
const ACCESS_GEO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let offlineRpcMissingInRuntime = false;

const getOrCreateAccessSessionId = () => {
  const existing = localStorage.getItem(ACCESS_SESSION_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  localStorage.setItem(ACCESS_SESSION_KEY, generated);
  return generated;
};

type AccessGeo = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

const FALLBACK_CITY_GEO: Record<string, { latitude: number; longitude: number }> = {
  gv: { latitude: -18.8544, longitude: -41.9555 },
};

const readGeoCache = (): { hasCache: boolean; geo: AccessGeo | null } => {
  try {
    const raw = localStorage.getItem(ACCESS_GEO_CACHE_KEY);
    if (!raw) return { hasCache: false, geo: null };
    const parsed = JSON.parse(raw) as { ts?: number; geo?: AccessGeo | null; failed?: boolean };
    const ttl = parsed?.failed ? 5 * 60 * 1000 : ACCESS_GEO_CACHE_TTL_MS;
    if (!parsed?.ts || Date.now() - parsed.ts > ttl) return { hasCache: false, geo: null };
    return { hasCache: true, geo: parsed.geo ?? null };
  } catch {
    return { hasCache: false, geo: null };
  }
};

const writeGeoCache = (geo: AccessGeo | null, failed = false) => {
  try {
    localStorage.setItem(
      ACCESS_GEO_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        geo,
        failed,
      }),
    );
  } catch {
    // noop
  }
};

const getAccessGeo = async (): Promise<AccessGeo | null> => {
  const cached = readGeoCache();
  if (cached.hasCache) return cached.geo;

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    writeGeoCache(null, true);
    return null;
  }

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 4000,
        maximumAge: 5 * 60 * 1000,
      },
    );
  });

  if (!position) {
    writeGeoCache(null, true);
    return null;
  }

  const geo: AccessGeo = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
  };
  writeGeoCache(geo, false);
  return geo;
};

export const useTrackCidadeAccess = (cidadeSlug?: string) => {
  const { user } = useAuth();

  const sessionId = useMemo(() => getOrCreateAccessSessionId(), []);

  useEffect(() => {
    if (!cidadeSlug) return;

    const throttleKey = `gc_access_last_track:${cidadeSlug}:${sessionId}`;

    const trackAnalytics = async () => {
      const last = Number(localStorage.getItem(throttleKey) || "0");
      const now = Date.now();
      if (now - last < ACCESS_THROTTLE_MS) {
        console.log("[useTrackCidadeAccess] throttled", {
          cidadeSlug,
          sessionId,
          lastTrackedAt: new Date(last).toISOString(),
          nextAllowedAt: new Date(last + ACCESS_THROTTLE_MS).toISOString(),
          waitMs: last + ACCESS_THROTTLE_MS - now,
        });
        return;
      }

      localStorage.setItem(throttleKey, String(now));

      const geo = await getAccessGeo();
      const fallbackGeo = cidadeSlug ? FALLBACK_CITY_GEO[cidadeSlug] : undefined;
      const effectiveGeo = geo ?? (fallbackGeo ? { ...fallbackGeo, accuracy: null } : null);
      console.log("[useTrackCidadeAccess] track start", {
        cidadeSlug,
        sessionId,
        userId: user?.id ?? null,
        hasGeo: !!geo,
        usingFallbackGeo: !geo && !!fallbackGeo,
        latitude: effectiveGeo?.latitude ?? null,
        longitude: effectiveGeo?.longitude ?? null,
        accuracy: effectiveGeo?.accuracy ?? null,
      });

      const trackResult = await supabase.rpc("track_app_access", {
        p_cidade_slug: cidadeSlug,
        p_session_id: sessionId,
        p_user_id: user?.id ?? null,
        p_latitude: effectiveGeo?.latitude ?? null,
        p_longitude: effectiveGeo?.longitude ?? null,
        p_accuracy_meters: effectiveGeo?.accuracy ?? null,
      });
      console.log("[useTrackCidadeAccess] track result", {
        error: trackResult.error ? { code: trackResult.error.code, message: trackResult.error.message } : null,
      });
      if (!trackResult.error) {
        console.log("registo salvo no supabase");
      }

      // Compatibilidade com bancos ainda sem migration de geolocalizacao.
      if (trackResult.error) {
        const fallback = await supabase.rpc("track_app_access", {
          p_cidade_slug: cidadeSlug,
          p_session_id: sessionId,
          p_user_id: user?.id ?? null,
        });
        console.log("[useTrackCidadeAccess] track fallback result", {
          error: fallback.error ? { code: fallback.error.code, message: fallback.error.message } : null,
        });
        if (!fallback.error) {
          console.log("registo salvo no supabase");
        }
      }
    };

    const heartbeatOnline = async () => {
      await supabase.rpc("upsert_online_session", {
        p_cidade_slug: cidadeSlug,
        p_session_id: sessionId,
        p_user_id: user?.id ?? null,
      });
    };

    const markOffline = async () => {
      if (offlineRpcMissingInRuntime || localStorage.getItem(ACCESS_OFFLINE_RPC_MISSING_KEY) === "1") {
        return;
      }
      const { error } = await supabase.rpc("mark_online_session_offline", {
        p_session_id: sessionId,
      });
      // Compatibilidade com bancos sem a funcao mark_online_session_offline.
      if (error?.code === "PGRST202") {
        offlineRpcMissingInRuntime = true;
        localStorage.setItem(ACCESS_OFFLINE_RPC_MISSING_KEY, "1");
        console.warn("[useTrackCidadeAccess] mark_online_session_offline ausente no banco (PGRST202)");
        return;
      }
      if (error) {
        console.warn("[useTrackCidadeAccess] mark_online_session_offline failed", error);
      }
    };

    void trackAnalytics();
    void heartbeatOnline();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void trackAnalytics();
        void heartbeatOnline();
      } else if (document.visibilityState === "hidden") {
        void markOffline();
      }
    };

    const onPageHide = () => {
      void markOffline();
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void heartbeatOnline();
      }
    }, ONLINE_HEARTBEAT_MS);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(interval);
      void markOffline();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [cidadeSlug, sessionId, user?.id]);
};
