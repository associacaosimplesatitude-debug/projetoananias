import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function buildWelcomeEmail(nome: string, codigo: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9f6f0;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
  <tr><td style="background:#1a1a2e;padding:30px;text-align:center;">
    <h1 style="color:#C9A84C;margin:0;font-size:24px;">Central Gospel</h1>
    <p style="color:#ffffff;margin:5px 0 0;font-size:14px;">Programa de Embaixadoras</p>
  </td></tr>
  <tr><td style="padding:30px;">
    <h2 style="color:#1a1a2e;margin:0 0 15px;">Bem-vinda, ${nome}! 🎉</h2>
    <p style="color:#333;line-height:1.6;">Estamos muito felizes em ter você no nosso Programa de Embaixadoras!</p>
    
    <div style="background:#f9f6f0;border:2px solid #C9A84C;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
      <p style="margin:0 0 5px;color:#666;font-size:14px;">Seu código exclusivo:</p>
      <p style="margin:0;color:#C9A84C;font-size:28px;font-weight:bold;letter-spacing:2px;">${codigo}</p>
    </div>
    
    <div style="background:#f0f7ff;border-radius:8px;padding:15px;margin:20px 0;">
      <p style="margin:0;color:#333;font-size:14px;">📎 Seu link personalizado:</p>
      <p style="margin:5px 0 0;"><a href="https://centralgospel.com.br?emb=${codigo}" style="color:#C9A84C;font-weight:bold;font-size:16px;">centralgospel.com.br?emb=${codigo}</a></p>
    </div>

    <p style="color:#333;line-height:1.6;"><strong>Como funciona:</strong> Compartilhe seu link com amigas, familiares e nas redes sociais. A cada venda realizada através do seu link, você ganha comissão!</p>

    <h3 style="color:#1a1a2e;margin:25px 0 10px;">💰 Tabela de Comissões</h3>
    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:10px 0;">
      <tr style="background:#1a1a2e;">
        <th style="color:#C9A84C;text-align:left;padding:10px;">Tier</th>
        <th style="color:#C9A84C;text-align:center;padding:10px;">Comissão</th>
        <th style="color:#C9A84C;text-align:right;padding:10px;">Volume</th>
      </tr>
      <tr style="background:#f9f6f0;">
        <td style="padding:10px;color:#333;">🥉 Iniciante</td>
        <td style="padding:10px;color:#333;text-align:center;font-weight:bold;">5%</td>
        <td style="padding:10px;color:#333;text-align:right;">até R$499</td>
      </tr>
      <tr>
        <td style="padding:10px;color:#333;">🥈 Ativa</td>
        <td style="padding:10px;color:#333;text-align:center;font-weight:bold;">8%</td>
        <td style="padding:10px;color:#333;text-align:right;">R$500 a R$1.499</td>
      </tr>
      <tr style="background:#f9f6f0;">
        <td style="padding:10px;color:#333;">🥇 Premium</td>
        <td style="padding:10px;color:#333;text-align:center;font-weight:bold;">12%</td>
        <td style="padding:10px;color:#333;text-align:right;">acima de R$1.500</td>
      </tr>
    </table>

    <div style="text-align:center;margin:30px 0;">
      <a href="https://gestaoebd.com.br/embaixadora/painel" style="display:inline-block;background:#C9A84C;color:#1a1a2e;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">Acessar meu painel</a>
    </div>
  </td></tr>
  <tr><td style="background:#1a1a2e;padding:20px;text-align:center;">
    <p style="color:#C9A84C;margin:0;font-size:14px;font-weight:bold;">Central Gospel</p>
    <p style="color:#888;margin:5px 0 0;font-size:12px;">Programa de Embaixadoras</p>
  </td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { embaixadora_id } = await req.json();
    if (!embaixadora_id) throw new Error("embaixadora_id required");

    // Fetch ambassador data
    const { data: emb, error: embErr } = await supabase
      .from("embaixadoras")
      .select("nome, email, codigo_unico")
      .eq("id", embaixadora_id)
      .single();

    if (embErr || !emb) throw new Error("Embaixadora not found");

    const now = new Date();
    const schedules = [
      { offset: 0, templateId: "embaixadora_boas_vindas", assunto: "Bem-vinda ao Programa de Embaixadoras Central Gospel! 🎉" },
      { offset: 1, templateId: "embaixadora_beneficios", assunto: "Você sabia que pode ganhar até 12% de comissão? 💰" },
      { offset: 3, templateId: "embaixadora_primeiro_passo", assunto: "Seu primeiro passo como Embaixadora Central Gospel 👣" },
      { offset: 7, templateId: "embaixadora_dicas", assunto: "3 dicas para divulgar e aumentar suas comissões 📱" },
      { offset: 14, templateId: "embaixadora_resultado", assunto: "Como estão suas vendas? Veja seu relatório! 📊" },
    ];

    // Insert all 5 email logs
    const emailLogs = schedules.map((s) => {
      const scheduledAt = new Date(now.getTime() + s.offset * 24 * 60 * 60 * 1000);
      return {
        destinatario: emb.email,
        assunto: s.assunto,
        template_id: s.templateId,
        status: s.offset === 0 ? "enviado" : "pendente",
        tipo_envio: "embaixadora_sequence",
        dados_enviados: { embaixadora_id, nome: emb.nome, codigo_unico: emb.codigo_unico, scheduled_at: scheduledAt.toISOString() },
      };
    });

    const { error: logErr } = await supabase.from("ebd_email_logs").insert(emailLogs);
    if (logErr) console.error("Error inserting email logs:", logErr);

    // Send Email 1 immediately
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Central Gospel <noreply@painel.editoracentralgospel.com.br>",
        to: [emb.email],
        subject: schedules[0].assunto,
        html: buildWelcomeEmail(emb.nome, emb.codigo_unico),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Resend error:", errBody);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
