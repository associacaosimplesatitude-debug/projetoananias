import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function RegistrarWebhook() {
  const [result, setResult] = useState<string>("Registrando webhook...");

  useEffect(() => {
    supabase.functions
      .invoke("shopify-register-webhook", { body: { topic: "orders/paid" } })
      .then(({ data, error }) => {
        setResult(JSON.stringify(error || data, null, 2));
      })
      .catch((err) => {
        setResult(JSON.stringify({ error: err.message }, null, 2));
      });
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold mb-4">Registro de Webhook</h1>
      <pre className="bg-muted p-6 rounded-lg text-sm whitespace-pre-wrap break-all">
        {result}
      </pre>
    </div>
  );
}
