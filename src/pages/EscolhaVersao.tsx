import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageCircle, X, Send } from "lucide-react";

interface Videos {
  video_celular_cg_digital: string | null;
  video_desktop_cg_digital: string | null;
  video_celular_leitor: string | null;
  video_desktop_leitor: string | null;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MSG: ChatMsg = {
  role: "assistant",
  content: "Olá! Pode me perguntar qualquer coisa sobre as duas versões. Estou aqui para ajudar você a escolher a que melhor combina com o seu jeito de estudar a Palavra. 😊",
};

const MAX_USER_MSGS = 3;

export default function EscolhaVersao() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const whatsapp = searchParams.get("w") || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [videos, setVideos] = useState<Videos>({
    video_celular_cg_digital: null,
    video_desktop_cg_digital: null,
    video_celular_leitor: null,
    video_desktop_leitor: null,
  });

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([INITIAL_MSG]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const userMsgCount = chatMessages.filter((m) => m.role === "user").length;
  const chatLimitReached = userMsgCount >= MAX_USER_MSGS;

  useEffect(() => {
    const load = async () => {
      const promises: Promise<void>[] = [];
      if (whatsapp) {
        promises.push(
          supabase.functions
            .invoke("buscar-preferencia-versao", { body: { whatsapp } })
            .then(({ data }) => {
              if (data?.encontrado && data.nome) setNome(data.nome);
            })
            .catch(() => {})
        );
      }
      promises.push(
        supabase.functions
          .invoke("buscar-videos-escolha", { body: {} })
          .then(({ data }) => {
            if (data) setVideos(data);
          })
          .catch(() => {})
      );
      await Promise.all(promises);
      setLoading(false);
    };
    load();
  }, [whatsapp]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const handleChoose = async (versao: "cg_digital" | "leitor_cg") => {
    setSaving(versao);
    try {
      if (whatsapp) {
        const { error } = await supabase.functions.invoke("salvar-preferencia-versao", {
          body: { whatsapp, versao },
        });
        if (error) console.error("[EscolhaVersao] Erro ao salvar:", error);
      }
    } catch (err) {
      console.error("[EscolhaVersao] Erro catch:", err);
    }
    navigate(versao === "cg_digital" ? "/revista/acesso" : "/leitor/acesso", { replace: true });
  };

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading || chatLimitReached) return;

    const userMsg: ChatMsg = { role: "user", content: text };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput("");
    setChatLoading(true);

    try {
      // Send only user/assistant messages (skip the initial hardcoded one for context)
      const apiMessages = updated
        .filter((_, i) => i > 0) // skip initial greeting
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("chat-escolha-versao", {
        body: { messages: apiMessages },
      });

      if (error || data?.error) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Desculpe, não consegui responder agora. Tente novamente em instantes." },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Desculpe, houve um erro. Tente novamente." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#000" }}>
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#000" }}>
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <img
            src="/icons/logo-cg.png"
            alt="Central Gospel"
            className="w-[72px] h-[72px] mx-auto"
            style={{ borderRadius: 14 }}
          />
          {nome && <h1 className="text-white text-[22px] font-bold">Olá, {nome}!</h1>}
          <p style={{ color: "#9ca3af" }} className="text-base">
            Como você prefere ler sua revista?
          </p>
        </div>

        {/* CG Digital Card */}
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "#111", border: "2px solid #FFC107" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: "rgba(255,193,7,0.15)" }}
            >
              📖
            </div>
            <div className="flex-1">
              <span className="text-white font-bold text-lg">CG Digital</span>
            </div>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "rgba(255,193,7,0.15)", color: "#FFC107" }}
            >
              Versão completa
            </span>
          </div>
          <p style={{ color: "#9ca3af" }} className="text-sm">
            Acesso completo com recursos exclusivos para enriquecer seu estudo bíblico.
          </p>
          <ul className="space-y-2.5">
            {[
              "Acesso apenas com seu número de celular — sem senha para lembrar",
              "Modo noturno — tela escura para não cansar os olhos à noite",
              "Quiz ao final de cada lição com pontuação e ranking entre leitores",
              "Versículos bíblicos citados na lição — veja o texto sem sair da revista",
              "Anotações por página salvas em qualquer dispositivo",
              "O sistema lembra onde você parou — continue de onde deixou",
            ].map((text, i) => (
              <li key={i} className="flex gap-2 text-sm" style={{ color: "#d1d5db" }}>
                <span style={{ color: "#FFC107" }} className="shrink-0">✓</span>
                {text}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleChoose("cg_digital")}
            disabled={saving !== null}
            className="w-full py-3 rounded-xl font-bold text-base transition-opacity"
            style={{ backgroundColor: "#FFC107", color: "#000" }}
          >
            {saving === "cg_digital" ? "Redirecionando..." : "Quero o CG Digital"}
          </button>
        </div>

        {/* Leitor CG Card */}
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "#111", border: "1px solid #3d3d3d" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              📱
            </div>
            <div className="flex-1">
              <span className="text-white font-bold text-lg">Leitor CG</span>
            </div>
            <span
              className="text-[10px] font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#9ca3af" }}
            >
              Versão offline — baixa a revista no seu celular
            </span>
          </div>
          <p style={{ color: "#9ca3af" }} className="text-sm">
            Na primeira vez, a revista é baixada para o seu celular. Depois é só abrir e ler — mesmo sem internet, em qualquer lugar.
          </p>
          <ul className="space-y-2.5">
            {[
              { text: "Acesso apenas com seu número de celular — sem senha para lembrar", ok: true },
              { text: "Páginas da revista na tela, uma após a outra — só deslize para baixo", ok: true },
              { text: "Funciona sem internet após o download inicial", ok: true },
              { text: "Sem quiz, pontos, anotações ou referências bíblicas", ok: false },
            ].map((item, i) => (
              <li key={i} className="flex gap-2 text-sm" style={{ color: item.ok ? "#d1d5db" : "#6b7280" }}>
                <span style={{ color: item.ok ? "#9ca3af" : "#555" }} className="shrink-0">
                  {item.ok ? "✓" : "✗"}
                </span>
                {item.text}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleChoose("leitor_cg")}
            disabled={saving !== null}
            className="w-full py-3 rounded-xl font-bold text-base transition-opacity"
            style={{ backgroundColor: "#1a1a1a", border: "1.5px solid #FFC107", color: "#FFC107" }}
          >
            {saving === "leitor_cg" ? "Redirecionando..." : "Quero o Leitor CG"}
          </button>
        </div>

        {/* Chat Button / Area */}
        {!chatOpen ? (
          <button
            onClick={() => setChatOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-opacity hover:opacity-80"
            style={{ border: "1px solid #333", color: "#9ca3af", backgroundColor: "transparent" }}
          >
            <MessageCircle className="w-4 h-4" />
            Ficou com dúvida? Converse com nossa assistente
          </button>
        ) : (
          <div style={{ backgroundColor: "#111", borderRadius: 16, padding: 0, overflow: "hidden" }}>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #222" }}>
              <span className="text-white font-semibold text-sm">Assistente de escolha</span>
              <button
                onClick={() => setChatOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            {/* Messages */}
            <div className="px-4 py-3 space-y-3 overflow-y-auto" style={{ maxHeight: 300 }}>
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%]">
                    {msg.role === "assistant" && i === 0 && (
                      <span className="text-[11px] font-semibold block mb-1" style={{ color: "#FFC107" }}>
                        Assistente
                      </span>
                    )}
                    <div
                      className="text-sm px-3.5 py-2.5"
                      style={
                        msg.role === "user"
                          ? {
                              backgroundColor: "#FFC107",
                              color: "#000",
                              borderRadius: "12px 4px 12px 12px",
                            }
                          : {
                              backgroundColor: "#1a1a1a",
                              color: "#fff",
                              borderRadius: "4px 12px 12px 12px",
                            }
                      }
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div
                    className="text-sm px-3.5 py-2.5"
                    style={{ backgroundColor: "#1a1a1a", color: "#9ca3af", borderRadius: "4px 12px 12px 12px" }}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      digitando
                      <span className="animate-pulse">.</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>.</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>.</span>
                    </span>
                  </div>
                </div>
              )}

              {chatLimitReached && (
                <div className="text-center py-2">
                  <p className="text-xs" style={{ color: "#9ca3af" }}>
                    Espero ter ajudado! Agora é só escolher sua versão acima. 😊
                  </p>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-1">
              <div
                className="flex items-center gap-2 rounded-xl overflow-hidden"
                style={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }}
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder={chatLimitReached ? "Limite de mensagens atingido" : "Digite sua dúvida..."}
                  disabled={chatLimitReached || chatLoading}
                  className="flex-1 bg-transparent text-white text-sm px-4 py-3 outline-none placeholder:text-gray-600"
                  style={{ color: "#fff" }}
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || chatLoading || chatLimitReached}
                  className="p-2.5 mr-1 rounded-lg transition-opacity"
                  style={{
                    backgroundColor: chatInput.trim() && !chatLimitReached ? "#FFC107" : "transparent",
                    color: chatInput.trim() && !chatLimitReached ? "#000" : "#555",
                    opacity: chatInput.trim() && !chatLimitReached ? 1 : 0.5,
                  }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: "#374151" }}>
          Você pode mudar sua preferência a qualquer momento
        </p>
      </div>
    </div>
  );
}
