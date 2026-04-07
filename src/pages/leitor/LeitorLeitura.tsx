import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, X, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getValidRevistaSession,
  clearRevistaSession,
  REVISTA_KEYS,
} from "@/lib/revistaSession";
import { useLeitorManifest } from "./LeitorAcesso";
import LeitorInstallBanner from "@/components/leitor/LeitorInstallBanner";

interface Revista {
  id: string;
  titulo: string;
  capa_url: string | null;
  tipo?: string;
  tipo_conteudo?: string;
}

interface Licao {
  id: string;
  numero: number;
  titulo: string;
  paginas: string[];
}

export default function LeitorLeitura() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [revistas, setRevistas] = useState<Revista[]>([]);
  const [selectedRevista, setSelectedRevista] = useState<Revista | null>(null);
  const [allPages, setAllPages] = useState<string[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useLeitorManifest();

  // Check session
  useEffect(() => {
    const session = getValidRevistaSession();
    if (!session) {
      navigate("/leitor/acesso", { replace: true });
      return;
    }

    // Load revistas from localStorage
    try {
      const stored = localStorage.getItem(REVISTA_KEYS.LICENCAS);
      if (stored) {
        const licencas = JSON.parse(stored);
        const mapped: Revista[] = licencas
          .filter((l: any) => l.revistas_digitais || l.revista_id)
          .map((l: any) => {
            const r = l.revistas_digitais || {};
            return {
              id: r.id || l.revista_id,
              titulo: r.titulo || "Revista",
              capa_url: r.capa_url || null,
              tipo: r.tipo,
              tipo_conteudo: r.tipo_conteudo,
            };
          });
        // Dedupe by id
        const unique = mapped.filter(
          (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
        );
        setRevistas(unique);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [navigate]);

  // Load all pages when a revista is selected
  const loadAllPages = useCallback(async (revistaId: string) => {
    setLoadingPages(true);
    setAllPages([]);
    try {
      const { data: licoes } = await supabase
        .from("revista_licoes")
        .select("id, numero, titulo, paginas")
        .eq("revista_id", revistaId)
        .order("numero", { ascending: true });

      if (licoes && licoes.length > 0) {
        const pages: string[] = [];
        for (const licao of licoes as Licao[]) {
          if (licao.paginas && Array.isArray(licao.paginas)) {
            for (const p of licao.paginas) {
              pages.push(p);
            }
          }
        }
        setAllPages(pages);
      }
    } catch {
      // silent
    } finally {
      setLoadingPages(false);
    }
  }, []);

  const handleSelectRevista = (r: Revista) => {
    setSelectedRevista(r);
    setScrollProgress(0);
    loadAllPages(r.id);
  };

  const handleClose = () => {
    setSelectedRevista(null);
    setAllPages([]);
    setScrollProgress(0);
  };

  const handleLogout = () => {
    clearRevistaSession();
    navigate("/leitor/acesso", { replace: true });
  };

  // Scroll progress
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !selectedRevista) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const max = scrollHeight - clientHeight;
      if (max > 0) {
        setScrollProgress((scrollTop / max) * 100);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [selectedRevista, allPages]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#000" }}>
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  // READER MODE
  if (selectedRevista) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#000" }}>
        {/* Progress bar */}
        <div className="fixed top-0 left-0 right-0 z-50 h-1" style={{ backgroundColor: "#222" }}>
          <div
            className="h-full transition-all duration-150"
            style={{ width: `${scrollProgress}%`, backgroundColor: "#FFC107" }}
          />
        </div>

        {/* Header */}
        <div
          className="fixed top-1 left-0 right-0 z-40 flex items-center justify-between px-4 py-2"
          style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
        >
          <h2 className="text-white text-sm font-semibold truncate flex-1 mr-3">
            {selectedRevista.titulo}
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Pages */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pt-12"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {loadingPages ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            </div>
          ) : allPages.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-white/50">Nenhuma página encontrada</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              {allPages.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Página ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-auto block"
                  style={{ backgroundColor: "#111" }}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // LIBRARY MODE
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#000" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#222" }}>
        <div className="flex items-center gap-2">
          <img src="/icons/leitor-cg-192.png" alt="Leitor CG" className="w-8 h-8" />
          <span className="text-white font-bold text-lg">Leitor CG</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
          style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>

      <LeitorInstallBanner />

      {/* Revistas grid */}
      <div className="p-4">
        {revistas.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/50">Nenhuma revista disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {revistas.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelectRevista(r)}
                className="text-left group"
              >
                <div className="aspect-[3/4] rounded-lg overflow-hidden" style={{ backgroundColor: "#1a1a1a" }}>
                  {r.capa_url ? (
                    <img
                      src={r.capa_url}
                      alt={r.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white/30 text-4xl">📖</span>
                    </div>
                  )}
                </div>
                <p className="text-white text-sm mt-2 truncate">{r.titulo}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
