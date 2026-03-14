import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ACCESS_SESSION_KEY = "gc_access_session_id_v1";
const ACCESS_THROTTLE_MS = 30 * 60 * 1000;
const ONLINE_HEARTBEAT_MS = 90 * 1000;

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

export const useTrackCidadeAccess = (cidadeSlug?: string) => {
  const { user } = useAuth();

  const sessionId = useMemo(() => getOrCreateAccessSessionId(), []);

  useEffect(() => {
    if (!cidadeSlug) return;

    const throttleKey = `gc_access_last_track:${cidadeSlug}:${sessionId}`;

    const trackAnalytics = async () => {
      const last = Number(localStorage.getItem(throttleKey) || "0");
      const now = Date.now();
      if (now - last < ACCESS_THROTTLE_MS) return;

      localStorage.setItem(throttleKey, String(now));

      await supabase.rpc("track_app_access", {
        p_cidade_slug: cidadeSlug,
        p_session_id: sessionId,
        p_user_id: user?.id ?? null,
      });
    };

    const heartbeatOnline = async () => {
      await supabase.rpc("upsert_online_session", {
        p_cidade_slug: cidadeSlug,
        p_session_id: sessionId,
        p_user_id: user?.id ?? null,
      });
    };

    void trackAnalytics();
    void heartbeatOnline();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void trackAnalytics();
        void heartbeatOnline();
      }
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void heartbeatOnline();
      }
    }, ONLINE_HEARTBEAT_MS);

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cidadeSlug, sessionId, user?.id]);
};
