import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";

const AndroidBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    let cleanup: (() => void) | undefined;

    const setupBackHandler = async () => {
      const listener = await CapacitorApp.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) {
          navigate(-1);
          return;
        }

        const isCidadeHome = /^\/cidade\/[^/]+$/.test(location.pathname);
        if (!isCidadeHome) {
          navigate("/cidade/governador-valadares", { replace: true });
          return;
        }

        CapacitorApp.exitApp();
      });

      cleanup = () => {
        listener.remove();
      };
    };

    setupBackHandler();

    return () => {
      cleanup?.();
    };
  }, [navigate, location.pathname]);

  return null;
};

export default AndroidBackButtonHandler;
