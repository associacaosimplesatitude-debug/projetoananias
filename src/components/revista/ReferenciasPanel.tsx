import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ReferenciasPanelProps {
  licaoId: string;
  pagina: number;
  onFechar: () => void;
}

export function ReferenciasPanel({ licaoId, pagina, onFechar }: ReferenciasPanelProps) {
  const [referencias, setReferencias] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const [verseTexts, setVerseTexts] = useState<Record<string, string>>({});
  const [loadingVerse, setLoadingVerse] = useState<string | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    fetchRefs();
  }, []);

  const fetchRefs = async () => {
    try {
      const { data } = await supabase.functions.invoke("buscar-referencias-pagina", {
        body: { licao_id: licaoId, pagina },
      });
      if (data?.referencias && Array.isArray(data.referencias)) {
        setReferencias(data.referencias);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const fecharAnimado = () => {
    setVisible(false);
    setTimeout(onFechar, 300);
  };

  const handleRefClick = async (ref: string) => {
    if (expandedRef === ref) {
      setExpandedRef(null);
      return;
    }

    setExpandedRef(ref);

    if (verseTexts[ref]) return;

    setLoadingVerse(ref);
    try {
      const { data } = await supabase.functions.invoke("fetch-bible-verse", {
        body: { livro: ref },
      });
      if (data?.texto) {
        setVerseTexts((prev) => ({ ...prev, [ref]: data.texto }));
      } else {
        setVerseTexts((prev) => ({ ...prev, [ref]: "Texto não disponível. Consulte sua Bíblia." }));
      }
    } catch {
      setVerseTexts((prev) => ({ ...prev, [ref]: "Erro ao carregar. Consulte sua Bíblia." }));
    } finally {
      setLoadingVerse(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/* Overlay */}
      <div
        onClick={fecharAnimado}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: "16px 16px 0 0",
          padding: "20px 20px 24px",
          maxHeight: "70vh",
          overflowY: "auto",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s ease",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#1B3A5C" }}>
            📖 Referências — Página {pagina + 1}
          </p>
          <button
            onClick={fecharAnimado}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 22,
              color: "#9ca3af",
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 36,
                  borderRadius: 20,
                  background: "#f3f4f6",
                  animation: "pulse 1.5s infinite",
                }}
              />
            ))}
          </div>
        ) : referencias.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 15, textAlign: "center", padding: "20px 0" }}>
            Nenhuma referência encontrada nesta página
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {referencias.map((ref) => (
              <div key={ref}>
                <button
                  onClick={() => handleRefClick(ref)}
                  style={{
                    display: "inline-block",
                    background: expandedRef === ref ? "rgba(255,193,7,0.15)" : "#f3f4f6",
                    border: expandedRef === ref ? "1px solid #FFC107" : "1px solid #e5e5e5",
                    borderRadius: 20,
                    padding: "6px 14px",
                    fontSize: 14,
                    color: expandedRef === ref ? "#92400e" : "#333",
                    cursor: "pointer",
                    fontWeight: 500,
                    transition: "all 0.2s ease",
                  }}
                >
                  📖 {ref}
                </button>

                {expandedRef === ref && (
                  <div
                    style={{
                      marginTop: 8,
                      background: "#fffbeb",
                      border: "1px solid #FFC107",
                      borderRadius: 8,
                      padding: "12px 14px",
                      fontSize: 14,
                      color: "#333",
                      fontStyle: "italic",
                      lineHeight: 1.6,
                    }}
                  >
                    {loadingVerse === ref ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af" }}>
                        <div style={{
                          width: 16, height: 16, border: "2px solid #FFC107",
                          borderTopColor: "transparent", borderRadius: "50%",
                          animation: "spin 0.8s linear infinite",
                        }} />
                        Carregando versículo...
                      </div>
                    ) : (
                      verseTexts[ref] || "Carregando..."
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
