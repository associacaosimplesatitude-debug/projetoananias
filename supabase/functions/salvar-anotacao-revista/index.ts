import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { whatsapp, revista_id, licao_id, pagina, texto } = await req.json();

    if (!whatsapp || !licao_id || pagina === undefined || pagina === null) {
      return new Response(
        JSON.stringify({ error: "whatsapp, licao_id e pagina são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Se texto vazio ou null: deletar
    if (!texto || texto.trim() === "") {
      await supabase
        .from("revista_anotacoes_publico")
        .delete()
        .eq("whatsapp", whatsapp)
        .eq("licao_id", licao_id)
        .eq("pagina", pagina);

      return new Response(
        JSON.stringify({ sucesso: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert
    const { error } = await supabase
      .from("revista_anotacoes_publico")
      .upsert(
        {
          whatsapp,
          revista_id: revista_id || null,
          licao_id,
          pagina,
          texto: texto.trim().substring(0, 500),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "whatsapp,licao_id,pagina" }
      );

    if (error) {
      console.error("Upsert error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ sucesso: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
