import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Tracker de cliques/visitas em links de campanhas WhatsApp.
 * 
 * Modos de operação:
 * 
 * 1) Redirect com ID do destinatário:
 *    GET ?d=<destinatario_id>&r=<redirect_url_encoded>
 * 
 * 2) Registro de visita por telefone (chamado pela landing page):
 *    POST { telefone: "5521999..." }
 *    → Busca destinatários com esse telefone em campanhas ativas e marca visitou_link=true
 * 
 * 3) Registro de visita geral (sem identificação):
 *    POST { page: "/oferta-ebd" }
 *    → Incrementa contador de visitas na campanha ativa
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_URL = "https://gestaoebd.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mode 1: GET redirect with destinatario ID
    if (req.method === "GET") {
      const url = new URL(req.url);
      const destId = url.searchParams.get("d");
      const redirect = url.searchParams.get("r") || FALLBACK_URL;

      if (destId) {
        await supabase
          .from("whatsapp_campanha_destinatarios")
          .update({ visitou_link: true })
          .eq("id", destId);
      }

      return new Response(null, {
        status: 302,
        headers: { Location: redirect },
      });
    }

    // Mode 2 & 3: POST from landing page
    if (req.method === "POST") {
      const body = await req.json();
      const { telefone, page } = body;

      if (telefone) {
        // Normalize phone
        let phone = (telefone || "").replace(/\D/g, "");
        if (phone.startsWith("0")) phone = phone.substring(1);
        if (!phone.startsWith("55")) phone = "55" + phone;

        // Also try without country code
        const phoneWithout55 = phone.startsWith("55") ? phone.substring(2) : phone;

        // Find matching recipients in active/sent campaigns (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: destinatarios } = await supabase
          .from("whatsapp_campanha_destinatarios")
          .select("id, telefone")
          .eq("visitou_link", false)
          .eq("status_envio", "enviado")
          .gte("enviado_em", thirtyDaysAgo.toISOString());

        // Match by phone (comparing normalized numbers)
        const matched = (destinatarios || []).filter((d: any) => {
          const dPhone = (d.telefone || "").replace(/\D/g, "");
          return dPhone === phone || dPhone === phoneWithout55 || 
                 dPhone.endsWith(phoneWithout55) || phone.endsWith(dPhone);
        });

        if (matched.length > 0) {
          const ids = matched.map((d: any) => d.id);
          await supabase
            .from("whatsapp_campanha_destinatarios")
            .update({ visitou_link: true })
            .in("id", ids);

          console.log(`Marcou ${matched.length} destinatário(s) como visitou_link via telefone ${phone}`);
        }

        return new Response(
          JSON.stringify({ success: true, matched: matched.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mode 3: General page visit tracking
      if (page) {
        // Find active campaigns and increment visit counter
        const { data: campanhas } = await supabase
          .from("whatsapp_campanhas")
          .select("id, total_visitas_pagina")
          .eq("status", "enviada")
          .order("created_at", { ascending: false })
          .limit(5);

        for (const c of (campanhas || [])) {
          await supabase
            .from("whatsapp_campanhas")
            .update({ total_visitas_pagina: (c.total_visitas_pagina || 0) + 1 })
            .eq("id", c.id);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "telefone ou page obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(null, { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error("Erro no campaign tracker:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
