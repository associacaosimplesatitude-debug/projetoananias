import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { whatsapp } = await req.json();
    if (!whatsapp) {
      return new Response(JSON.stringify({ encontrado: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normalizePhone(whatsapp);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data } = await supabase
      .from("revista_licencas_shopify")
      .select("nome_comprador, versao_preferida")
      .eq("whatsapp", phone)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    if (!data) {
      return new Response(JSON.stringify({ encontrado: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = (data.nome_comprador || "").split(" ")[0] || "";

    return new Response(
      JSON.stringify({
        encontrado: true,
        nome: firstName,
        versao_preferida: data.versao_preferida || "cg_digital",
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
