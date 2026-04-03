import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, LogOut, ArrowLeft, ChevronLeft, ChevronRight,
  X, List, Columns, PartyPopper, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RevistaDigital {
  id: string;
  titulo: string;
  capa_url: string | null;
  total_licoes: number | null;
  tipo: string | null;
  pdf_url?: string | null;
}

interface Licenca {
  id: string;
  revista_id: string;
  nome_comprador: string;
  expira_em: string | null;
  revistas_digitais: RevistaDigital | null;
}

interface Licao {
  id: string;
  titulo: string;
  numero: number;
  paginas: string[] | null;
}

interface CatalogoItem {
  id: string;
  revista_digital_id: string;
  shopify_url: string;
  revistas_digitais: {
    id: string;
    titulo: string;
    capa_url: string | null;
    tipo: string | null;
  } | null;
}

interface ProgressoSalvo {
  licaoId: string;
  licaoNumero: number;
  licaoTitulo: string;
  pagina: number;
}

function callAdminPublic(action: string, params: Record<string, unknown> = {}) {
  return supabase.functions.invoke("revista-licencas-shopify-admin", {
    body: { action, ...params },
  });
}

export default function RevistaLeitura() {
  const navigate = useNavigate();
  const [licencas, setLicencas] = useState<Licenca[]>([]);
  const [nomeComprador, setNomeComprador] = useState("");
  const [selectedRevista, setSelectedRevista] = useState<string | null>(null);
  const [licoes, setLicoes] = useState<Licao[]>([]);
  const [loadingLicoes, setLoadingLicoes] = useState(false);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);

  // Reader state
  const [licaoAberta, setLicaoAberta] = useState<Licao | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [modoLeitura, setModoLeitura] = useState<"setas" | "rolagem">("setas");
  const [zoomed, setZoomed] = useState(false);
  const touchStartX = useRef(0);

  // Melhoria 1 — Lembrar onde parou
  const [progressoSalvo, setProgressoSalvo] = useState<ProgressoSalvo | null>(null);

  // Melhoria 2 — Modo noturno
  const [modoNoturno, setModoNoturno] = useState(false);

  // Melhoria 3 — Dica de navegação
  const [mostrarDica, setMostrarDica] = useState(false);

  // Load night mode preference
  useEffect(() => {
    const salvo = localStorage.getItem("revista_modo_noturno");
    if (salvo === "true") setModoNoturno(true);
  }, []);

  const toggleModoNoturno = () => {
    const novo = !modoNoturno;
    setModoNoturno(novo);
    localStorage.setItem("revista_modo_noturno", String(novo));
  };

  // Auth check
  useEffect(() => {
    const token = sessionStorage.getItem("revista_token");
    if (!token) {
      navigate("/revista/acesso", { replace: true });
      return;
    }
    try {
      const decoded = JSON.parse(atob(token));
      if (decoded.exp < Date.now()) {
        sessionStorage.removeItem("revista_token");
        sessionStorage.removeItem("revista_licencas");
        navigate("/revista/acesso", { replace: true });
        return;
      }
    } catch {
      navigate("/revista/acesso", { replace: true });
      return;
    }

    const stored = sessionStorage.getItem("revista_licencas");
    if (stored) {
      const parsed = JSON.parse(stored) as Licenca[];
      setLicencas(parsed);
      if (parsed.length > 0) {
        setNomeComprador(parsed[0].nome_comprador || "");
      }
      if (parsed.length === 1 && parsed[0].revista_id) {
        setSelectedRevista(parsed[0].revista_id);
      }
    }
  }, [navigate]);

  // Fetch catalog for "Descubra mais"
  useEffect(() => {
    if (licencas.length === 0) return;
    callAdminPublic("list_catalogo").then(({ data, error }) => {
      if (error || !data?.data) return;
      const ownedIds = new Set(licencas.map((l) => l.revista_id));
      const filtered = (data.data as CatalogoItem[]).filter(
        (item) => item.revistas_digitais && !ownedIds.has(item.revista_digital_id)
      );
      const seen = new Set<string>();
      const unique = filtered.filter((item) => {
        if (seen.has(item.revista_digital_id)) return false;
        seen.add(item.revista_digital_id);
        return true;
      });
      setCatalogo(unique);
    });
  }, [licencas]);

  // Fetch lessons + check saved progress
  useEffect(() => {
    if (!selectedRevista) return;
    setLoadingLicoes(true);
    supabase
      .from("revista_licoes" as any)
      .select("id, titulo, numero, paginas")
      .eq("revista_id", selectedRevista)
      .order("numero", { ascending: true })
      .then(({ data }) => {
        setLicoes((data as any) || []);
        setLoadingLicoes(false);
      });

    // Melhoria 1 — check saved progress
    const progressKey = `revista_progresso_${selectedRevista}`;
    const salvo = localStorage.getItem(progressKey);
    if (salvo) {
      try {
        setProgressoSalvo(JSON.parse(salvo));
      } catch {
        setProgressoSalvo(null);
      }
    } else {
      setProgressoSalvo(null);
    }
  }, [selectedRevista]);

  const handleLogout = () => {
    sessionStorage.removeItem("revista_token");
    sessionStorage.removeItem("revista_licencas");
    navigate("/revista/acesso", { replace: true });
  };

  // Reader navigation
  const paginas = licaoAberta?.paginas || [];
  const totalPages = paginas.length;
  const progressPercent = totalPages > 0 ? ((paginaAtual + 1) / totalPages) * 100 : 0;
  const progressKey = selectedRevista ? `revista_progresso_${selectedRevista}` : null;

  const goToPage = useCallback((page: number) => {
    if (page < 0 || page >= totalPages) return;
    setPaginaAtual(page);
    setZoomed(false);
  }, [totalPages]);

  // Save progress on page change
  useEffect(() => {
    if (!licaoAberta || !progressKey) return;
    localStorage.setItem(progressKey, JSON.stringify({
      licaoId: licaoAberta.id,
      licaoNumero: licaoAberta.numero,
      licaoTitulo: licaoAberta.titulo,
      pagina: paginaAtual,
    }));
  }, [licaoAberta, paginaAtual, progressKey]);

  // Keyboard navigation
  useEffect(() => {
    if (!licaoAberta) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoomed) { setZoomed(false); return; }
        setLicaoAberta(null); setPaginaAtual(0); return;
      }
      if (modoLeitura !== "setas" || zoomed) return;
      if (e.key === "ArrowRight" || e.key === " ") goToPage(paginaAtual + 1);
      if (e.key === "ArrowLeft") goToPage(paginaAtual - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [licaoAberta, paginaAtual, goToPage, modoLeitura, zoomed]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (modoLeitura !== "setas" || zoomed) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToPage(paginaAtual + 1);
      else goToPage(paginaAtual - 1);
    }
  };

  const abrirLicao = (licao: Licao) => {
    setLicaoAberta(licao);
    setPaginaAtual(0);
    setModoLeitura("setas");
    setZoomed(false);

    // Melhoria 1 — save on open
    if (progressKey) {
      localStorage.setItem(progressKey, JSON.stringify({
        licaoId: licao.id,
        licaoNumero: licao.numero,
        licaoTitulo: licao.titulo,
        pagina: 0,
      }));
    }

    // Melhoria 3 — keyboard hint
    const jaViu = localStorage.getItem("revista_dica_teclado");
    if (!jaViu) {
      setMostrarDica(true);
      localStorage.setItem("revista_dica_teclado", "true");
      setTimeout(() => setMostrarDica(false), 3000);
    }
  };

  const fecharLeitor = () => {
    setLicaoAberta(null);
    setPaginaAtual(0);
    setZoomed(false);
  };

  const irProximaLicao = () => {
    if (!licaoAberta) return;
    const idx = licoes.findIndex((l) => l.id === licaoAberta.id);
    if (idx >= 0 && idx < licoes.length - 1) {
      setLicaoAberta(licoes[idx + 1]);
      setPaginaAtual(0);
      setZoomed(false);
    }
  };

  const isLastPage = paginaAtual >= totalPages - 1;
  const isLastLicao = licaoAberta
    ? licoes.findIndex((l) => l.id === licaoAberta.id) === licoes.length - 1
    : false;

  const selectedLicenca = licencas.find((l) => l.revista_id === selectedRevista);
  const revista = selectedLicenca?.revistas_digitais;

  const readerBg = modoNoturno ? "#0a0a0a" : "#000";

  // ─── ZOOM OVERLAY ────────────────────────────────────────────
  if (licaoAberta && zoomed && paginas[paginaAtual]) {
    return (
      <div
        className="fixed inset-0 z-[60] overflow-auto cursor-zoom-out"
        style={{ backgroundColor: "#000" }}
        onClick={() => setZoomed(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img
          src={paginas[paginaAtual]}
          alt={`Página ${paginaAtual + 1} (zoom)`}
          className="w-full"
          style={{ minWidth: "100vw", touchAction: "pinch-zoom" }}
          draggable={false}
        />
      </div>
    );
  }

  // ─── READER VIEW ────────────────────────────────────────────
  if (licaoAberta) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col select-none"
        style={{ backgroundColor: readerBg }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Progress bar */}
        {modoLeitura === "setas" && (
          <Progress
            value={progressPercent}
            className="h-1 rounded-none"
            style={{ backgroundColor: "#1e293b" }}
          />
        )}

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2 backdrop-blur"
          style={{ backgroundColor: "rgba(15,23,42,0.8)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-white/60 text-sm shrink-0">
              Lição {licaoAberta.numero}
            </span>
            <span className="text-white font-medium text-sm truncate">
              {licaoAberta.titulo || `Lição ${licaoAberta.numero}`}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleModoNoturno}
              className="p-2 text-lg hover:bg-white/10 rounded"
              title={modoNoturno ? "Modo claro" : "Modo noturno"}
            >
              {modoNoturno ? "☀️" : "🌙"}
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setModoLeitura(modoLeitura === "setas" ? "rolagem" : "setas")
              }
              className="text-white hover:bg-white/10"
              title={modoLeitura === "setas" ? "Modo rolagem" : "Modo setas"}
            >
              {modoLeitura === "setas" ? (
                <List className="h-5 w-5" />
              ) : (
                <Columns className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={fecharLeitor}
              className="text-white hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {modoLeitura === "setas" ? (
          <>
            <div
              className="flex-1 flex items-center justify-center overflow-hidden relative"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {paginas.length > 0 ? (
                <img
                  src={paginas[paginaAtual]}
                  alt={`Página ${paginaAtual + 1}`}
                  className="h-[calc(100vh-120px)] w-full object-contain cursor-zoom-in"
                  style={{ touchAction: "pinch-zoom" }}
                  draggable={false}
                  onClick={() => setZoomed(true)}
                />
              ) : (
                <p className="text-white/50">Nenhuma página disponível</p>
              )}

              {/* Melhoria 3 — Keyboard hint */}
              {mostrarDica && modoLeitura === "setas" && (
                <div
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-white text-sm pointer-events-none"
                  style={{
                    background: "rgba(0,0,0,0.75)",
                    animation: "fadeInOut 3s ease-in-out forwards",
                  }}
                >
                  Use ← → ou toque para navegar
                </div>
              )}
            </div>

            {/* Footer nav */}
            <div
              className="flex items-center justify-between px-4 py-3 backdrop-blur"
              style={{ backgroundColor: "rgba(15,23,42,0.8)" }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToPage(paginaAtual - 1)}
                disabled={paginaAtual === 0}
                className="text-white hover:bg-white/10"
              >
                <ChevronLeft className="h-5 w-5 mr-1" /> Anterior
              </Button>
              <span className="text-white/60 text-sm">
                Página {paginaAtual + 1} de {totalPages}
              </span>
              {isLastPage ? (
                isLastLicao ? (
                  <span className="text-sm font-medium flex items-center gap-1" style={{ color: "#f97316" }}>
                    <PartyPopper className="h-4 w-4" /> Concluída!
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={irProximaLicao}
                    className="text-white"
                    style={{ backgroundColor: "#f97316" }}
                  >
                    Próxima lição <ChevronRight className="h-5 w-5 ml-1" />
                  </Button>
                )
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goToPage(paginaAtual + 1)}
                  className="text-white hover:bg-white/10"
                >
                  Próxima <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              )}
            </div>
          </>
        ) : (
          /* Scroll mode */
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col items-center gap-1">
              {paginas.map((url, i) => (
                <div key={i} className="relative w-full max-w-3xl mx-auto">
                  <img
                    src={url}
                    alt={`Página ${i + 1}`}
                    className="w-full object-contain"
                    style={{ touchAction: "pinch-zoom" }}
                    draggable={false}
                  />
                </div>
              ))}
              {/* End-of-lesson action */}
              <div className="py-8 text-center">
                {isLastLicao ? (
                  <p className="text-white font-medium flex items-center justify-center gap-2">
                    <PartyPopper className="h-5 w-5" style={{ color: "#f97316" }} />
                    Você concluiu a revista!
                  </p>
                ) : (
                  <Button
                    size="lg"
                    onClick={irProximaLicao}
                    className="text-white"
                    style={{ backgroundColor: "#f97316" }}
                  >
                    Próxima lição <ChevronRight className="h-5 w-5 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Keyframe for hint animation */}
        <style>{`@keyframes fadeInOut { 0% { opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }`}</style>
      </div>
    );
  }

  // ─── LIST VIEW ──────────────────────────────────────────────
  return (
    <div
      className={`min-h-screen ${modoNoturno ? "" : "bg-background"}`}
      style={modoNoturno ? { background: "#0f0f0f" } : undefined}
    >
      {/* Header */}
      <div
        className={`px-4 py-4 flex items-center justify-between ${modoNoturno ? "" : "bg-primary text-primary-foreground"}`}
        style={modoNoturno ? { background: "#1a1a1a", color: "#fff" } : undefined}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6" />
          <div>
            <p className="text-lg font-semibold">Revista Digital</p>
            {nomeComprador && (
              <p className="text-sm opacity-80">Olá, {nomeComprador}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleModoNoturno}
            className="p-2 text-lg rounded hover:opacity-80"
            title={modoNoturno ? "Modo claro" : "Modo noturno"}
          >
            {modoNoturno ? "☀️" : "🌙"}
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={modoNoturno
              ? "text-white hover:text-white/80 hover:bg-white/10 text-base"
              : "text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10 text-base"
            }
          >
            <LogOut className="h-5 w-5 mr-2" />
            Sair
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Back button when viewing a specific revista */}
        {selectedRevista && licencas.length > 1 && (
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedRevista(null);
              setLicoes([]);
              setProgressoSalvo(null);
            }}
            className={`mb-4 text-base ${modoNoturno ? "text-white hover:bg-white/10" : ""}`}
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Voltar às revistas
          </Button>
        )}

        {/* Multiple revistas - show grid */}
        {!selectedRevista && licencas.length > 1 && (
          <div className="space-y-6">
            <h1 className={`text-2xl font-bold ${modoNoturno ? "text-white" : "text-foreground"}`}>
              Suas Revistas
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {licencas.map((l) => (
                <Card
                  key={l.id}
                  className={`cursor-pointer hover:shadow-lg transition-shadow overflow-hidden ${modoNoturno ? "bg-[#1a1a1a] border-white/10" : ""}`}
                  onClick={() => setSelectedRevista(l.revista_id)}
                >
                  {l.revistas_digitais?.capa_url && (
                    <div className="w-full aspect-[3/4] flex items-center justify-center bg-muted">
                      <img
                        src={l.revistas_digitais.capa_url}
                        alt={l.revistas_digitais.titulo}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <CardContent className="p-5">
                    <h2 className={`text-lg font-semibold ${modoNoturno ? "text-white" : ""}`}>
                      {l.revistas_digitais?.titulo || "Revista"}
                    </h2>
                    <Button className="w-full mt-3 h-12 text-base">Ler</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Lessons list */}
        {selectedRevista && (
          <div className="space-y-6">
            {revista?.capa_url && (
              <div className="flex justify-center">
                <img
                  src={revista.capa_url}
                  alt={revista.titulo}
                  className="max-w-xs rounded-lg shadow-md"
                />
              </div>
            )}
            <h1 className={`text-2xl font-bold text-center ${modoNoturno ? "text-white" : "text-foreground"}`}>
              {revista?.titulo || "Revista"}
            </h1>

            {loadingLicoes ? (
              <p className={`text-center text-lg ${modoNoturno ? "text-white/60" : "text-muted-foreground"}`}>
                Carregando lições...
              </p>
            ) : licoes.length === 0 ? (
              <p className={`text-center text-lg ${modoNoturno ? "text-white/60" : "text-muted-foreground"}`}>
                Nenhuma lição disponível no momento.
              </p>
            ) : (
              <div className="space-y-3">
                {/* Melhoria 1 — Continue where you left off */}
                {progressoSalvo && licoes.length > 0 && (
                  <div
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg"
                    style={{ background: "#1B3A5C" }}
                  >
                    <span className="text-white text-sm">
                      Continuar da Lição {progressoSalvo.licaoNumero}, Página {progressoSalvo.pagina + 1}?
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const licao = licoes.find((l) => l.id === progressoSalvo.licaoId);
                          if (licao) {
                            abrirLicao(licao);
                            setTimeout(() => setPaginaAtual(progressoSalvo.pagina), 100);
                          }
                          setProgressoSalvo(null);
                        }}
                        style={{
                          background: "#fff",
                          color: "#1B3A5C",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 14px",
                          cursor: "pointer",
                          fontWeight: "500",
                          fontSize: "14px",
                        }}
                      >
                        Continuar
                      </button>
                      <button
                        onClick={() => {
                          if (progressKey) localStorage.removeItem(progressKey);
                          setProgressoSalvo(null);
                        }}
                        style={{
                          background: "transparent",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.4)",
                          borderRadius: "6px",
                          padding: "6px 14px",
                          cursor: "pointer",
                          fontSize: "14px",
                        }}
                      >
                        Recomeçar
                      </button>
                    </div>
                  </div>
                )}

                {licoes.map((licao) => (
                  <Card
                    key={licao.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${modoNoturno ? "bg-[#1a1a1a] border-white/10" : ""}`}
                    onClick={() => abrirLicao(licao)}
                  >
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <p className={`text-lg font-semibold ${modoNoturno ? "text-white" : ""}`}>
                          Lição {licao.numero}
                        </p>
                        <p className={`text-base ${modoNoturno ? "text-white/60" : "text-muted-foreground"}`}>
                          {licao.titulo}
                        </p>
                      </div>
                      <BookOpen className={`h-5 w-5 ${modoNoturno ? "text-white/40" : "text-muted-foreground"}`} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Descubra mais */}
        {catalogo.length > 0 && !selectedRevista && (
          <div className="space-y-6 mt-10">
            <h2 className={`text-2xl font-bold ${modoNoturno ? "text-white" : "text-foreground"}`}>
              Descubra mais materiais
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {catalogo.map((item) => (
                <Card
                  key={item.id}
                  className={`overflow-hidden border-dashed border-2 ${modoNoturno ? "bg-[#1a1a1a] border-white/20" : "border-muted-foreground/30"}`}
                >
                  {item.revistas_digitais?.capa_url && (
                    <div className="w-full aspect-[3/4] flex items-center justify-center bg-muted">
                      <img
                        src={item.revistas_digitais.capa_url}
                        alt={item.revistas_digitais.titulo}
                        className="w-full h-full object-contain opacity-90"
                      />
                    </div>
                  )}
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Disponível
                      </span>
                    </div>
                    <h3 className={`text-lg font-semibold ${modoNoturno ? "text-white" : ""}`}>
                      {item.revistas_digitais?.titulo || "Revista"}
                    </h3>
                    <Button
                      className="w-full h-12 text-base"
                      variant="outline"
                      onClick={() => window.open(item.shopify_url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" /> Ver produto
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No licencas */}
        {licencas.length === 0 && (
          <div className="text-center space-y-4 py-12">
            <p className={`text-lg ${modoNoturno ? "text-white/60" : "text-muted-foreground"}`}>
              Nenhuma revista encontrada.
            </p>
            <Button onClick={handleLogout} className="h-12 text-base">
              Voltar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
