import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, X, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getValidRevistaSession,
  clearRevistaSession,
  REVISTA_KEYS,
} from "@/lib/revistaSession";
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

const CACHE_NAME = "leitor-cg-v1";

function getCacheKey(revistaId: string) {
  return `leitor_cache_completo_${revistaId}`;
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

  // Cache state
  const [caching, setCaching] = useState(false);
  const [cacheProgress, setCacheProgress] = useState({
    paginaAtual: 0,
    totalGeral: 0,
    revistaIdx: 0,
    totalRevistas: 0,
    revistaName: "",
  });

  // Check session
  useEffect(() => {
    const session = getValidRevistaSession();
    if (!session) {
      navigate("/leitor/acesso", { replace: true });
      return;
    }

    // Load revistas from localStorage
    let mapped: Revista[] = [];
    try {
      const stored = localStorage.getItem(REVISTA_KEYS.LICENCAS);
      if (stored) {
        const licencas = JSON.parse(stored);
        mapped = licencas
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
        const unique = mapped.filter(
          (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
        );
        mapped = unique;
        setRevistas(unique);
      }
    } catch {
      // ignore
    }

    // Check if all revistas are cached
    const allCached = mapped.length > 0 && mapped.every((r) => localStorage.getItem(getCacheKey(r.id)));
    if (allCached) {
      setLoading(false);
    } else if (mapped.length > 0) {
      cacheAllRevistas(mapped).then(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [navigate]);

  const cacheAllRevistas = async (revistasToCache: Revista[]) => {
    setCaching(true);
    const uncached = revistasToCache.filter((r) => !localStorage.getItem(getCacheKey(r.id)));
    if (uncached.length === 0) { setCaching(false); return; }

    let cache: Cache | null = null;
    try {
      cache = await caches.open(CACHE_NAME);
    } catch {
      setCaching(false);
      return;
    }

    // Phase 1: Pre-fetch all URLs to calculate totalGeral
    const revistaUrls: { revista: Revista; urls: string[] }[] = [];
    let totalGeral = 0;

    for (const revista of uncached) {
      try {
        const { data: licoes } = await supabase
          .from("revista_licoes")
          .select("numero, paginas")
          .eq("revista_id", revista.id)
          .order("numero", { ascending: true });

        const urls: string[] = [];
        if (licoes) {
          for (const l of licoes as { numero: number; paginas: string[] }[]) {
            if (l.paginas && Array.isArray(l.paginas)) {
              urls.push(...l.paginas);
            }
          }
        }
        revistaUrls.push({ revista, urls });
        totalGeral += urls.length;
      } catch {
        revistaUrls.push({ revista, urls: [] });
      }
    }

    // Set initial progress with correct total
    setCacheProgress({
      paginaAtual: 0,
      totalGeral,
      revistaIdx: 1,
      totalRevistas: uncached.length,
      revistaName: uncached[0]?.titulo || "",
    });

    // Phase 2: Download all pages with global counter
    let paginaAtual = 0;

    for (let ri = 0; ri < revistaUrls.length; ri++) {
      const { revista, urls } = revistaUrls[ri];
      setCacheProgress((p) => ({
        ...p,
        revistaIdx: ri + 1,
        revistaName: revista.titulo,
      }));

      for (let i = 0; i < urls.length; i++) {
        paginaAtual++;
        setCacheProgress((p) => ({ ...p, paginaAtual }));
        try {
          const cached = await cache!.match(urls[i]);
          if (!cached) {
            const response = await fetch(urls[i]);
            if (response.ok) {
              await cache!.put(urls[i], response);
            }
          }
        } catch {
          // skip individual image errors
        }
      }

      localStorage.setItem(getCacheKey(revista.id), "true");
    }

    setCaching(false);
  };

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

  // CACHE LOADING SCREEN
  if (loading || caching) {
    const pct = cacheProgress.totalGeral > 0
      ? Math.round((cacheProgress.paginaAtual / cacheProgress.totalGeral) * 100)
      : 0;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: "#000" }}>
        <div
          className="w-16 h-16 mb-6 rounded-full overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: "#000" }}
        >
          <img src="/icons/leitor-cg-192.png" alt="Leitor CG" className="w-16 h-16 rounded-full" />
        </div>
        
        {caching ? (
          <div className="w-full max-w-sm space-y-4 text-center">
            <p className="text-[10px] uppercase tracking-[3px]" style={{ color: "#555" }}>
              PREPARANDO SEU ACESSO
            </p>
            <h2 className="text-white text-lg font-semibold">Carregando sua revista</h2>
            
            {cacheProgress.totalRevistas > 1 && (
              <p className="text-sm" style={{ color: "#9ca3af" }}>
                Revista {cacheProgress.revistaIdx} de {cacheProgress.totalRevistas}
              </p>
            )}
            <p className="font-bold text-sm" style={{ color: "#FFC107" }}>
              {cacheProgress.revistaName}
            </p>

            <div className="w-full rounded-full h-1.5" style={{ backgroundColor: "#1a1a1a" }}>
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: `${pct}%`, backgroundColor: "#FFC107" }}
              />
            </div>

            <div className="flex justify-between text-xs" style={{ color: "#6b7280" }}>
              <span>{pct}%</span>
              <span>{cacheProgress.paginaAtual} de {cacheProgress.totalGeral} páginas</span>
            </div>

            <p className="text-[11px] mt-4" style={{ color: "#1f2937" }}>
              Após o carregamento sua revista ficará disponível sem internet
            </p>
          </div>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        )}
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

  // LIBRARY MODE — 2-column grid with compact cards
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#000" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#222" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden" style={{ backgroundColor: "#000" }}>
            <img src="/icons/leitor-cg-192.png" alt="Leitor CG" className="w-8 h-8 rounded-full" />
          </div>
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
      <div className="p-3">
        {revistas.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/50">Nenhuma revista disponível</p>
          </div>
        ) : (
          <div
            className="max-w-2xl mx-auto"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
          >
            {revistas.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelectRevista(r)}
                className="text-left overflow-hidden"
                style={{ backgroundColor: "#111", borderRadius: "12px" }}
              >
                {r.capa_url ? (
                  <img
                    src={r.capa_url}
                    alt={r.titulo}
                    className="w-full object-cover"
                    style={{ aspectRatio: "3/4" }}
                  />
                ) : (
                  <div
                    className="w-full flex items-center justify-center"
                    style={{ aspectRatio: "3/4", backgroundColor: "#1a1a1a" }}
                  >
                    <span className="text-4xl">📖</span>
                  </div>
                )}
                <p
                  className="text-white font-medium"
                  style={{
                    padding: "10px 12px",
                    fontSize: "12px",
                    lineHeight: "1.4",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {r.titulo}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
