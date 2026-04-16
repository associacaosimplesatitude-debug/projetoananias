import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle, XCircle } from "lucide-react";

declare global {
  interface Window {
    Stripe: any;
  }
}

interface StripeCardPaymentFormProps {
  clientSecret: string;
  amount: number;
  publishableKey: string;
  onPaymentSuccess?: (paymentIntentId: string) => void;
}

export default function StripeCardPaymentForm({
  clientSecret,
  amount,
  publishableKey,
  onPaymentSuccess,
}: StripeCardPaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const cardRef = useRef<any>(null);
  const stripeRef = useRef<any>(null);
  const mountedRef = useRef(false);
  const containerIdRef = useRef(`stripe-card-${crypto.randomUUID().slice(0, 8)}`);

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const initStripe = () => {
      if (!window.Stripe) {
        setTimeout(initStripe, 200);
        return;
      }

      const stripe = window.Stripe(publishableKey);
      stripeRef.current = stripe;

      const elements = stripe.elements({ clientSecret });
      const card = elements.create("card", {
        style: {
          base: {
            fontSize: "16px",
            color: "#32325d",
            "::placeholder": { color: "#aab7c4" },
          },
          invalid: { color: "#fa755a" },
        },
      });

      const el = document.getElementById(containerIdRef.current);
      if (el) {
        card.mount(`#${containerIdRef.current}`);
        cardRef.current = card;

        card.on("ready", () => setCardReady(true));
        card.on("change", (event: any) => {
          setErrorMessage(event.error ? event.error.message : "");
        });
      }
    };

    initStripe();

    return () => {
      if (cardRef.current) {
        try { cardRef.current.destroy(); } catch {}
      }
    };
  }, [clientSecret, publishableKey]);

  const handlePay = async () => {
    if (!stripeRef.current || !cardRef.current) return;
    setLoading(true);
    setPaymentStatus("idle");
    setErrorMessage("");

    try {
      const { error, paymentIntent } = await stripeRef.current.confirmCardPayment(clientSecret, {
        payment_method: { card: cardRef.current },
      });

      if (error) {
        setPaymentStatus("error");
        setErrorMessage(error.message || "Erro ao processar pagamento");
      } else if (paymentIntent?.status === "succeeded") {
        setPaymentStatus("success");
        onPaymentSuccess?.(paymentIntent.id);
      } else {
        setPaymentStatus("error");
        setErrorMessage(`Status inesperado: ${paymentIntent?.status}`);
      }
    } catch (err: any) {
      setPaymentStatus("error");
      setErrorMessage(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 p-4 rounded-lg bg-muted border space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <CreditCard className="h-5 w-5" /> Pagamento com Cartão
      </h3>

      <div
        id={containerIdRef.current}
        className="p-3 bg-white rounded-md border min-h-[44px]"
      />

      {errorMessage && paymentStatus !== "success" && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Cartão de teste: <span className="font-mono">4242 4242 4242 4242</span> — validade{" "}
        <span className="font-mono">12/29</span> — CVC <span className="font-mono">123</span>
      </p>

      {paymentStatus === "success" ? (
        <Badge className="bg-green-600 text-white hover:bg-green-700 py-2 px-4 text-sm">
          <CheckCircle className="h-4 w-4 mr-2" />
          Pagamento confirmado! Verifique o Log de Webhook.
        </Badge>
      ) : (
        <Button
          onClick={handlePay}
          disabled={loading || !cardReady}
          className="w-full"
        >
          {loading ? "Processando..." : `Pagar ${formatBRL(amount)}`}
        </Button>
      )}

      {paymentStatus === "error" && (
        <Badge className="bg-red-600 text-white hover:bg-red-700 py-2 px-4 text-sm">
          <XCircle className="h-4 w-4 mr-2" />
          {errorMessage}
        </Badge>
      )}
    </div>
  );
}
