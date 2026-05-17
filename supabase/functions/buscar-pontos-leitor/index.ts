import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { whatsapp } = await req.json();
    if (!whatsapp || typeof whatsapp !== "string") {
      return new Response(JSON.stringify({ error: "whatsapp obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const identifiers = new Set<string>([whatsapp.trim()]);

    // Descobrir o e-mail associado a esse identificador (telefone ou e-mail-fallback)
    // e juntar todos os identificadores do mesmo comprador.
    try {
      const { data: licByIdent } = await supabase
        .from("revista_licencas_shopify")
        .select("email")
        .eq("whatsapp", whatsapp.trim());

      const emails = Array.from(
        new Set(
          (licByIdent || [])
            .map((r: any) => (typeof r.email === "string" ? r.email.trim().toLowerCase() : ""))
            .filter((e: string) => e.length > 0)
        )
      );

      if (emails.length > 0) {
        const { data: licByEmail } = await supabase
          .from("revista_licencas_shopify")
          .select("whatsapp, email")
          .in("email", emails);

        (licByEmail || []).forEach((r: any) => {
          if (typeof r.whatsapp === "string" && r.whatsapp.trim().length > 0) {
            identifiers.add(r.whatsapp.trim());
          }
          // o próprio e-mail também pode ter sido usado como identificador (fallback)
          if (typeof r.email === "string" && r.email.trim().length > 0) {
            identifiers.add(r.email.trim().toLowerCase());
          }
        });
      }
    } catch (e) {
      console.warn("[buscar-pontos-leitor] falha ao unificar identificadores:", e);
    }

    const idList = Array.from(identifiers);
    const { data, error } = await supabase
      .from("revista_ranking_publico")
      .select("total_pontos, total_quizzes")
      .in("whatsapp", idList);

    if (error) throw error;

    const total_pontos = (data || []).reduce((s: number, r: any) => s + (r.total_pontos || 0), 0);
    const total_quizzes = (data || []).reduce((s: number, r: any) => s + (r.total_quizzes || 0), 0);

    return new Response(JSON.stringify({ total_pontos, total_quizzes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
