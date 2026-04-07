import { useState, useEffect, useRef } from "react";
import { X, Download, Share, PlusSquare } from "lucide-react";

const DISMISSED_KEY = "cg_pwa_dismissed";

export function PwaInstallBanner() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
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

    const iosDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (iosDevice) {
      setIsIos(true);
      setShow(true);
      return;
    }

    // Only on mobile for Android prompt
    if (!/Android/i.test(navigator.userAgent)) return;

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

  if (isIos) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4" style={{ backgroundColor: "#000000" }}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/icons/icone-central.png"
                alt="CG Digital"
                className="w-12 h-12 rounded-xl flex-shrink-0"
              />
              <p className="text-white text-sm font-semibold">
                Para instalar o <span style={{ color: "#FFC107" }}>CG Digital</span> no seu iPhone:
              </p>
            </div>
            <button onClick={handleDismiss} className="text-white/70 hover:text-white flex-shrink-0 mt-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 ml-[60px] space-y-2">
            <div className="flex items-center gap-2 text-white text-sm">
              <Share className="w-4 h-4 flex-shrink-0" style={{ color: "#FFC107" }} />
              <span>Toque em <strong>Compartilhar</strong></span>
            </div>
            <div className="flex items-center gap-2 text-white text-sm">
              <PlusSquare className="w-4 h-4 flex-shrink-0" style={{ color: "#FFC107" }} />
              <span>Depois em <strong>"Adicionar à Tela de Início"</strong></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4" style={{ backgroundColor: "#000000" }}>
      <div className="flex items-center gap-3 max-w-lg mx-auto">
        <img
          src="/icons/icone-central.png"
          alt="CG Digital"
          className="w-12 h-12 rounded-xl flex-shrink-0"
        />
        <p className="text-white text-sm flex-1">
          Instale o <span className="font-bold" style={{ color: "#FFC107" }}>CG Digital</span> na tela inicial para acesso rápido
        </p>
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold flex-shrink-0"
          style={{ backgroundColor: "#FFC107", color: "#000000" }}
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
