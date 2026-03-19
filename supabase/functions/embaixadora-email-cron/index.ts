import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function buildEmail2(nome: string, codigo: string): string {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9f6f0;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
  <tr><td style="background:#1a1a2e;padding:30px;text-align:center;">
    <h1 style="color:#C9A84C;margin:0;font-size:24px;">Central Gospel</h1>
  </td></tr>
  <tr><td style="padding:30px;">
    <h2 style="color:#1a1a2e;">Olá, ${nome}! 💰</h2>
    <p style="color:#333;line-height:1.6;">Você sabia que como Embaixadora pode ganhar até <strong>12% de comissão</strong> em cada venda?</p>
    <h3 style="color:#1a1a2e;">Seus 3 grandes benefícios:</h3>
    <div style="background:#f9f6f0;border-radius:8px;padding:15px;margin:10px 0;">
      <p style="margin:0 0 10px;"><strong>💰 Comissões</strong> — De 5% a 12% dependendo do seu volume de vendas</p>
      <p style="margin:0 0 10px;"><strong>📱 Painel Exclusivo</strong> — Acompanhe cliques, vendas e ganhos em tempo real</p>
      <p style="margin:0;"><strong>🎁 Material Pronto</strong> — Imagens e textos prontos para WhatsApp e Instagram</p>
    </div>
    <div style="text-align:center;margin:30px 0;">
      <a href="https://gestaoebd.com.br/embaixadora/painel" style="display:inline-block;background:#C9A84C;color:#1a1a2e;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Ver meu painel</a>
    </div>
  </td></tr>
  <tr><td style="background:#1a1a2e;padding:20px;text-align:center;"><p style="color:#C9A84C;margin:0;font-size:14px;">Central Gospel — Programa de Embaixadoras</p></td></tr>
</table></body></html>`;
}

function buildEmail3(nome: string, codigo: string): string {
  const msg = `Oi! Conhece a Central Gospel? Eles têm materiais incríveis para EBD. Dá uma olhada: centralgospel.com.br?emb=${codigo}`;
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9f6f0;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
  <tr><td style="background:#1a1a2e;padding:30px;text-align:center;">
    <h1 style="color:#C9A84C;margin:0;font-size:24px;">Central Gospel</h1>
  </td></tr>
  <tr><td style="padding:30px;">
    <h2 style="color:#1a1a2e;">Seu primeiro passo, ${nome}! 👣</h2>
    <p style="color:#333;line-height:1.6;">Vamos começar? É muito simples:</p>
    <ol style="color:#333;line-height:1.8;">
      <li>Copie a mensagem abaixo</li>
      <li>Envie para <strong>5 amigas</strong> no WhatsApp</li>
      <li>Pronto! Cada compra feita pelo seu link gera comissão 💰</li>
    </ol>
    <div style="background:#e8f5e9;border:1px solid #4caf50;border-radius:8px;padding:15px;margin:20px 0;">
      <p style="margin:0 0 5px;color:#2e7d32;font-size:12px;font-weight:bold;">📋 MENSAGEM PRONTA — Copie e cole:</p>
      <p style="margin:0;color:#333;font-style:italic;line-height:1.6;">"${msg}"</p>
    </div>
    <div style="text-align:center;margin:30px 0;">
      <a href="https://gestaoebd.com.br/embaixadora/painel" style="display:inline-block;background:#C9A84C;color:#1a1a2e;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Copiar minha mensagem</a>
    </div>
  </td></tr>
  <tr><td style="background:#1a1a2e;padding:20px;text-align:center;"><p style="color:#C9A84C;margin:0;font-size:14px;">Central Gospel — Programa de Embaixadoras</p></td></tr>
</table></body></html>`;
}

