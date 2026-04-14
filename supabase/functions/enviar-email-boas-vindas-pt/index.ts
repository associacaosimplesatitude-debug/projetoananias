import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clients } = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ erro: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const client of clients) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff">
          <div style="text-align:center;padding:20px 0">
            <h1 style="color:#1B3A5C;font-size:24px;margin:0">Central Gospel Editora</h1>
          </div>
          <h2 style="color:#1B3A5C;font-size:20px">Olá, ${client.nome}! 🎉</h2>
          <p style="font-size:16px;color:#333;line-height:1.6">
            Sua compra foi confirmada e seu acesso à <strong>revista digital</strong> já está disponível!
          </p>
          <div style="background:#f0f7ff;border-radius:8px;padding:16px;margin:20px 0">
            <p style="font-size:14px;color:#1B3A5C;margin:0 0 8px"><strong>📚 Produto(s):</strong></p>
            <p style="font-size:14px;color:#333;margin:0">${client.produtos}</p>
          </div>
          <div style="background:#e8f5e9;border-radius:8px;padding:16px;margin:20px 0">
            <p style="font-size:14px;color:#2e7d32;margin:0 0 8px"><strong>🔑 Como acessar:</strong></p>
            <ol style="font-size:14px;color:#333;line-height:1.8;margin:0;padding-left:20px">
              <li>Acesse: <a href="https://gestaoebd.lovable.app/revista/acesso" style="color:#1B3A5C;font-weight:bold">gestaoebd.lovable.app/revista/acesso</a></li>
              <li>Clique em <strong>"Prefiro acessar com meu email"</strong></li>
              <li>Digite o email: <strong>${client.email}</strong></li>
              <li>Você receberá um código de 4 dígitos neste email</li>
              <li>Digite o código e pronto! Boa leitura! 📖</li>
            </ol>
          </div>
          <div style="text-align:center;margin:30px 0">
            <a href="https://gestaoebd.lovable.app/revista/acesso" 
               style="background:#1B3A5C;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold;display:inline-block">
              Acessar minha revista agora
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:30px 0">
          <p style="font-size:12px;color:#999;text-align:center">
            Se tiver dúvidas, responda este email.<br>
            Central Gospel Editora — Revista Digital EBD
          </p>
        </div>
      `;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Gestão EBD <relatorios@painel.editoracentralgospel.com.br>",
            to: [client.email],
            subject: "📚 Sua revista digital está pronta! Veja como acessar",
            html,
          }),
        });
        const data = await res.json();
        results.push({ email: client.email, nome: client.nome, ok: res.ok, status: res.status, data });
      } catch (err) {
        results.push({ email: client.email, nome: client.nome, ok: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ erro: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
