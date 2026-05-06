import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PHONE_NUMBER_ID = "1050166738160490";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    console.log("[whatsapp-meta-otp] body:", body);
    const action = body?.action as "request" | "verify";
    const code = body?.code as string | undefined;

    // Resolve token: prefer env META_WHATSAPP_TOKEN, fallback to system_settings.whatsapp_access_token
    let token = Deno.env.get("META_WHATSAPP_TOKEN") || "";
    if (!token) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "whatsapp_access_token")
        .maybeSingle();
      token = data?.value || "";
    }

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token Meta não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "request") {
      const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/request_code`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code_method: "SMS", language: "pt_BR" }),
      });
      const data = await res.json();
      console.log("[whatsapp-meta-otp] request_code response:", res.status, data);
      return new Response(
        JSON.stringify({ success: res.ok, status: res.status, data }),
        { status: res.ok ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "verify") {
      if (!code) {
        return new Response(
          JSON.stringify({ success: false, error: "Código é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/verify_code`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      console.log("[whatsapp-meta-otp] verify_code response:", res.status, data);
      return new Response(
        JSON.stringify({ success: res.ok, status: res.status, data }),
        { status: res.ok ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "action inválida (use 'request' ou 'verify')" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[whatsapp-meta-otp] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
