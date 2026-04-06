import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { whatsapp, codigo } = await req.json();

    const digitsOnly = String(whatsapp || "").replace(/\D/g, "");
    const numeroLimpo =
      digitsOnly.startsWith("55") && digitsOnly.length >= 12
        ? digitsOnly.slice(2)
        : digitsOnly;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar OTP válido
    const { data: otp } = await supabaseAdmin
      .from("revista_otp")
      .select("id")
      .eq("whatsapp", numeroLimpo)
      .eq("codigo", codigo)
      .eq("usado", false)
      .gt("expira_em", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) {
      return new Response(
        JSON.stringify({ erro: "codigo_invalido" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Invalidar OTP usado
    await supabaseAdmin
      .from("revista_otp")
      .update({ usado: true })
      .eq("id", otp.id);

    // Buscar todas as licenças ativas com dados da revista
    const { data: licencas } = await supabaseAdmin
      .from("revista_licencas_shopify")
      .select(
        `
        id,
        revista_id,
        nome_comprador,
        expira_em,
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
      `
      )
      .eq("whatsapp", numeroLimpo)
      .eq("ativo", true);

    // Registrar primeiro acesso (apenas se ainda não tiver)
    await supabaseAdmin
      .from("revista_licencas_shopify")
      .update({ primeiro_acesso_em: new Date().toISOString() })
      .eq("whatsapp", numeroLimpo)
      .eq("ativo", true)
      .is("primeiro_acesso_em", null);

    // Gerar token de sessão (válido por 24h)
    const token = btoa(
      JSON.stringify({
        whatsapp: numeroLimpo,
        exp: Date.now() + 86400000,
        licencas: licencas?.map((l: any) => l.revista_id),
      })
    );

    return new Response(
      JSON.stringify({ sucesso: true, token, licencas }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        erro: "erro_interno",
        detalhe: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
