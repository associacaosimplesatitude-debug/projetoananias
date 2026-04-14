import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { whatsapp, email, codigo } = body;

    // Determine identifier: email or phone
    const isEmailMode = !!email && !whatsapp;
    let identificador: string;

    if (isEmailMode) {
      identificador = String(email).trim().toLowerCase();
    } else {
      const digitsOnly = String(whatsapp || "").replace(/\D/g, "");
      identificador =
        digitsOnly.startsWith("55") && digitsOnly.length >= 12
          ? digitsOnly.slice(2)
          : digitsOnly;
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar OTP válido
    const { data: otp } = await supabaseAdmin
      .from("revista_otp")
      .select("id")
      .eq("whatsapp", identificador)
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

    // Buscar todas as licenças ativas
    let { data: licencas } = await supabaseAdmin
      .from("revista_licencas_shopify")
      .select(
        `
        id,
        revista_id,
        nome_comprador,
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
      `
      )
      .eq("whatsapp", identificador)
      .eq("ativo", true);

    // If email mode and no results by whatsapp field, try email field
    if (isEmailMode && (!licencas || licencas.length === 0)) {
      const { data: emailLicencas } = await supabaseAdmin
        .from("revista_licencas_shopify")
        .select(
          `
          id,
          revista_id,
          nome_comprador,
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
        `
        )
        .eq("email", identificador)
        .eq("ativo", true);

      if (emailLicencas && emailLicencas.length > 0) {
        licencas = emailLicencas;
        identificador = emailLicencas[0].whatsapp || identificador;
      }
    }

    const agora = new Date().toISOString();

    // Registrar primeiro acesso (apenas se ainda não tiver)
    await supabaseAdmin
      .from("revista_licencas_shopify")
      .update({ primeiro_acesso_em: agora })
      .eq("whatsapp", identificador)
      .eq("ativo", true)
      .is("primeiro_acesso_em", null);

    // Atualizar ultimo_acesso_em para TODAS as licenças ativas
    await supabaseAdmin
      .from("revista_licencas_shopify")
      .update({ ultimo_acesso_em: agora })
      .eq("whatsapp", identificador)
      .eq("ativo", true);

    // Gerar token de sessão (válido por 24h)
    const token = btoa(
      JSON.stringify({
        whatsapp: identificador,
        exp: Date.now() + 86400000,
        licencas: licencas?.map((l: any) => l.revista_id),
      })
    );

    const versaoPreferida = licencas?.[0]?.versao_preferida || "cg_digital";

    return new Response(
      JSON.stringify({ sucesso: true, token, licencas, versao_preferida: versaoPreferida }),
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
