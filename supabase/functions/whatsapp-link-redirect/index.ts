// Public redirect endpoint for WhatsApp campaign URL button clicks.
// Meta template button base URL should be:
//   https://<project>.supabase.co/functions/v1/whatsapp-link-redirect?t=
// Meta appends the {{1}} suffix (the campaign_links.token) to the base URL.
//
// Flow:
//  1. Look up campaign_links by token
//  2. Mark destinatario.visitou_link + increment cliques_botoes JSONB counter
//  3. Insert campaign_events row (link_clicked)
//  4. 302 to destination URL (from whatsapp_templates.botao_url_destino,
//     falling back to https://centralgospel.com.br)

import { createClient } from "npm:@supabase/supabase-js@2";

const FALLBACK_URL = "https://centralgospel.com.br";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") || url.searchParams.get("token");

  // Any failure path still redirects the user — we never want to break their click.
  const safeRedirect = (to: string) =>
    new Response(null, { status: 302, headers: { Location: to } });

  try {
    if (!token) return safeRedirect(FALLBACK_URL);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Locate the per-destinatario link
    const { data: link } = await supabase
      .from("campaign_links")
      .select("id, campaign_id, customer_phone")
      .eq("token", token)
      .maybeSingle();

    // Resolve destination URL from the campaign's template
    let destinoUrl = FALLBACK_URL;
    if (link?.campaign_id) {
      const { data: camp } = await supabase
        .from("whatsapp_campanhas")
        .select("template_nome")
        .eq("id", link.campaign_id)
        .maybeSingle();

      if (camp?.template_nome) {
        const { data: tpl } = await supabase
          .from("whatsapp_templates")
          .select("botao_url_destino")
          .eq("nome", camp.template_nome)
          .maybeSingle();
        if (tpl?.botao_url_destino) destinoUrl = tpl.botao_url_destino;
      }
    }

    if (!link) return safeRedirect(destinoUrl);

    const nowIso = new Date().toISOString();
    const userAgent = req.headers.get("user-agent") || null;
    const referer = req.headers.get("referer") || null;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    // Update campaign_links access counters (existing columns)
    await supabase
      .from("campaign_links")
      .update({
        first_accessed_at: nowIso, // idempotent enough for reporting; column may already be set
        last_accessed_at: nowIso,
      })
      .eq("id", link.id)
      .is("first_accessed_at", null);

    await supabase
      .from("campaign_links")
      .update({ last_accessed_at: nowIso })
      .eq("id", link.id);

    // Record event for tracking dashboard
    await supabase.from("campaign_events").insert({
      link_id: link.id,
      campaign_id: link.campaign_id,
      event_type: "link_clicked",
      event_data: { user_agent: userAgent, referer, ip },
    });

    // Match destinatario by campaign + phone (link stores customer_phone)
    if (link.customer_phone && link.campaign_id) {
      const digits = String(link.customer_phone).replace(/\D/g, "");

      const { data: dest } = await supabase
        .from("whatsapp_campanha_destinatarios")
        .select("id, cliques_botoes, visitou_link")
        .eq("campanha_id", link.campaign_id)
        .eq("telefone", digits)
        .maybeSingle();

      if (dest) {
        const cliques = (dest.cliques_botoes as any) || {};
        const currentCount = Number(cliques.count || 0);
        const newCliques = {
          ...cliques,
          count: currentCount + 1,
          last_click_at: nowIso,
          first_click_at: cliques.first_click_at || nowIso,
        };

        await supabase
          .from("whatsapp_campanha_destinatarios")
          .update({
            visitou_link: true,
            cliques_botoes: newCliques,
          })
          .eq("id", dest.id);
      }
    }

    return safeRedirect(destinoUrl);
  } catch (err) {
    console.error("whatsapp-link-redirect error:", err);
    return safeRedirect(FALLBACK_URL);
  }
});
