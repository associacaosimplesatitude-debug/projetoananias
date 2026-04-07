import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, LogOut, ArrowLeft, ChevronLeft, ChevronRight,
  X, List, Columns, PartyPopper, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getValidRevistaSession,
  clearRevistaSession,
  parseRevistaToken,
  REVISTA_KEYS,
} from "@/lib/revistaSession";
import logoCentralGospel from "@/assets/logo_central_gospel.png";
import { RevistaQuizPublico } from "@/components/revista/RevistaQuizPublico";

interface RevistaDigital {
  id: string;
  titulo: string;
  capa_url: string | null;
  total_licoes: number | null;
  tipo: string | null;
  pdf_url?: string | null;
  leitura_continua?: boolean | null;
  tipo_conteudo?: string | null;
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

function MobilePdfReader({ pdfUrl, modoNoturno, titulo }: { pdfUrl: string; modoNoturno: boolean; titulo: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ filter: modoNoturno ? 'invert(1) hue-rotate(180deg)' : 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        loading={<p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>Carregando PDF...</p>}
        error={<p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>Erro ao carregar o PDF.</p>}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page key={i} pageNumber={i + 1} width={containerWidth} renderAnnotationLayer={false} renderTextLayer={false} />
        ))}
      </Document>
    </div>
  );
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
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Melhoria 1 — Lembrar onde parou
  const [progressoSalvo, setProgressoSalvo] = useState<ProgressoSalvo | null>(null);

  // WhatsApp do leitor para sync com banco
  const sessionWhatsapp = useMemo(() => {
    const session = getValidRevistaSession();
    return typeof session?.decoded?.whatsapp === "string" ? session.decoded.whatsapp : undefined;
  }, []);

  // Melhoria 2 — Modo noturno
  const [modoNoturno, setModoNoturno] = useState(false);

  // Melhoria 3 — Dica de navegação
  const [mostrarDica, setMostrarDica] = useState(false);

  // Modo Kindle
  const [modoKindle, setModoKindle] = useState(false);

  // Onboarding modal
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);

  // Quiz state
  const [quizDisponivel, setQuizDisponivel] = useState<Record<string, boolean>>({});
  const [quizNumPerguntas, setQuizNumPerguntas] = useState<Record<string, number>>({});
  const [quizAberto, setQuizAberto] = useState(false);
  const [quizLicaoId, setQuizLicaoId] = useState<string | null>(null);
  const [quizLicaoTitulo, setQuizLicaoTitulo] = useState("");

  // Ranking state
  const [ranking, setRanking] = useState<any[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);

  // Points counter (force re-render after quiz)
  const [pontosVersion, setPontosVersion] = useState(0);

  const fecharOnboarding = (naoMostrarMais: boolean) => {
    if (naoMostrarMais) {
      localStorage.setItem('revista_onboarding_v2', 'true');
    }
    setMostrarOnboarding(false);
  };

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

  const trackAcesso = async (licencasArr: Licenca[]) => {
    console.log('trackAcesso chamada com', licencasArr.length, 'licenças');
    const trackKey = 'revista_geo_tracked_' + new Date().toDateString();
    if (sessionStorage.getItem(trackKey)) return;
    sessionStorage.setItem(trackKey, 'true');

    let whatsappVal = '';
    const token = localStorage.getItem('revista_token');
    const decoded = token ? parseRevistaToken(token) : null;
    whatsappVal = typeof decoded?.whatsapp === 'string' ? decoded.whatsapp : '';

    const isMobileDevice = window.innerWidth < 768;
    const ua = navigator.userAgent;
    const sw = window.innerWidth;

    let ipData: any = {};
    try {
      const geoUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geo-ip`;
      const resp = await fetch(geoUrl, {
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (resp.ok) ipData = await resp.json();
    } catch { /* silent */ }

    console.log('geo-ip data:', ipData);

    for (const licenca of licencasArr) {
      const { data: record, error: insertError } = await supabase
        .from('revista_acessos_geo' as any)
        .insert({
          whatsapp: whatsappVal,
          revista_id: licenca.revista_id,
          ip: ipData.ip || null,
          cidade: ipData.city || null,
          estado: ipData.region || null,
          pais: ipData.country || 'BR',
          latitude: ipData.latitude || null,
          longitude: ipData.longitude || null,
          fonte_localizacao: 'ip',
          user_agent: ua,
          is_mobile: isMobileDevice,
          screen_width: sw,
        } as any)
        .select('id')
        .single();

      if (insertError) {
        console.error('revista_acessos_geo insert error:', insertError);
      } else {
        console.log('revista_acessos_geo inserido:', record);
      }

      if ((record as any)?.id && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { error: gpsError } = await supabase
              .from('revista_acessos_geo' as any)
              .update({
                latitude_gps: pos.coords.latitude,
                longitude_gps: pos.coords.longitude,
                precisao_gps: pos.coords.accuracy,
                fonte_localizacao: 'gps',
              } as any)
              .eq('id', (record as any).id);
            if (gpsError) {
              console.error('revista_acessos_geo GPS update error:', gpsError);
            } else {
              console.log('revista_acessos_geo GPS salvo:', pos.coords.latitude, pos.coords.longitude);
            }
          },
          (geoErr) => {
            console.warn('GPS negado/timeout:', geoErr.code, geoErr.message);
          },
          { timeout: 10000, maximumAge: 300000 }
        );
      }
    }
  };

  // Auth check
  useEffect(() => {
    const session = getValidRevistaSession();
    if (!session) {
      clearRevistaSession();
      navigate("/revista/acesso", { replace: true });
      return;
    }

    const stored = localStorage.getItem(REVISTA_KEYS.LICENCAS);
    if (stored) {
      const parsed = JSON.parse(stored) as Licenca[];
      setLicencas(parsed);
      if (parsed.length > 0) {
        setNomeComprador(parsed[0].nome_comprador || "");
      }
      if (parsed.length === 1 && parsed[0].revista_id) {
        setSelectedRevista(parsed[0].revista_id);
      }

      // Show onboarding if first visit
      const jaViu = localStorage.getItem('revista_onboarding_v2');
      if (!jaViu) setMostrarOnboarding(true);

      // Geo tracking
      trackAcesso(parsed);
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
        const licoesData = (data as any) || [];
        setLicoes(licoesData);
        setLoadingLicoes(false);

        // Check quiz availability for all lessons
        licoesData.forEach((licao: Licao) => {
          supabase.functions.invoke("buscar-quiz-licao", {
            body: { licao_id: licao.id },
          }).then(({ data: quizData }) => {
            if (quizData?.quiz) {
              setQuizDisponivel((prev) => ({ ...prev, [licao.id]: true }));
              const numP = Array.isArray(quizData.quiz.perguntas) ? quizData.quiz.perguntas.length : 0;
              setQuizNumPerguntas((prev) => ({ ...prev, [licao.id]: numP }));
            }
          }).catch(() => {});
        });
      });

    // Fetch ranking
    setRankingLoading(true);
    supabase.functions.invoke("buscar-ranking-revista", {
      body: { revista_id: selectedRevista },
    }).then(({ data }) => {
      setRanking(data?.ranking || []);
      setRankingLoading(false);
    }).catch(() => setRankingLoading(false));

    // Melhoria 1 — check saved progress (banco primeiro, localStorage fallback)
    const progressKey = `revista_progresso_${selectedRevista}`;
    const localSalvo = localStorage.getItem(progressKey);
    let localParsed: ProgressoSalvo | null = null;
    if (localSalvo) {
      try { localParsed = JSON.parse(localSalvo); } catch { /* ignore */ }
    }

    if (sessionWhatsapp) {
      supabase.functions.invoke("carregar-progresso-revista", {
        body: { whatsapp: sessionWhatsapp, revista_id: selectedRevista },
      }).then(({ data }) => {
        const p = data?.progresso;
        if (p && p.licao_id) {
          const prog: ProgressoSalvo = {
            licaoId: p.licao_id,
            licaoNumero: p.licao_numero,
            licaoTitulo: p.licao_titulo,
            pagina: p.pagina_atual ?? 0,
          };
          setProgressoSalvo(prog);
          localStorage.setItem(progressKey, JSON.stringify(prog));
        } else {
          setProgressoSalvo(localParsed);
        }
      }).catch(() => {
        setProgressoSalvo(localParsed);
      });
    } else {
      setProgressoSalvo(localParsed);
    }
  }, [selectedRevista]);

  const handleLogout = () => {
    clearRevistaSession();
    setModoKindle(false);
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
    const progressData = {
      licaoId: licaoAberta.id,
      licaoNumero: licaoAberta.numero,
      licaoTitulo: licaoAberta.titulo,
      pagina: paginaAtual,
    };
    localStorage.setItem(progressKey, JSON.stringify(progressData));

    // Sync com banco com debounce de 3s
    if (sessionWhatsapp && selectedRevista) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        supabase.functions.invoke("salvar-progresso-revista", {
          body: {
            whatsapp: sessionWhatsapp,
            revista_id: selectedRevista,
            licao_id: licaoAberta.id,
            licao_numero: licaoAberta.numero,
            licao_titulo: licaoAberta.titulo,
            pagina_atual: paginaAtual,
            concluida: false,
          },
        }).catch(() => {});
      }, 3000);
    }
  }, [licaoAberta, paginaAtual, progressKey, sessionWhatsapp, selectedRevista]);

  // Keyboard navigation
  useEffect(() => {
    if (!licaoAberta) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modoKindle) { setModoKindle(false); return; }
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

    // Sync com banco em background
    if (sessionWhatsapp && selectedRevista) {
      supabase.functions.invoke("salvar-progresso-revista", {
        body: {
          whatsapp: sessionWhatsapp,
          revista_id: selectedRevista,
          licao_id: licao.id,
          licao_numero: licao.numero,
          licao_titulo: licao.titulo,
          pagina_atual: 0,
          concluida: false,
        },
      }).catch(() => {});
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

  // ─── MODO KINDLE (PDF / imagens) ──────────────────────────────
  const isMobile = typeof window !== 'undefined' && (
    window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );

  if (modoKindle && revista) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: modoNoturno ? '#1a1a1a' : '#f5f0e8',
        display: 'flex', flexDirection: 'column',
        zIndex: 50
      }}>
        {/* Header — igual para mobile e desktop */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '10px 16px',
          background: '#1c1915',
          borderBottom: '1px solid rgba(246,186,50,0.2)',
          gap: '12px'
        }}>
          <button
            onClick={() => setModoKindle(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '14px', color: '#f6ba32',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            ← Voltar
          </button>
          <span style={{
            flex: 1, fontSize: '14px', fontWeight: '500',
            color: '#f6ba32',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {revista?.titulo}
          </span>
          <button
            onClick={toggleModoNoturno}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#f6ba32', opacity: 1 }}
          >
            {modoNoturno ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Conteúdo — condicional mobile vs desktop */}
        {isMobile ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            background: modoNoturno ? '#0a0a0a' : '#f5f0e8',
          }}>
            {(revista?.leitura_continua || revista?.tipo_conteudo === 'livro_digital') ? (
              licoes.length > 0 ? (
                <>
                  {licoes.map((licao) => (
                    (licao.paginas || []).map((url: string, i: number) => (
                      <img
                        key={`${licao.id}-${i}`}
                        src={url}
                        alt={`Página ${i + 1}`}
                        loading="lazy"
                        onContextMenu={(e) => e.preventDefault()}
                        style={{
                          width: '100%',
                          display: 'block',
                          filter: modoNoturno ? 'invert(1) hue-rotate(180deg)' : 'none'
                        }}
                      />
                    ))
                  ))}
                </>
              ) : loadingLicoes ? (
                <p style={{ color: modoNoturno ? '#e8dcc8' : '#3d2b1f', padding: '40px', textAlign: 'center' }}>
                  Carregando páginas...
                </p>
              ) : (
                <p style={{ color: modoNoturno ? '#e8dcc8' : '#3d2b1f', padding: '40px', textAlign: 'center' }}>
                  Conteúdo não disponível no momento.
                </p>
              )
            ) : (
              licoes.map((licao) => (
                <div key={licao.id}>
                  <div style={{
                    textAlign: 'center',
                    padding: '12px',
                    background: modoNoturno ? '#1a1a1a' : '#e8dcc8',
                    color: modoNoturno ? '#e8dcc8' : '#3d2b1f',
                    fontSize: '13px',
                    fontWeight: '500',
                    borderTop: '1px solid rgba(0,0,0,0.1)'
                  }}>
                    Lição {licao.numero} — {licao.titulo}
                  </div>
                  {(licao.paginas || []).map((url: string, i: number) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Lição ${licao.numero} - Página ${i + 1}`}
                      style={{
                        width: '100%',
                        display: 'block',
                        filter: modoNoturno ? 'invert(1) hue-rotate(180deg)' : 'none'
                      }}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={{
            flex: 1,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            display: 'flex',
            justifyContent: 'center',
            background: modoNoturno ? '#1a1a1a' : '#f5f0e8',
            position: 'relative'
          }}>
            {revista.pdf_url ? (
              <iframe
                src={`${revista.pdf_url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH&zoom=page-width`}
                style={{
                  border: 'none',
                  width: '100%',
                  height: '100%',
                  minHeight: '100vh',
                  background: modoNoturno ? '#1a1a1a' : '#f5f0e8',
                  filter: modoNoturno ? 'invert(1) hue-rotate(180deg)' : 'none',
                  display: 'block'
                }}
                title={revista?.titulo}
              />
            ) : (
              <p style={{ color: modoNoturno ? '#e8dcc8' : '#3d2b1f', padding: '40px', textAlign: 'center' }}>
                PDF não disponível para esta revista.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

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
            style={{ backgroundColor: '#1c1915' }}
            indicatorClassName="bg-[#f6ba32]"
          />
        )}

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ backgroundColor: '#1c1915' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm shrink-0" style={{ color: '#f6ba32', opacity: 0.7 }}>
              Lição {licaoAberta.numero}
            </span>
            <span className="font-medium text-sm truncate" style={{ color: '#f6ba32' }}>
              {licaoAberta.titulo || `Lição ${licaoAberta.numero}`}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleModoNoturno}
              className="p-2 rounded"
              style={{ fontSize: '20px', color: '#f6ba32', opacity: 1, background: 'none', border: 'none', cursor: 'pointer' }}
              title={modoNoturno ? "Modo claro" : "Modo noturno"}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(246,186,50,0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              {modoNoturno ? "☀️" : "🌙"}
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setModoLeitura(modoLeitura === "setas" ? "rolagem" : "setas")
              }
              style={{ color: '#f6ba32' }}
              className="hover:bg-[rgba(246,186,50,0.15)]"
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
              style={{ color: '#f6ba32' }}
              className="hover:bg-[rgba(246,186,50,0.15)]"
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
              className="flex items-center justify-between px-4 py-3"
              style={{ backgroundColor: '#1c1915' }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToPage(paginaAtual - 1)}
                disabled={paginaAtual === 0}
                style={{ color: '#f6ba32' }}
                className="hover:bg-[rgba(246,186,50,0.15)]"
              >
                <ChevronLeft className="h-5 w-5 mr-1" /> Anterior
              </Button>
              <span className="text-sm" style={{ color: '#f6ba32', opacity: 0.6 }}>
                Página {paginaAtual + 1} de {totalPages}
              </span>
              {isLastPage ? (
                <div className="flex items-center gap-2">
                  {/* Quiz button on last page */}
                  {licaoAberta && quizDisponivel[licaoAberta.id] && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setQuizLicaoId(licaoAberta.id);
                        setQuizLicaoTitulo(licaoAberta.titulo || `Lição ${licaoAberta.numero}`);
                        setQuizAberto(true);
                      }}
                      style={{
                        backgroundColor: localStorage.getItem(`quiz_feito_${licaoAberta.id}`) ? '#22c55e' : '#FFC107',
                        color: '#1c1915',
                      }}
                    >
                      {localStorage.getItem(`quiz_feito_${licaoAberta.id}`) ? '✅ Quiz respondido' : '📝 Fazer Quiz'}
                    </Button>
                  )}
                  {isLastLicao ? (
                    <span className="text-sm font-medium flex items-center gap-1" style={{ color: '#f6ba32' }}>
                      <PartyPopper className="h-4 w-4" /> Concluída!
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={irProximaLicao}
                      style={{ backgroundColor: '#f6ba32', color: '#1c1915' }}
                    >
                      Próxima lição <ChevronRight className="h-5 w-5 ml-1" />
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goToPage(paginaAtual + 1)}
                  style={{ color: '#f6ba32' }}
                  className="hover:bg-[rgba(246,186,50,0.15)]"
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
              <div className="py-8 text-center space-y-4">
                {/* Quiz button in scroll mode */}
                {licaoAberta && quizDisponivel[licaoAberta.id] && (
                  <button
                    onClick={() => {
                      setQuizLicaoId(licaoAberta.id);
                      setQuizLicaoTitulo(licaoAberta.titulo || `Lição ${licaoAberta.numero}`);
                      setQuizAberto(true);
                    }}
                    style={{
                      background: localStorage.getItem(`quiz_feito_${licaoAberta.id}`) ? '#22c55e' : '#FFC107',
                      color: '#1c1915',
                      border: 'none',
                      borderRadius: 10,
                      padding: '14px 28px',
                      fontWeight: 700,
                      fontSize: 16,
                      cursor: 'pointer',
                    }}
                  >
                    {localStorage.getItem(`quiz_feito_${licaoAberta.id}`) ? '✅ Quiz respondido' : '📝 Fazer Quiz desta Lição'}
                  </button>
                )}
                {isLastLicao ? (
                  <p className="text-white font-medium flex items-center justify-center gap-2">
                    <PartyPopper className="h-5 w-5" style={{ color: '#f6ba32' }} />
                    Você concluiu a revista!
                  </p>
                ) : (
                  <Button
                    size="lg"
                    onClick={irProximaLicao}
                    style={{ backgroundColor: '#f6ba32', color: '#1c1915' }}
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

        {/* Quiz modal overlay */}
        {quizAberto && quizLicaoId && sessionWhatsapp && (
          <RevistaQuizPublico
            licaoId={quizLicaoId}
            licaoTitulo={quizLicaoTitulo}
            whatsapp={sessionWhatsapp}
            onFechar={() => {
              setQuizAberto(false);
              setQuizLicaoId(null);
              setPontosVersion((v) => v + 1);
            }}
          />
        )}
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
        className="px-4 py-4 flex items-center justify-between"
        style={{ background: '#1c1915', color: '#f6ba32' }}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6" style={{ color: '#f6ba32' }} />
          <div>
            <p className="text-lg font-semibold" style={{ color: '#f6ba32' }}>Minha Biblioteca</p>
            {nomeComprador && (
              <p className="text-sm" style={{ color: '#f6ba32', opacity: 0.8 }}>Olá, {nomeComprador}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleModoNoturno}
            className="p-2 rounded"
            style={{ fontSize: '20px', color: '#f6ba32', opacity: 1, background: 'none', border: 'none', cursor: 'pointer' }}
            title={modoNoturno ? "Modo claro" : "Modo noturno"}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(246,186,50,0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            {modoNoturno ? "☀️" : "🌙"}
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            style={{ color: '#f6ba32' }}
            className="hover:bg-[rgba(246,186,50,0.15)] text-base"
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
              setModoKindle(false);
            }}
            className={`mb-4 text-base ${modoNoturno ? "text-white hover:bg-white/10" : ""}`}
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Voltar às revistas
          </Button>
        )}

        {/* Points card */}
        {!selectedRevista && licencas.length >= 1 && (() => {
          let totalPontos = 0;
          let totalQuizFeitos = 0;
          let totalQuizDisponiveis = 0;
          // Scan all localStorage for quiz points
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith("quiz_pontos_")) {
              totalPontos += parseInt(localStorage.getItem(key) || "0", 10);
              totalQuizFeitos++;
            }
          }
          // Count available quizzes from state
          totalQuizDisponiveis = Object.keys(quizDisponivel).length;
          // Use pontosVersion to force recalc
          void pontosVersion;

          return (
            <div
              style={{
                background: "linear-gradient(135deg, #1B3A5C, #2d5a8e)",
                borderRadius: 16,
                padding: "20px 24px",
                marginBottom: 24,
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 40 }}>🏆</span>
                <div>
                  <p style={{ color: "#fff", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, margin: 0, opacity: 0.8 }}>
                    Seus Pontos
                  </p>
                  <p style={{ color: "#FFC107", fontSize: 36, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
                    {totalPontos}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: 20,
                  height: 8,
                  width: 120,
                  overflow: "hidden",
                  marginBottom: 6,
                }}>
                  <div style={{
                    height: "100%",
                    width: `${totalQuizDisponiveis > 0 ? (totalQuizFeitos / Math.max(totalQuizDisponiveis, totalQuizFeitos)) * 100 : 0}%`,
                    background: "#FFC107",
                    borderRadius: 20,
                    transition: "width 0.4s ease",
                  }} />
                </div>
                <p style={{ color: "#fff", fontSize: 13, margin: 0, opacity: 0.8 }}>
                  {totalQuizFeitos} {totalQuizDisponiveis > 0 ? `de ${Math.max(totalQuizDisponiveis, totalQuizFeitos)} ` : ""}quizzes respondidos
                </p>
              </div>
            </div>
          );
        })()}

        {/* Multiple revistas - show grid */}
        {!selectedRevista && licencas.length > 1 && (
          <div className="space-y-6">
            <h1 className={`text-2xl font-bold ${modoNoturno ? "text-white" : "text-foreground"}`}>
              Minha Biblioteca
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
                    <Button className="w-full mt-3 h-12 text-base" style={{ background: '#f6ba32', color: '#1c1915' }}>Ler</Button>
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
                Carregando...
              </p>
            ) : (revista?.leitura_continua || revista?.tipo_conteudo === 'livro_digital') ? (
              <div className="space-y-4">
                {revista?.pdf_url ? (
                  <button
                    onClick={() => setModoKindle(true)}
                    className="flex items-center justify-center gap-3 w-full p-5 rounded-lg font-semibold text-lg transition-colors"
                    style={{
                      background: '#f6ba32',
                      color: '#1c1915',
                    }}
                  >
                    <BookOpen className="h-6 w-6" />
                    Ler Livro
                  </button>
                ) : (
                  <p className={`text-center text-lg ${modoNoturno ? "text-white/60" : "text-muted-foreground"}`}>
                    Conteúdo ainda não disponível.
                  </p>
                )}
              </div>
            ) : licoes.length === 0 ? (
              <p className={`text-center text-lg ${modoNoturno ? "text-white/60" : "text-muted-foreground"}`}>
                Nenhuma lição disponível no momento.
              </p>
            ) : (
              <div className="space-y-3">
                {/* Modo Kindle button */}
                {revista?.pdf_url && (
                  <button
                    onClick={() => setModoKindle(true)}
                    className="flex items-center gap-2 w-full p-4 rounded-lg font-medium text-lg transition-colors mb-4"
                    style={{
                      background: modoNoturno ? '#2a2a2a' : '#f5f0e8',
                      color: modoNoturno ? '#f6ba32' : '#1c1915',
                      border: `2px solid #f6ba32`
                    }}
                  >
                    <BookOpen className="h-5 w-5" />
                    Modo Leitura (texto contínuo)
                  </button>
                )}

                {/* Melhoria 1 — Continue where you left off */}
                {progressoSalvo && licoes.length > 0 && (
                  <div
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg"
                    style={{ background: '#1c1915' }}
                  >
                    <span className="text-sm" style={{ color: '#f6ba32' }}>
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
                          background: '#f6ba32',
                          color: '#1c1915',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 14px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '14px',
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
              Descubra mais
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
      {mostrarOnboarding && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.88)',
          zIndex: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#1c1915',
            borderRadius: '16px',
            padding: '28px 24px',
            maxWidth: '480px',
            width: '100%',
            border: '2px solid #f6ba32',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                background: '#fff',
                borderRadius: '12px',
                padding: '16px 24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <img
                  src={logoCentralGospel}
                  alt="Central Gospel Editora"
                  style={{ height: '48px', display: 'block' }}
                />
              </div>
              <h2 style={{
                color: '#f6ba32', margin: 0,
                fontSize: '20px', fontWeight: '600'
              }}>
                Bem-vindo à Minha Biblioteca!
              </h2>
              <p style={{
                color: '#aaa', fontSize: '14px',
                marginTop: '8px', marginBottom: 0
              }}>
                Veja tudo que você pode fazer:
              </p>
            </div>

            {[
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f6ba32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>, titulo: 'Leitura por Lições', descricao: 'Acesse cada lição separadamente com navegação por setas ou rolagem. Use ← → no teclado ou deslize a tela no celular.' },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f6ba32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, titulo: 'Modo Leitura (texto contínuo)', descricao: 'Leia a revista inteira do início ao fim sem interrupções. No celular as imagens aparecem em scroll, no computador abre o PDF completo.' },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f6ba32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>, titulo: 'Modo Noturno', descricao: 'Toque no ícone de lua no canto superior direito para ativar o fundo escuro. Ideal para leitura à noite. As cores invertem automaticamente.' },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f6ba32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>, titulo: 'Zoom nas páginas', descricao: 'Toque ou clique em qualquer página para ampliar e ver os detalhes. Toque novamente ou pressione ESC para voltar.' },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f6ba32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>, titulo: 'Continuar de onde parou', descricao: 'O sistema salva seu progresso automaticamente. Na próxima visita aparece um aviso para continuar da página onde você parou.' },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f6ba32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>, titulo: 'Descubra mais', descricao: 'Na tela inicial role até o final para ver outros materiais disponíveis que você ainda não tem.' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '16px',
                padding: '12px',
                background: 'rgba(246,186,50,0.08)',
                borderRadius: '10px',
                border: '1px solid rgba(246,186,50,0.2)'
              }}>
                <div style={{
                  width: '48px', height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(246,186,50,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{
                    color: '#f6ba32', fontWeight: '600',
                    fontSize: '14px', marginBottom: '4px'
                  }}>
                    {item.titulo}
                  </div>
                  <div style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.5' }}>
                    {item.descricao}
                  </div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => fecharOnboarding(false)}
                style={{
                  background: '#f6ba32',
                  color: '#1c1915',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                Entendi, vamos lá!
              </button>
              <button
                onClick={() => fecharOnboarding(true)}
                style={{
                  background: 'transparent',
                  color: '#888',
                  border: '1px solid #444',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                Não mostrar novamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
