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
    const { whatsapp } = await req.json();

    // Limpar número: só dígitos, sem 55 inicial
    const digitsOnly = String(whatsapp || "").replace(/\D/g, "");
    const numeroLimpo =
      digitsOnly.startsWith("55") && digitsOnly.length >= 12
        ? digitsOnly.slice(2)
        : digitsOnly;

    if (!numeroLimpo || numeroLimpo.length < 10) {
      return new Response(
        JSON.stringify({ erro: "numero_invalido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verificar se número tem licença ativa
    const { data: licenca } = await supabaseAdmin
      .from("revista_licencas_shopify")
      .select("id, nome_comprador")
      .eq("whatsapp", numeroLimpo)
      .eq("ativo", true)
      .maybeSingle();

    if (!licenca) {
      return new Response(
        JSON.stringify({ erro: "numero_nao_encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Gerar código de 4 dígitos
    const codigo = String(Math.floor(1000 + Math.random() * 9000));
    const expiraEm = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Salvar OTP
    await supabaseAdmin.from("revista_otp").insert({
      whatsapp: numeroLimpo,
      codigo,
      expira_em: expiraEm,
    });

    // Enviar WhatsApp com código
    await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp-message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          telefone: numeroLimpo,
          mensagem: `Seu codigo de acesso a revista e:\n\n*${codigo}*\n\nDigite este codigo na tela.\nEle expira em 10 minutos.\n\nNao compartilhe este codigo.`,
        }),
      }
    );

    return new Response(
      JSON.stringify({ sucesso: true }),
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
