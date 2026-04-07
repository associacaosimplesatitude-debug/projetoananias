import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let revistaId: string | null = null;
    try {
      const body = await req.json();
      revistaId = body?.revista_id || null;
    } catch { /* no body */ }

    let query = supabase
      .from("revistas_digitais")
      .select("video_celular_cg_digital, video_desktop_cg_digital, video_celular_leitor, video_desktop_leitor")
      .not("video_celular_cg_digital", "is", null)
      .limit(1);

    if (revistaId) {
      query = query.eq("id", revistaId);
    }

    const { data } = await query.maybeSingle();

    return new Response(
      JSON.stringify({
        video_celular_cg_digital: data?.video_celular_cg_digital || null,
        video_desktop_cg_digital: data?.video_desktop_cg_digital || null,
        video_celular_leitor: data?.video_celular_leitor || null,
        video_desktop_leitor: data?.video_desktop_leitor || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
