import { useState, useEffect, useRef } from "react";
import { X, Download, Share, PlusSquare } from "lucide-react";

const DISMISSED_KEY = "leitor_pwa_dismissed";

export default function LeitorInstallBanner() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(DISMISSED_KEY) === "true") return;
    try { if (window.self !== window.top) return; } catch { return; }

    const iosDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (iosDevice) {
      setIsIos(true);
      setShow(true);
      return;
    }

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
      <div className="mx-4 mt-3 rounded-xl p-4" style={{ backgroundColor: "#111", border: "1px solid #333" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/icons/leitor-cg-192.png" alt="Leitor CG" className="w-10 h-10 rounded-xl flex-shrink-0" />
            <p className="text-white text-sm font-semibold">
              Instale o <span style={{ color: "#FFC107" }}>Leitor CG</span> na tela inicial
            </p>
          </div>
          <button onClick={handleDismiss} className="text-white/50 hover:text-white flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-3 ml-[52px] space-y-2">
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
    );
  }

  return (
    <div className="mx-4 mt-3 rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: "#111", border: "1px solid #333" }}>
      <img src="/icons/leitor-cg-192.png" alt="Leitor CG" className="w-10 h-10 rounded-xl flex-shrink-0" />
      <p className="text-white text-sm flex-1">
        Instale o <span className="font-bold" style={{ color: "#FFC107" }}>Leitor CG</span> na tela inicial
      </p>
      <button
        onClick={handleInstall}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold flex-shrink-0"
        style={{ backgroundColor: "#FFC107", color: "#000" }}
      >
        <Download className="w-4 h-4" />
        Instalar
      </button>
      <button onClick={handleDismiss} className="text-white/50 hover:text-white flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
