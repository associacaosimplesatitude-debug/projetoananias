import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { campanha_id, dry_run } = await req.json();

    if (!campanha_id) {
      return new Response(JSON.stringify({ error: "campanha_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count pending recipients
    const { count, error: countError } = await supabase
      .from("whatsapp_campanha_destinatarios")
      .select("*", { count: "exact", head: true })
      .eq("campanha_id", campanha_id)
      .eq("status_envio", "pendente");

    if (countError) throw countError;

    if (dry_run) {
      return new Response(
        JSON.stringify({ total: count || 0, dry_run: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call whatsapp-send-campaign
    const sendUrl = `${supabaseUrl}/functions/v1/whatsapp-send-campaign`;
    const sendRes = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      },
      body: JSON.stringify({ campanha_id }),
    });

    const sendData = await sendRes.json();

    if (!sendRes.ok) {
      return new Response(JSON.stringify({ error: sendData.error || "Erro no envio", details: sendData }), {
        status: sendRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ...sendData, total: count || 0, dry_run: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("disparar-campanha-revista error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
