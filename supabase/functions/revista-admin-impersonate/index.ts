import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate caller has superadmin role
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: isSuper } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "superadmin",
    });
    if (isSuper !== true) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { licenca_id, whatsapp: whatsappInput } = body || {};

    let whatsapp = "";
    if (licenca_id) {
      const { data: lic, error: licErr } = await admin
        .from("revista_licencas_shopify")
        .select("whatsapp")
        .eq("id", licenca_id)
        .maybeSingle();
      if (licErr || !lic) {
        return new Response(JSON.stringify({ error: "licenca_nao_encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      whatsapp = lic.whatsapp || "";
    } else if (whatsappInput) {
      const digits = String(whatsappInput).replace(/\D/g, "");
      whatsapp = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
    }

    if (!whatsapp) {
      return new Response(JSON.stringify({ error: "whatsapp_obrigatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: licencas } = await admin
      .from("revista_licencas_shopify")
      .select(`
        id,
        revista_id,
        nome_comprador,
        whatsapp,
        expira_em,
        versao_preferida,
        revistas_digitais (
          id,
          titulo,
          capa_url,
          total_licoes,
          tipo,
          pdf_url,
          leitura_continua,
          tipo_conteudo
        )
      `)
      .eq("whatsapp", whatsapp)
      .eq("ativo", true);

    if (!licencas || licencas.length === 0) {
      return new Response(JSON.stringify({ error: "sem_licencas_ativas" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sessionToken = btoa(
      JSON.stringify({
        whatsapp,
        exp: Date.now() + 86400000,
        licencas: licencas.map((l: any) => l.revista_id),
        impersonated_by: userData.user.email || userData.user.id,
      })
    );

    const versaoPreferida = licencas[0]?.versao_preferida || "cg_digital";

    return new Response(
      JSON.stringify({
        sucesso: true,
        token: sessionToken,
        licencas,
        versao_preferida: versaoPreferida,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "erro_interno", detalhe: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
