import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Tracker de cliques em links de campanhas WhatsApp.
 * 
 * URL format:
 *   GET /whatsapp-campaign-tracker?d=<destinatario_id>&r=<redirect_url_encoded>
 * 
 * Quando o destinatário clica no link do template, ele é redirecionado
 * para esta função que marca visitou_link=true e redireciona para a URL final.
 */

const FALLBACK_URL = "https://gestaoebd.com.br";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const destId = url.searchParams.get("d");
    const redirect = url.searchParams.get("r") || FALLBACK_URL;

    if (!destId) {
      return new Response(null, {
        status: 302,
        headers: { Location: redirect },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Marcar como visitou_link = true
    await supabase
      .from("whatsapp_campanha_destinatarios")
      .update({ visitou_link: true })
      .eq("id", destId);

    // Redirecionar para a URL final
    return new Response(null, {
      status: 302,
      headers: { Location: redirect },
    });
  } catch (error) {
    console.error("Erro no campaign tracker:", error);
    return new Response(null, {
      status: 302,
      headers: { Location: FALLBACK_URL },
    });
  }
});
