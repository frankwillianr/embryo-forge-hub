import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";

const HOME_PATTERN = /^\/cidade\/[^/]+$/;

/**
 * Derives the parent route from a given path.
 * /cidade/gv/jornal/123  → /cidade/gv/jornal
 * /cidade/gv/jornal       → /cidade/gv
 * /cidade/gv              → null (is home, should exit)
 */
const getParentRoute = (pathname: string): string | null => {
  // Remove trailing slash
  const clean = pathname.replace(/\/$/, "");

  // Already on city home
  if (HOME_PATTERN.test(clean)) return null;

  // Go up one segment
  const lastSlash = clean.lastIndexOf("/");
  if (lastSlash <= 0) return null;

  const parent = clean.substring(0, lastSlash);

  // If parent is just "/cidade", go to default city home
  if (parent === "/cidade" || parent === "/") {
    return null;
  }

  return parent;
};

const AndroidBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);

  // Keep pathname ref always fresh
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  // Register back button handler once
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    let cleanup: (() => void) | undefined;

    const setupBackHandler = async () => {
      const listener = await CapacitorApp.addListener("backButton", () => {
        const currentPath = pathnameRef.current;

        // Derive the parent route from the current path
        const parent = getParentRoute(currentPath);

        if (parent) {
          // Navigate to parent route (replaces to avoid history buildup)
          navigate(parent, { replace: true });
        } else {
          // We're on the city home page — exit the app
          CapacitorApp.exitApp();
        }
      });

      cleanup = () => {
        listener.remove();
      };
    };

    setupBackHandler();

    return () => {
      cleanup?.();
    };
  }, [navigate]);

  return null;
};

export default AndroidBackButtonHandler;
