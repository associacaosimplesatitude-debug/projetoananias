import { useState, useEffect, useRef } from "react";
import { X, Download } from "lucide-react";

const DISMISSED_KEY = "cg_pwa_dismissed";

export function PwaInstallBanner() {
  const [show, setShow] = useState(false);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    // Only on mobile
    if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) return;
    // Not if already standalone
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Not if dismissed
    if (localStorage.getItem(DISMISSED_KEY) === "true") return;
    // Not inside iframe (Lovable preview)
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4" style={{ backgroundColor: "#1B3A5C" }}>
      <div className="flex items-center gap-3 max-w-lg mx-auto">
        <img
          src="/icons/cg-digital-192.png"
          alt="CG Digital"
          className="w-12 h-12 rounded-xl flex-shrink-0"
        />
        <p className="text-white text-sm flex-1">
          Instale o <span className="font-bold" style={{ color: "#FFC107" }}>CG Digital</span> na tela inicial para acesso rápido
        </p>
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold flex-shrink-0"
          style={{ backgroundColor: "#FFC107", color: "#1B3A5C" }}
        >
          <Download className="w-4 h-4" />
          Instalar
        </button>
        <button onClick={handleDismiss} className="text-white/70 hover:text-white flex-shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
