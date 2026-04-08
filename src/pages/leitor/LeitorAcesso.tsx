import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getValidRevistaSession,
  clearRevistaSession,
  saveRevistaSession,
  persistRevistaToken,
} from "@/lib/revistaSession";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function extractDigits(value: string) {
  return value.replace(/\D/g, "");
}

export default function LeitorAcesso() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [step, setStep] = useState<"numero" | "codigo">("numero");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpMotivo, setOtpMotivo] = useState<"primeiro_acesso" | "prazo_expirado">("primeiro_acesso");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const session = getValidRevistaSession();
    if (session) {
      navigate("/leitor/leitura", { replace: true });
      return;
    }
    clearRevistaSession();
    setCheckingSession(false);
  }, [navigate]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const cleanNumber = extractDigits(phone);

  const handleSolicitarOtp = useCallback(async () => {
    if (cleanNumber.length < 10) {
      setError("Por favor, verifique se o número está correto");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "revista-solicitar-otp",
        { body: { whatsapp: cleanNumber } }
      );
      if (fnError) throw fnError;

      if (data?.status === "acesso_direto") {
        const newToken = persistRevistaToken(data.token);
        if (!newToken) { setError("Ocorreu um erro. Tente novamente."); return; }
        saveRevistaSession(newToken, data.licencas);
        const destino = data.versao_preferida === "cg_digital" ? "/revista/leitura" : "/leitor/leitura";
        navigate(destino, { replace: true });
        return;
      }

      if (data?.status === "otp_enviado" || data?.sucesso) {
        setOtpMotivo(data?.motivo === "prazo_expirado" ? "prazo_expirado" : "primeiro_acesso");
        setStep("codigo");
        setResendTimer(60);
        setOtp(["", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }

      if (data?.erro === "numero_nao_encontrado") {
        setError("Número não encontrado. Verifique se usou o mesmo número informado na compra.");
        return;
      }
      if (data?.erro === "numero_invalido") {
        setError("Por favor, verifique se o número está correto");
        return;
      }
      if (data?.erro) {
        setError("Ocorreu um erro. Tente novamente.");
        return;
      }
    } catch {
      setError("Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [cleanNumber, navigate]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 3) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleValidarOtp = async () => {
    const codigo = otp.join("");
    if (codigo.length !== 4) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "revista-validar-otp",
        { body: { whatsapp: cleanNumber, codigo } }
      );
      if (fnError) throw fnError;
      if (data?.erro === "codigo_invalido") {
        setError("Código incorreto ou expirado. Verifique o WhatsApp e tente novamente.");
        setOtp(["", "", "", ""]);
        otpRefs.current[0]?.focus();
        return;
      }
      if (data?.erro) { setError("Ocorreu um erro. Tente novamente."); return; }
      const newToken = persistRevistaToken(data.token);
      if (!newToken) { setError("Ocorreu um erro. Tente novamente."); return; }
      saveRevistaSession(newToken, data.licencas);
      const destino = data.versao_preferida === "cg_digital" ? "/revista/leitura" : "/leitor/leitura";
      navigate(destino, { replace: true });
    } catch {
      setError("Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (resendTimer > 0) return;
    handleSolicitarOtp();
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#000000" }}>
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#000000" }}>
      <div className="w-full max-w-[400px] space-y-6">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-full overflow-hidden" style={{ backgroundColor: "#000" }}>
            <img
              src="/icons/leitor-cg-192.png"
              alt="Leitor CG"
              className="w-20 h-20 rounded-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">Leitor CG</h1>
          <p className="text-white/50">
            {step === "numero" ? "Acesse sua revista" : "Código enviado!"}
          </p>
        </div>

        {step === "numero" && (
          <div className="space-y-4">
            <p className="text-white/70 text-center text-sm">
              Digite o número de WhatsApp que você usou na compra
            </p>
            <input
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              maxLength={16}
              className="w-full h-14 text-xl text-center rounded-lg outline-none transition-colors"
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #333",
                color: "#fff",
              }}
            />
            {error && (
              <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: "rgba(255,193,7,0.1)", border: "1px solid rgba(255,193,7,0.3)" }}>
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#FFC107" }} />
                <p className="text-sm" style={{ color: "#FFC107" }}>{error}</p>
              </div>
            )}
            <button
              onClick={handleSolicitarOtp}
              disabled={loading || cleanNumber.length < 10}
              className="w-full h-14 text-lg font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#FFC107", color: "#000" }}
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              Acessar minha biblioteca
            </button>
          </div>
        )}

        {step === "codigo" && (
          <div className="space-y-4">
            {otpMotivo === "prazo_expirado" && (
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: "rgba(255,193,7,0.1)", border: "1px solid rgba(255,193,7,0.3)" }}>
                <p className="text-sm font-semibold" style={{ color: "#FFC107" }}>
                  Seu acesso expirou após 30 dias de inatividade.
                </p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,193,7,0.7)" }}>
                  Digite o código enviado para o seu WhatsApp para renovar o acesso.
                </p>
              </div>
            )}
            {otpMotivo === "primeiro_acesso" && (
              <p className="text-white/70 text-center text-sm">
                Enviamos 4 números para o seu WhatsApp.<br />
                Abra o WhatsApp e digite o código aqui:
              </p>
            )}
            <div className="flex justify-center gap-3">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-14 h-16 text-3xl text-center rounded-lg outline-none transition-colors"
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "2px solid #333",
                    color: "#fff",
                  }}
                />
              ))}
            </div>
            {error && (
              <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: "rgba(255,193,7,0.1)", border: "1px solid rgba(255,193,7,0.3)" }}>
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#FFC107" }} />
                <p className="text-sm" style={{ color: "#FFC107" }}>{error}</p>
              </div>
            )}
            <button
              onClick={handleValidarOtp}
              disabled={loading || otp.join("").length !== 4}
              className="w-full h-14 text-lg font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#FFC107", color: "#000" }}
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              Entrar
            </button>
            <div className="text-center">
              <button
                onClick={handleResend}
                disabled={resendTimer > 0}
                className="text-sm underline disabled:opacity-50"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {resendTimer > 0 ? `Reenviar em ${resendTimer}s` : "Não recebi o código"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
