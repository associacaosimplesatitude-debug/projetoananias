import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, ChevronRight, CheckCircle2, XCircle } from "lucide-react";

interface Pergunta {
  pergunta: string;
  opcao_a: string;
  opcao_b: string;
  opcao_c: string;
  resposta_correta: string;
}

interface Props {
  licaoId: string;
  licaoTitulo: string;
  whatsapp: string;
  onFechar: () => void;
}

type Fase = "loading" | "indisponivel" | "quiz" | "enviando" | "resultado";

export function RevistaQuizPublico({ licaoId, licaoTitulo, whatsapp, onFechar }: Props) {
  const [fase, setFase] = useState<Fase>("loading");
  const [quizId, setQuizId] = useState<string | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [perguntaAtual, setPerguntaAtual] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  // Resultado
  const [acertos, setAcertos] = useState(0);
  const [totalPerguntas, setTotalPerguntas] = useState(0);
  const [pontosGanhos, setPontosGanhos] = useState(0);
  const [respostasCorretas, setRespostasCorretas] = useState<string[]>([]);

  useEffect(() => {
    buscarQuiz();
  }, [licaoId]);

  const buscarQuiz = async () => {
    setFase("loading");
    try {
      const { data, error } = await supabase.functions.invoke("buscar-quiz-licao", {
        body: { licao_id: licaoId },
      });

      if (error || !data?.quiz) {
        setFase("indisponivel");
        return;
      }

      const quiz = data.quiz;
      setQuizId(quiz.id);
      const p = Array.isArray(quiz.perguntas) ? quiz.perguntas : [];
      if (p.length === 0) {
        setFase("indisponivel");
        return;
      }
      setPerguntas(p);
      setFase("quiz");
    } catch {
      setFase("indisponivel");
    }
  };

  const selecionarResposta = (opcao: string) => {
    setRespostas((prev) => ({ ...prev, [String(perguntaAtual)]: opcao }));
  };

  const avancar = () => {
    if (perguntaAtual < perguntas.length - 1) {
      setPerguntaAtual((p) => p + 1);
    }
  };

  const enviarRespostas = async () => {
    if (!quizId) return;
    setFase("enviando");

    try {
      const { data, error } = await supabase.functions.invoke("salvar-quiz-publico", {
        body: { quiz_id: quizId, licao_id: licaoId, whatsapp, respostas },
      });

      if (error || !data) {
        setFase("quiz");
        return;
      }

      setAcertos(data.acertos);
      setTotalPerguntas(data.total_perguntas);
      setPontosGanhos(data.pontos_ganhos);
      setRespostasCorretas(data.respostas_corretas || []);
      setFase("resultado");

      // Marcar no localStorage
      localStorage.setItem(`quiz_feito_${licaoId}`, "true");
      localStorage.setItem(`quiz_pontos_${licaoId}`, String(data.pontos_ganhos));
    } catch {
      setFase("quiz");
    }
  };

  const respostaSelecionada = respostas[String(perguntaAtual)];
  const isUltimaPergunta = perguntaAtual === perguntas.length - 1;
  const progressPercent = perguntas.length > 0 ? ((perguntaAtual + 1) / perguntas.length) * 100 : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "#1c1915",
          borderBottom: "2px solid #FFC107",
        }}
      >
        <span
          style={{
            color: "#FFC107",
            fontWeight: 600,
            fontSize: "15px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            marginRight: 12,
          }}
        >
          📝 Quiz — {licaoTitulo}
        </span>
        <button
          onClick={onFechar}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#FFC107",
            padding: 4,
          }}
        >
          <X size={22} />
        </button>
      </div>

      {/* Progress bar */}
      {fase === "quiz" && (
        <div style={{ height: 4, background: "#e5e5e5" }}>
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: "#FFC107",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 16px" }}>
        {fase === "loading" && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#888" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #e5e5e5",
                borderTopColor: "#FFC107",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            Carregando quiz...
          </div>
        )}

        {fase === "indisponivel" && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}>
            <p style={{ fontSize: 18, marginBottom: 16 }}>Quiz não disponível para esta lição</p>
            <button
              onClick={onFechar}
              style={{
                background: "#1c1915",
                color: "#FFC107",
                border: "none",
                borderRadius: 8,
                padding: "12px 24px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Fechar
            </button>
          </div>
        )}

        {fase === "quiz" && perguntas[perguntaAtual] && (
          <div
            style={{
              maxWidth: 600,
              margin: "0 auto",
              animation: "fadeIn 0.3s ease",
            }}
          >
            <p style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>
              Pergunta {perguntaAtual + 1} de {perguntas.length}
            </p>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1c1915",
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              {perguntas[perguntaAtual].pergunta}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(["A", "B", "C"] as const).map((letra) => {
                const key = `opcao_${letra.toLowerCase()}` as keyof Pergunta;
                const texto = perguntas[perguntaAtual][key];
                const selecionado = respostaSelecionada === letra;

                return (
                  <button
                    key={letra}
                    onClick={() => selecionarResposta(letra)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: selecionado ? "2px solid #FFC107" : "2px solid #e5e5e5",
                      background: selecionado ? "#FFC107" : "#fff",
                      color: selecionado ? "#1c1915" : "#333",
                      fontWeight: selecionado ? 600 : 400,
                      fontSize: 15,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 14,
                        background: selecionado ? "#1c1915" : "#f5f5f5",
                        color: selecionado ? "#FFC107" : "#888",
                        flexShrink: 0,
                      }}
                    >
                      {letra}
                    </span>
                    {texto}
                  </button>
                );
              })}
            </div>

            {/* Botão avançar */}
            {respostaSelecionada && (
              <div style={{ marginTop: 28, textAlign: "center" }}>
                {isUltimaPergunta ? (
                  <button
                    onClick={enviarRespostas}
                    style={{
                      background: "#1c1915",
                      color: "#FFC107",
                      border: "none",
                      borderRadius: 10,
                      padding: "14px 32px",
                      fontWeight: 700,
                      fontSize: 16,
                      cursor: "pointer",
                      width: "100%",
                      maxWidth: 300,
                    }}
                  >
                    Ver resultado
                  </button>
                ) : (
                  <button
                    onClick={avancar}
                    style={{
                      background: "#FFC107",
                      color: "#1c1915",
                      border: "none",
                      borderRadius: 10,
                      padding: "14px 32px",
                      fontWeight: 700,
                      fontSize: 16,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    Próxima <ChevronRight size={18} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {fase === "enviando" && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#888" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid #e5e5e5",
                borderTopColor: "#FFC107",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            Calculando resultado...
          </div>
        )}

        {fase === "resultado" && (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            {/* Score */}
            <div
              style={{
                textAlign: "center",
                padding: "24px",
                background: "#f9f9f9",
                borderRadius: 16,
                marginBottom: 24,
              }}
            >
              <p style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>Seu resultado</p>
              <p style={{ fontSize: 36, fontWeight: 800, color: "#1c1915", marginBottom: 4 }}>
                {acertos} de {totalPerguntas}
              </p>
              <p style={{ fontSize: 14, color: "#888" }}>perguntas corretas</p>
              <div
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  padding: "8px 20px",
                  borderRadius: 20,
                  background: "#FFC107",
                  color: "#1c1915",
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                +{pontosGanhos} pontos
              </div>
            </div>

            {/* Detalhes por pergunta */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {perguntas.map((p, i) => {
                const correta = respostasCorretas[i];
                const minhaResp = respostas[String(i)];
                const acertou = minhaResp?.toUpperCase() === correta?.toUpperCase();

                return (
                  <div
                    key={i}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: `2px solid ${acertou ? "#22c55e" : "#ef4444"}`,
                      background: acertou ? "#f0fdf4" : "#fef2f2",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                      {acertou ? (
                        <CheckCircle2 size={20} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                      ) : (
                        <XCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                      )}
                      <p style={{ fontSize: 14, fontWeight: 500, color: "#333", margin: 0 }}>
                        {p.pergunta}
                      </p>
                    </div>
                    {!acertou && (
                      <p style={{ fontSize: 13, color: "#22c55e", marginLeft: 30, marginTop: 4, fontWeight: 500 }}>
                        Resposta correta: {correta} —{" "}
                        {p[`opcao_${correta?.toLowerCase()}` as keyof Pergunta]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Fechar */}
            <div style={{ marginTop: 28, textAlign: "center" }}>
              <button
                onClick={onFechar}
                style={{
                  background: "#1c1915",
                  color: "#FFC107",
                  border: "none",
                  borderRadius: 10,
                  padding: "14px 32px",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: "pointer",
                  width: "100%",
                  maxWidth: 300,
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