function buildEmail4(nome: string): string {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9f6f0;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
  <tr><td style="background:#1a1a2e;padding:30px;text-align:center;">
    <h1 style="color:#C9A84C;margin:0;font-size:24px;">Central Gospel</h1>
  </td></tr>
  <tr><td style="padding:30px;">
    <h2 style="color:#1a1a2e;">3 dicas poderosas, ${nome}! 📱</h2>
    <p style="color:#333;line-height:1.6;">Use estas estratégias para aumentar suas comissões:</p>
    <div style="margin:15px 0;">
      <div style="background:#f9f6f0;border-left:4px solid #C9A84C;padding:15px;margin:10px 0;border-radius:0 8px 8px 0;">
        <p style="margin:0;"><strong>Dica 1: Status do WhatsApp</strong></p>
        <p style="margin:5px 0 0;color:#666;">Poste seu link no status — seus contatos vão ver e clicar!</p>
      </div>
      <div style="background:#f9f6f0;border-left:4px solid #C9A84C;padding:15px;margin:10px 0;border-radius:0 8px 8px 0;">
        <p style="margin:0;"><strong>Dica 2: Grupos de Igreja</strong></p>
        <p style="margin:5px 0 0;color:#666;">Compartilhe nos grupos da igreja com uma recomendação pessoal.</p>
      </div>
      <div style="background:#f9f6f0;border-left:4px solid #C9A84C;padding:15px;margin:10px 0;border-radius:0 8px 8px 0;">
        <p style="margin:0;"><strong>Dica 3: Instagram</strong></p>
        <p style="margin:5px 0 0;color:#666;">Use a hashtag <strong>#CentralGospel</strong> nos seus posts e stories.</p>
      </div>
    </div>
    <div style="text-align:center;margin:30px 0;">
      <a href="https://gestaoebd.com.br/embaixadora/painel" style="display:inline-block;background:#C9A84C;color:#1a1a2e;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Acessar materiais de divulgação</a>
    </div>
  </td></tr>
  <tr><td style="background:#1a1a2e;padding:20px;text-align:center;"><p style="color:#C9A84C;margin:0;font-size:14px;">Central Gospel — Programa de Embaixadoras</p></td></tr>
</table></body></html>`;
}

function buildEmail5(nome: string): string {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9f6f0;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
  <tr><td style="background:#1a1a2e;padding:30px;text-align:center;">
    <h1 style="color:#C9A84C;margin:0;font-size:24px;">Central Gospel</h1>
  </td></tr>
  <tr><td style="padding:30px;">
    <h2 style="color:#1a1a2e;">Como estão suas vendas, ${nome}? 📊</h2>
    <p style="color:#333;line-height:1.6;">Já se passaram 2 semanas desde que você se tornou Embaixadora! Vamos ver como está o seu desempenho?</p>
    <div style="background:#f9f6f0;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 10px;color:#333;font-weight:bold;">🏆 Lembre-se dos tiers:</p>
      <p style="margin:0 0 5px;color:#333;">🥉 <strong>Iniciante (5%)</strong> — até R$499 em vendas</p>
      <p style="margin:0 0 5px;color:#333;">🥈 <strong>Ativa (8%)</strong> — R$500 a R$1.499</p>
      <p style="margin:0;color:#333;">🥇 <strong>Premium (12%)</strong> — acima de R$1.500</p>
    </div>
    <p style="color:#333;line-height:1.6;">Acesse seu painel para ver seus cliques, vendas e comissões acumuladas. Continue compartilhando seu link para subir de nível!</p>
    <div style="text-align:center;margin:30px 0;">
      <a href="https://gestaoebd.com.br/embaixadora/painel" style="display:inline-block;background:#C9A84C;color:#1a1a2e;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Ver meu painel agora</a>
    </div>
  </td></tr>
  <tr><td style="background:#1a1a2e;padding:20px;text-align:center;"><p style="color:#C9A84C;margin:0;font-size:14px;">Central Gospel — Programa de Embaixadoras</p></td></tr>
</table></body></html>`;
}

const templateBuilders: Record<string, (nome: string, codigo: string) => string> = {
  embaixadora_beneficios: buildEmail2,
  embaixadora_primeiro_passo: buildEmail3,
  embaixadora_dicas: (nome) => buildEmail4(nome),
  embaixadora_resultado: (nome) => buildEmail5(nome),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pending emails that are due
    const { data: pendingEmails, error: fetchErr } = await supabase
      .from("ebd_email_logs")
      .select("*")
      .is("data_abertura", null)
      .eq("status", "pendente")
      .like("template_id", "embaixadora_%")
      .limit(50);

    if (fetchErr) throw new Error(`Fetch error: ${fetchErr.message}`);
    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter by scheduled_at from dados_enviados
    const now = new Date();
    const dueEmails = pendingEmails.filter((e) => {
      const scheduledAt = e.dados_enviados?.scheduled_at;
      if (!scheduledAt) return true;
      return new Date(scheduledAt) <= now;
    });

    let sent = 0;

    for (const emailLog of dueEmails) {
      const templateId = emailLog.template_id;
      const builder = templateBuilders[templateId];
      if (!builder) continue;

      const nome = emailLog.dados_enviados?.nome || "Embaixadora";
      const codigo = emailLog.dados_enviados?.codigo_unico || "";

      const html = builder(nome, codigo);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Central Gospel <noreply@notify.gestaoebd.com.br>",
          to: [emailLog.destinatario],
          subject: emailLog.assunto,
          html,
        }),
      });

      if (res.ok) {
        await supabase
          .from("ebd_email_logs")
          .update({ status: "enviado", data_abertura: new Date().toISOString() })
          .eq("id", emailLog.id);
        sent++;
      } else {
        const errBody = await res.text();
        console.error(`Failed to send email ${emailLog.id}:`, errBody);
        await supabase
          .from("ebd_email_logs")
          .update({ status: "erro", erro: errBody.slice(0, 500) })
          .eq("id", emailLog.id);
      }
    }

    return new Response(JSON.stringify({ sent }), {
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
