import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyRevistaToken } from "../_shared/revista-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-revista-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // A identidade vem SEMPRE do token assinado, nunca do corpo da requisição.
    const session = await verifyRevistaToken(req.headers.get("x-revista-token"));
    if (!session) {
      return new Response(JSON.stringify({ error: "sessao_invalida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const whatsapp = session.whatsapp;

    const { revista_id, licao_id, licao_numero, licao_titulo, pagina_atual, concluida } = await req.json();

    if (!revista_id) {
      return new Response(JSON.stringify({ error: "revista_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase
      .from("revista_progresso_publico")
      .upsert(
        {
          whatsapp,
          revista_id,
          licao_id: licao_id || null,
          licao_numero: licao_numero ?? null,
          licao_titulo: licao_titulo || null,
          pagina_atual: pagina_atual ?? 0,
          concluida: concluida ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "whatsapp,revista_id" }
      );

    if (error) throw error;

    return new Response(JSON.stringify({ sucesso: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
