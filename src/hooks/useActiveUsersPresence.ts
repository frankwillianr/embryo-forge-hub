import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PRESENCE_SESSION_KEY = "gc_presence_session_id_v1";

const getOrCreateSessionId = () => {
  const existing = localStorage.getItem(PRESENCE_SESSION_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  localStorage.setItem(PRESENCE_SESSION_KEY, generated);
  return generated;
};

export const useActiveUsersPresence = (cidadeSlug?: string) => {
  const { user } = useAuth();
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);

  const presenceKey = useMemo(() => {
    const sessionId = getOrCreateSessionId();
    return user?.id ? `u:${user.id}` : `g:${sessionId}`;
  }, [user?.id]);

  useEffect(() => {
    if (!cidadeSlug) {
      setOnlineCount(0);
      setIsConnected(false);
      return;
    }

    const channel = supabase.channel(`cidade-presence:${cidadeSlug}`, {
      config: { presence: { key: presenceKey } },
    });

    const syncPresenceCount = () => {
      const state = channel.presenceState();
      setOnlineCount(Object.keys(state || {}).length);
    };

    channel.on("presence", { event: "sync" }, syncPresenceCount);
    channel.on("presence", { event: "join" }, syncPresenceCount);
    channel.on("presence", { event: "leave" }, syncPresenceCount);

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setIsConnected(true);
        await channel.track({ at: new Date().toISOString(), cidade: cidadeSlug });
      }
      if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setIsConnected(false);
      }
    });

    return () => {
      setIsConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [cidadeSlug, presenceKey]);

  return {
    onlineCount,
    isConnected,
  };
};

