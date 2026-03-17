import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const HOME_PATTERN = /^\/cidade\/[^/]+$/;

/**
 * Derives the parent route from a given path.
 * /cidade/gv/jornal/123  → /cidade/gv/jornal
 * /cidade/gv/jornal       → /cidade/gv
 * /cidade/gv              → null (is home)
 */
const getParentRoute = (pathname: string): string | null => {
  const clean = pathname.replace(/\/$/, "");
  if (HOME_PATTERN.test(clean)) return null;

  const lastSlash = clean.lastIndexOf("/");
  if (lastSlash <= 0) return null;

  const parent = clean.substring(0, lastSlash);
  if (parent === "/cidade" || parent === "/") return null;

  return parent;
};

/**
 * Handles Android back button for SPA inside a WebView.
 *
 * The app loads from a remote URL (capacitor server.url), so the
 * Capacitor JS bridge is NOT available. Instead we push a fake
 * history entry and listen for popstate — that way the first back
 * press pops our dummy entry instead of closing the WebView.
 */
const AndroidBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    // Push a sentinel state so the first back press triggers popstate
    // instead of leaving the page / closing the WebView.
    const pushSentinel = () => {
      window.history.pushState({ sentinel: true }, "");
    };

    const handlePopState = (e: PopStateEvent) => {
      // If this popstate is from our sentinel being popped, handle it
      // Otherwise let React Router handle it normally
      const currentPath = pathnameRef.current;
      const parent = getParentRoute(currentPath);

      if (parent) {
        navigate(parent, { replace: true });
      }
      // If no parent (already on home), let the browser handle it
      // (which will close the app — correct behavior)
      // But re-push sentinel for future back presses
      if (parent) {
        // Small delay to let React Router settle, then re-push sentinel
        setTimeout(pushSentinel, 100);
      }
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
