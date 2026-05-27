import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SELECT = `
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
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const whatsappRaw = typeof body?.whatsapp === "string" ? body.whatsapp : "";
    const emailRaw = typeof body?.email === "string" ? body.email : "";

    const digitsOnly = whatsappRaw.replace(/\D/g, "");
    const whatsapp =
      digitsOnly.startsWith("55") && digitsOnly.length >= 12
        ? digitsOnly.slice(2)
        : digitsOnly;
    const email = emailRaw.trim().toLowerCase();

    if (!whatsapp && !email) {
      return new Response(
        JSON.stringify({ erro: "identificador_obrigatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let licencas: any[] = [];

    if (whatsapp) {
      const { data } = await supabaseAdmin
        .from("revista_licencas_shopify")
        .select(SELECT)
        .eq("whatsapp", whatsapp)
        .eq("ativo", true);
      if (data) licencas = data;
    }

    if (licencas.length === 0 && email) {
      const { data } = await supabaseAdmin
        .from("revista_licencas_shopify")
        .select(SELECT)
        .eq("email", email)
        .eq("ativo", true);
      if (data) licencas = data;
    }

    return new Response(
      JSON.stringify({ sucesso: true, licencas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ erro: "erro_interno", detalhe: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
