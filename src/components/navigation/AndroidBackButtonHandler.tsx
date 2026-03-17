import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const HOME_PATTERN = /^\/cidade\/[^/]+$/;

const getParentRoute = (pathname: string): string | null => {
  const clean = pathname.replace(/\/$/, "");
  if (HOME_PATTERN.test(clean)) return null;
  const lastSlash = clean.lastIndexOf("/");
  if (lastSlash <= 0) return null;
  const parent = clean.substring(0, lastSlash);
  if (parent === "/cidade" || parent === "/") return null;
  return parent;
};

let isCapacitorNative = false;
let capacitorPlatform = "unknown";

try {
  // Dynamic check — works whether Capacitor bridge exists or not
  const cap = (window as any).Capacitor;
  if (cap) {
    isCapacitorNative = !!cap.isNativePlatform?.();
    capacitorPlatform = cap.getPlatform?.() || "unknown";
  }
} catch {
  // not available
}

const logBackButton = (data: {
  pathname: string;
  parent_route: string | null;
  action_taken: string;
  location_key: string;
  location_search: string;
  location_hash: string;
  extra?: Record<string, any>;
}) => {
  supabase
    .from("debug_back_button_log")
    .insert({
      pathname: data.pathname,
      parent_route: data.parent_route,
      action_taken: data.action_taken,
      history_length: window.history.length,
      is_native_platform: isCapacitorNative,
      capacitor_platform: capacitorPlatform,
      user_agent: navigator.userAgent,
      referrer: document.referrer,
      location_key: data.location_key,
      location_search: data.location_search,
      location_hash: data.location_hash,
      extra: {
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        inner_width: window.innerWidth,
        inner_height: window.innerHeight,
        standalone: (window.navigator as any).standalone ?? null,
        display_mode: window.matchMedia("(display-mode: standalone)").matches
          ? "standalone"
          : "browser",
        capacitor_global_exists: !!(window as any).Capacitor,
        capacitor_bridge_exists: !!(window as any).Capacitor?.bridge,
        ...(data.extra || {}),
      },
    })
    .then(({ error }) => {
      if (error) console.error("[BackButtonLog] insert error:", error);
    });
};

const AndroidBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  const locationRef = useRef(location);

  useEffect(() => {
    pathnameRef.current = location.pathname;
    locationRef.current = location;
  }, [location]);

  // === Strategy 1: Capacitor backButton listener ===
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        const { App: CapacitorApp } = await import("@capacitor/app");

        const isNative = Capacitor.isNativePlatform();
        const platform = Capacitor.getPlatform();

        // Log que o setup rodou
        logBackButton({
          pathname: pathnameRef.current,
          parent_route: null,
          action_taken: "CAPACITOR_SETUP",
          location_key: locationRef.current.key,
          location_search: locationRef.current.search,
          location_hash: locationRef.current.hash,
          extra: {
            is_native: isNative,
            platform,
            capacitor_available: true,
          },
        });

        if (!isNative || platform !== "android") return;

        const listener = await CapacitorApp.addListener("backButton", () => {
          const currentPath = pathnameRef.current;
          const parent = getParentRoute(currentPath);
          const loc = locationRef.current;

          let action = "";

          if (parent) {
            action = `NAVIGATE_TO_PARENT:${parent}`;
            navigate(parent, { replace: true });
          } else {
            action = "EXIT_APP";
            CapacitorApp.exitApp();
          }

          logBackButton({
            pathname: currentPath,
            parent_route: parent,
            action_taken: action,
            location_key: loc.key,
            location_search: loc.search,
            location_hash: loc.hash,
            extra: { strategy: "capacitor_listener" },
          });
        });

        cleanup = () => listener.remove();
      } catch (err) {
        // Capacitor not available — log it
        logBackButton({
          pathname: pathnameRef.current,
          parent_route: null,
          action_taken: "CAPACITOR_IMPORT_FAILED",
          location_key: locationRef.current.key,
          location_search: locationRef.current.search,
          location_hash: locationRef.current.hash,
          extra: { error: String(err) },
        });
      }
    };

    setup();
    return () => cleanup?.();
  }, [navigate]);

  // === Strategy 2: popstate fallback (for remote URL / no Capacitor bridge) ===
  useEffect(() => {
    // Push a sentinel so first back press triggers popstate instead of closing
    const pushSentinel = () => {
      window.history.pushState({ __backSentinel: true }, "");
    };

    const handlePopState = (e: PopStateEvent) => {
      const wasSentinel = e.state?.__backSentinel === true;
      const currentPath = pathnameRef.current;
      const parent = getParentRoute(currentPath);
      const loc = locationRef.current;

      // Only act if our sentinel was popped
      if (!wasSentinel) return;

      let action = "";

      if (parent) {
        action = `POPSTATE_NAVIGATE:${parent}`;
        navigate(parent, { replace: true });
        // Re-push sentinel for next back press
        setTimeout(pushSentinel, 200);
      } else {
        action = "POPSTATE_ON_HOME";
        // On home and back pressed — let the browser/webview handle it (close)
        window.history.back();
      }

      logBackButton({
        pathname: currentPath,
        parent_route: parent,
        action_taken: action,
        location_key: loc.key,
        location_search: loc.search,
        location_hash: loc.hash,
        extra: {
          strategy: "popstate_fallback",
          was_sentinel: wasSentinel,
          pop_state: JSON.stringify(e.state),
        },
      });
    };

    pushSentinel();
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate]);

  return null;
};

export default AndroidBackButtonHandler;
