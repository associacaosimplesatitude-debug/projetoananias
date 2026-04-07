import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getRevistaTokenExpiresAt,
  parseRevistaToken,
  persistRevistaToken,
  REVISTA_KEYS,
  getValidRevistaSession,
  clearRevistaSession,
  saveRevistaSession,
} from "@/lib/revistaSession";
import logoCentralGospel from "@/assets/logo_central_gospel.png";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function extractDigits(value: string) {
  return value.replace(/\D/g, "");
}

export default function RevistaAcesso() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [step, setStep] = useState<"numero" | "codigo">("numero");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check existing session BEFORE rendering
  useEffect(() => {
    const session = getValidRevistaSession();
    if (session) {
      navigate("/revista/leitura", { replace: true });
      return;
    }
    // Session invalid or absent — clear and show form
    clearRevistaSession();
    setCheckingSession(false);
  }, [navigate]);

  // Resend timer countdown
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

      // Handle acesso_direto — enter without OTP
      if (data?.status === "acesso_direto") {
        const newToken = persistRevistaToken(data.token);
        if (!newToken) {
          setError("Ocorreu um erro. Tente novamente.");
          return;
        }
        saveRevistaSession(newToken, data.licencas);
        navigate("/revista/leitura", { replace: true });
        return;
      }

      // Handle OTP sent
      if (data?.status === "otp_enviado" || data?.sucesso) {
        setStep("codigo");
        setResendTimer(60);
        setOtp(["", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }

      if (data?.erro === "numero_nao_encontrado") {
        setError(
          "Número não encontrado. Verifique se usou o mesmo número informado na compra."
        );
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
    if (value && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
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
        setError(
          "Código incorreto ou expirado. Verifique o WhatsApp e tente novamente."
        );
        setOtp(["", "", "", ""]);
        otpRefs.current[0]?.focus();
        return;
      }
      if (data?.erro) {
        setError("Ocorreu um erro. Tente novamente.");
        return;
      }
      const newToken = persistRevistaToken(data.token);
      if (!newToken) {
        setError("Ocorreu um erro. Tente novamente.");
        return;
      }

      saveRevistaSession(newToken, data.licencas);
      navigate("/revista/leitura", { replace: true });
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

  // Show nothing while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <Card className="w-full max-w-[480px] shadow-lg border-0">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto w-20 h-20 flex items-center justify-center">
              <img src={logoCentralGospel} alt="Central Gospel Editora" className="w-20 h-20 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {step === "numero"
                ? "Acesse sua Revista Digital"
                : "Código enviado!"}
            </h1>
          </div>

          {step === "numero" && (
            <div className="space-y-5">
              <p className="text-lg text-muted-foreground text-center">
                Digite o número de WhatsApp que você usou na compra
              </p>
              <div>
                <Input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="h-14 text-xl text-center"
                  maxLength={16}
                />
              </div>
              {error && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-base text-amber-800">{error}</p>
                </div>
              )}
              <Button
                onClick={handleSolicitarOtp}
                disabled={loading || cleanNumber.length < 10}
                className="w-full h-14 text-lg font-semibold"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : null}
                Enviar código pelo WhatsApp
              </Button>
            </div>
          )}

          {step === "codigo" && (
            <div className="space-y-5">
              <p className="text-lg text-muted-foreground text-center">
                Enviamos 4 números para o seu WhatsApp.
                <br />
                Abra o WhatsApp e digite o código aqui:
              </p>
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
                    className="w-16 h-[72px] text-4xl text-center border-2 border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                  />
                ))}
              </div>
              {error && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-base text-amber-800">{error}</p>
                </div>
              )}
              <Button
                onClick={handleValidarOtp}
                disabled={loading || otp.join("").length !== 4}
                className="w-full h-14 text-lg font-semibold"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : null}
                Entrar
              </Button>
              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={resendTimer > 0}
                  className="text-base text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed underline"
                >
                  {resendTimer > 0
                    ? `Reenviar em ${resendTimer}s`
                    : "Não recebi o código"}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
