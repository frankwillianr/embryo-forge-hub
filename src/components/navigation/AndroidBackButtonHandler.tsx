import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";

const HOME_PATTERN = /^\/cidade\/[^/]+$/;

const AndroidBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navDepthRef = useRef(0);
  const pathnameRef = useRef(location.pathname);

  // Keep pathname ref fresh without re-registering the listener
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  // Track navigation depth: +1 on push, -1 on pop, 0 on replace
  useEffect(() => {
    const handlePopState = () => {
      navDepthRef.current = Math.max(0, navDepthRef.current - 1);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Increment depth on pathname change (push navigations)
  const prevPathnameRef = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname !== prevPathnameRef.current) {
      // Only increment on push (not on pop, which is handled above)
      // We check history action via a simple heuristic:
      // popstate already decremented, so this is a new push
      navDepthRef.current += 1;
      prevPathnameRef.current = location.pathname;
    }
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
        const isHome = HOME_PATTERN.test(currentPath);

        // If we're on the home page, exit the app
        if (isHome) {
          CapacitorApp.exitApp();
          return;
        }

        // If we have navigation depth, go back
        if (navDepthRef.current > 0) {
          navigate(-1);
          return;
        }

        // No depth left but not on home — navigate to home
        navigate("/cidade/governador-valadares", { replace: true });
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
