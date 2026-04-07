import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AnotacaoPanelProps {
  whatsapp: string;
  revistaId: string;
  licaoId: string;
  pagina: number;
  anotacaoExistente: string | null;
  onSalvar: (texto: string) => void;
  onExcluir: () => void;
  onFechar: () => void;
}

export function AnotacaoPanel({
  whatsapp,
  revistaId,
  licaoId,
  pagina,
  anotacaoExistente,
  onSalvar,
  onExcluir,
  onFechar,
}: AnotacaoPanelProps) {
  const [texto, setTexto] = useState(anotacaoExistente || "");
  const [salvando, setSalvando] = useState(false);
  const [visible, setVisible] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_CHARS = 500;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    setTimeout(() => textareaRef.current?.focus(), 350);
  }, []);

  const fecharAnimado = () => {
    setVisible(false);
    setTimeout(onFechar, 300);
  };

  const handleSalvar = async () => {
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await supabase.functions.invoke("salvar-anotacao-revista", {
        body: { whatsapp, revista_id: revistaId, licao_id: licaoId, pagina, texto: texto.trim() },
      });
      onSalvar(texto.trim());
    } catch {
      // silent
    } finally {
      setSalvando(false);
      fecharAnimado();
    }
  };

  const handleExcluir = async () => {
    setSalvando(true);
    try {
      await supabase.functions.invoke("salvar-anotacao-revista", {
        body: { whatsapp, revista_id: revistaId, licao_id: licaoId, pagina, texto: "" },
      });
      onExcluir();
    } catch {
      // silent
    } finally {
      setSalvando(false);
      fecharAnimado();
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
            📝 Anotação — Página {pagina + 1}
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

        {/* Textarea */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) setTexto(e.target.value);
            }}
            placeholder="Escreva sua anotação aqui..."
            style={{
              width: "100%",
              minHeight: 120,
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#1B3A5C")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e5e5")}
          />
          <span
            style={{
              position: "absolute",
              bottom: 8,
              right: 12,
              fontSize: 12,
              color: texto.length >= MAX_CHARS ? "#ef4444" : "#9ca3af",
            }}
          >
            {texto.length}/{MAX_CHARS}
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={handleSalvar}
            disabled={salvando || !texto.trim()}
            style={{
              width: "100%",
              padding: 14,
              border: "none",
              borderRadius: 8,
              background: "#1B3A5C",
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              cursor: salvando || !texto.trim() ? "not-allowed" : "pointer",
              opacity: salvando || !texto.trim() ? 0.6 : 1,
            }}
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>

          {anotacaoExistente && (
            <button
              onClick={handleExcluir}
              disabled={salvando}
              style={{
                width: "100%",
                padding: 12,
                background: "transparent",
                border: "1px solid #fecaca",
                borderRadius: 8,
                color: "#ef4444",
                fontWeight: 600,
                fontSize: 15,
                cursor: salvando ? "not-allowed" : "pointer",
              }}
            >
              Excluir anotação
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
