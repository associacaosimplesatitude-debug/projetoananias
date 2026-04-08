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
    const { whatsapp, versao } = await req.json();
    if (!whatsapp || !["cg_digital", "leitor_cg"].includes(versao)) {
      return new Response(JSON.stringify({ sucesso: false, erro: "Dados inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normalizePhone(whatsapp);
    console.log("Atualizando:", phone, "para:", versao);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: updateData, error: updateError, count } = await supabase
      .from("revista_licencas_shopify")
      .update({ versao_preferida: versao })
      .eq("whatsapp", phone)
      .eq("ativo", true)
      .select("id");

    console.log("Resultado update:", { rows: updateData?.length || 0, error: updateError?.message || null });

    return new Response(JSON.stringify({ sucesso: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
