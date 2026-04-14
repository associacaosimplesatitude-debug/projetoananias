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

function isEmail(value: string) {
  return value.includes("@");
}

export default function RevistaAcesso() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [step, setStep] = useState<"numero" | "codigo">("numero");
  const [phone, setPhone] = useState("");
  const [inputMode, setInputMode] = useState<"phone" | "email">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpMotivo, setOtpMotivo] = useState<"primeiro_acesso" | "prazo_expirado">("primeiro_acesso");
  const [otpEnviadoPorEmail, setOtpEnviadoPorEmail] = useState(false);
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
  const emailValue = inputMode === "email" ? phone.trim().toLowerCase() : "";

  const isInputValid = inputMode === "email" 
    ? emailValue.includes("@") && emailValue.includes(".")
    : cleanNumber.length >= 10;

  const handleInputChange = (value: string) => {
    setPhone(value);
    // Auto-detect: if user types @, switch to email mode
    if (value.includes("@") && inputMode === "phone") {
      setInputMode("email");
    }
  };

  const handleSolicitarOtp = useCallback(async () => {
    if (!isInputValid) {
      setError(inputMode === "email" 
        ? "Por favor, insira um email válido" 
        : "Por favor, verifique se o número está correto");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = inputMode === "email" 
        ? { email: emailValue } 
        : { whatsapp: cleanNumber };

      const { data, error: fnError } = await supabase.functions.invoke(
        "revista-solicitar-otp",
        { body }
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
        const destino = data.versao_preferida === "leitor_cg" ? "/leitor/leitura" : "/revista/leitura";
        navigate(destino, { replace: true });
        return;
      }

      // Handle OTP sent
      if (data?.status === "otp_enviado" || data?.sucesso) {
        setOtpMotivo(data?.motivo === "prazo_expirado" ? "prazo_expirado" : "primeiro_acesso");
        setOtpEnviadoPorEmail(data?.otp_via === "email" || inputMode === "email");
        setStep("codigo");
        setResendTimer(60);
        setOtp(["", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }

      if (data?.erro === "numero_nao_encontrado") {
        setError(
          inputMode === "email"
            ? "Email não encontrado. Verifique se usou o mesmo email informado na compra."
            : "Número não encontrado. Verifique se usou o mesmo número informado na compra."
        );
        return;
      }
      if (data?.erro === "numero_invalido") {
        setError(inputMode === "email"
          ? "Por favor, insira um email válido"
          : "Por favor, verifique se o número está correto");
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
  }, [cleanNumber, emailValue, inputMode, isInputValid, navigate]);

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
      const body = inputMode === "email"
        ? { email: emailValue, codigo }
        : { whatsapp: cleanNumber, codigo };

      const { data, error: fnError } = await supabase.functions.invoke(
        "revista-validar-otp",
        { body }
      );
      if (fnError) throw fnError;
      if (data?.erro === "codigo_invalido") {
        setError(
          "Código incorreto ou expirado. Verifique e tente novamente."
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
      const destino = data.versao_preferida === "leitor_cg" ? "/leitor/leitura" : "/revista/leitura";
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

  const toggleMode = () => {
    setInputMode(prev => prev === "phone" ? "email" : "phone");
    setPhone("");
    setError("");
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
                {inputMode === "phone"
                  ? "Digite o número de WhatsApp que você usou na compra"
                  : "Digite o email que você usou na compra"}
              </p>
              <div>
                {inputMode === "phone" ? (
                  <Input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => handleInputChange(formatPhone(e.target.value))}
                    className="h-14 text-xl text-center"
                    maxLength={16}
                  />
                ) : (
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={phone}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="h-14 text-xl text-center"
                  />
                )}
              </div>
              {error && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-base text-amber-800">{error}</p>
                </div>
              )}
              <Button
                onClick={handleSolicitarOtp}
                disabled={loading || !isInputValid}
                className="w-full h-14 text-lg font-semibold"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : null}
                Acessar minha biblioteca
              </Button>
              <div className="text-center">
                <button
                  onClick={toggleMode}
                  className="text-sm text-muted-foreground hover:text-primary underline"
                >
                  {inputMode === "phone"
                    ? "Prefiro acessar com meu email"
                    : "Prefiro acessar com meu WhatsApp"}
                </button>
              </div>
            </div>
          )}

          {step === "codigo" && (
            <div className="space-y-5">
              {otpMotivo === "prazo_expirado" && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-center">
                  <p className="text-base font-semibold text-amber-800">
                    Seu acesso expirou após 30 dias de inatividade.
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Digite o código enviado para {otpEnviadoPorEmail ? "o seu email" : "o seu WhatsApp"} para renovar o acesso.
                  </p>
                </div>
              )}
              {otpMotivo === "primeiro_acesso" && (
                <p className="text-lg text-muted-foreground text-center">
                  {otpEnviadoPorEmail ? (
                    <>
                      Enviamos 4 números para o seu email.
                      <br />
                      Verifique sua caixa de entrada e digite o código aqui:
                    </>
                  ) : (
                    <>
                      Enviamos 4 números para o seu WhatsApp.
                      <br />
                      Abra o WhatsApp e digite o código aqui:
                    </>
                  )}
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
