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
}

export default function StripeCardPaymentForm({ clientSecret, amount }: StripeCardPaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const cardRef = useRef<any>(null);
  const stripeRef = useRef<any>(null);
  const mountedRef = useRef(false);

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

      const stripe = window.Stripe(
        "pk_live_51TKJLCQqNlxyJH6pBaLgJEJaXLtV7LSfb2TcryYRZ4X2FjuAB0V0kcrAx9edW0UY9JY7KDzRhE8NDxDiyGzq0Xq00cHZcKE32"
      );
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

      const el = document.getElementById("stripe-card-element");
      if (el) {
        card.mount("#stripe-card-element");
        cardRef.current = card;

        card.on("ready", () => setCardReady(true));
        card.on("change", (event: any) => {
          if (event.error) {
            setErrorMessage(event.error.message);
          } else {
            setErrorMessage("");
          }
        });
      }
    };

    initStripe();

    return () => {
      if (cardRef.current) {
        try { cardRef.current.destroy(); } catch {}
      }
    };
  }, [clientSecret]);

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
        id="stripe-card-element"
        className="p-3 bg-white rounded-md border min-h-[44px]"
      />

      {errorMessage && paymentStatus !== "success" && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Cartão de teste: <span className="font-mono">4242 4242 4242 4242</span> — qualquer data futura — qualquer CVC
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
