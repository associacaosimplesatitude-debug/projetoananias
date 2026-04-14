import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  persistRevistaToken,
  getValidRevistaSession,
  clearRevistaSession,
  saveRevistaSession,
} from "@/lib/revistaSession";
import logoCentralGospel from "@/assets/logo_central_gospel.png";

const COUNTRIES = [
  { code: "BR", flag: "🇧🇷", ddi: "55", label: "Brasil", maxDigits: 11, minDigits: 10, placeholder: "(11) 99999-9999" },
  { code: "PT", flag: "🇵🇹", ddi: "351", label: "Portugal", maxDigits: 9, minDigits: 9, placeholder: "913 603 081" },
  { code: "US", flag: "🇺🇸", ddi: "1", label: "Estados Unidos", maxDigits: 10, minDigits: 10, placeholder: "(212) 555-1234" },
] as const;

type Country = (typeof COUNTRIES)[number];

function formatPhoneBR(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatPhonePT(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function formatPhoneUS(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatPhone(value: string, country: Country) {
  if (country.code === "PT") return formatPhonePT(value);
  if (country.code === "US") return formatPhoneUS(value);
  return formatPhoneBR(value);
}

function extractDigits(value: string) {
  return value.replace(/\D/g, "");
}

function buildWhatsappIdentifier(digits: string, ddi: string): string {
  if (ddi === "55") return digits;
  return ddi + digits;
}

export default function RevistaAcesso() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [step, setStep] = useState<"numero" | "codigo">("numero");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [countryOpen, setCountryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpMotivo, setOtpMotivo] = useState<"primeiro_acesso" | "prazo_expirado">("primeiro_acesso");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const session = getValidRevistaSession();
    if (session) {
      navigate("/revista/leitura", { replace: true });
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

  // Close dropdown on outside click
  useEffect(() => {
    if (!countryOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [countryOpen]);

  const cleanNumber = extractDigits(phone);
  const identifier = buildWhatsappIdentifier(cleanNumber, country.ddi);

  const isInputValid = cleanNumber.length >= country.minDigits && cleanNumber.length <= country.maxDigits;

  const handleSolicitarOtp = useCallback(async () => {
    if (!isInputValid) {
      setError("Por favor, verifique se o número está correto");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "revista-solicitar-otp",
        { body: { whatsapp: identifier } }
      );
      if (fnError) throw fnError;

      if (data?.status === "acesso_direto") {
        const newToken = persistRevistaToken(data.token);
        if (!newToken) { setError("Ocorreu um erro. Tente novamente."); return; }
        saveRevistaSession(newToken, data.licencas);
        const destino = data.versao_preferida === "leitor_cg" ? "/leitor/leitura" : "/revista/leitura";
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
  }, [identifier, isInputValid, navigate]);

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
        { body: { whatsapp: identifier, codigo } }
      );
      if (fnError) throw fnError;
      if (data?.erro === "codigo_invalido") {
        setError("Código incorreto ou expirado. Verifique e tente novamente.");
        setOtp(["", "", "", ""]);
        otpRefs.current[0]?.focus();
        return;
      }
      if (data?.erro) { setError("Ocorreu um erro. Tente novamente."); return; }
      const newToken = persistRevistaToken(data.token);
      if (!newToken) { setError("Ocorreu um erro. Tente novamente."); return; }
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
              {step === "numero" ? "Acesse sua Revista Digital" : "Código enviado!"}
            </h1>
          </div>

          {step === "numero" && (
            <div className="space-y-5">
              <p className="text-lg text-muted-foreground text-center">
                Digite o número de WhatsApp que você usou na compra
              </p>
              <div className="flex gap-2">
                {/* Country selector */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setCountryOpen((o) => !o)}
                    className="h-14 px-3 flex items-center gap-1.5 rounded-lg border border-input bg-background hover:bg-accent transition-colors whitespace-nowrap"
                  >
                    <span className="text-xl leading-none">{country.flag}</span>
                    <span className="text-sm text-muted-foreground">+{country.ddi}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  {countryOpen && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-background border border-input rounded-lg shadow-lg z-50 py-1">
                      {COUNTRIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setCountry(c);
                            setPhone("");
                            setError("");
                            setCountryOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors ${
                            c.code === country.code ? "bg-accent/50" : ""
                          }`}
                        >
                          <span className="text-xl leading-none">{c.flag}</span>
                          <span className="text-sm font-medium text-foreground">{c.label}</span>
                          <span className="text-sm text-muted-foreground ml-auto">+{c.ddi}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Phone input */}
                <input
                  type="tel"
                  placeholder={country.placeholder}
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value, country))}
                  maxLength={20}
                  className="flex-1 h-14 text-xl text-center rounded-lg border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
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
                disabled={loading || !isInputValid}
                className="w-full h-14 text-lg font-semibold"
              >
                {loading && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
                Acessar minha biblioteca
              </Button>
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
                    Digite o código enviado para o seu WhatsApp para renovar o acesso.
                  </p>
                </div>
              )}
              {otpMotivo === "primeiro_acesso" && (
                <p className="text-lg text-muted-foreground text-center">
                  Enviamos 4 números para o seu WhatsApp.
                  <br />
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
                {loading && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
                Entrar
              </Button>
              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={resendTimer > 0}
                  className="text-base text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed underline"
                >
                  {resendTimer > 0 ? `Reenviar em ${resendTimer}s` : "Não recebi o código"}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
