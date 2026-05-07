import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REVISTA_PROFESSOR_ID = "3a9fbd84-cad5-4c41-b0cb-a271109df565";
const INFOGRAFICO_ID = "30274872-b3c0-46eb-ae21-b6a52962b453";
const URL_ACESSO = "https://gestaoebd.com.br/revista/acesso";

function normalizeForMeta(t: string): string {
  const d = (t || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55")) return d;
  return "55" + d;
}
function whatsappLocal(t: string): string {
  const d = (t || "").replace(/\D/g, "");
  return d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
}

async function sendText(phoneId: string, token: string, to: string, text: string) {
  const res = await fetch(`https://graph.facebook.com/v23.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Meta: ${JSON.stringify(j)}`);
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let cliente_id: string | null = null;
  let ultRespId: string | null = null;

  async function gravarErro(msg: string) {
    console.error("[liberar-presente] ERRO:", msg);
    if (!ultRespId) return;
    try {
      await supabase.from("retencao_respostas")
        .update({ licenca_erro: msg.slice(0, 500) })
        .eq("id", ultRespId);
    } catch (e) { console.error("falha gravar licenca_erro", e); }
  }

  try {
    const body = await req.json();
    cliente_id = body.cliente_id;
    const { telefone, nome, email, vendedor_nome } = body;

    if (!cliente_id || !telefone) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: corsHeaders });
    }

    // Buscar último registro 'aceitar_presente' p/ rastrear erro
    const { data: ultResp } = await supabase
      .from("retencao_respostas")
      .select("id, licenca_concedida_em")
      .eq("cliente_id", cliente_id)
      .eq("tipo", "aceitar_presente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ultResp) ultRespId = ultResp.id;

    // Idempotência
    if (ultResp?.licenca_concedida_em) {
      return new Response(JSON.stringify({ skipped: true, reason: "ja liberado" }), { headers: corsHeaders });
    }

    const wLocal = whatsappLocal(telefone);
    const wMeta = normalizeForMeta(telefone);
    const emailFinal = email && email.includes("@") ? email : `${wLocal}@gestaoebd.com.br`;
    const nomeOk = nome || "Cliente";

    // ====== INSERT DIRETO (service role) — sem chamar admin function ======
    async function criarLicencaDireto(revistaId: string) {
      // Verificar se já existe
      const { data: exist } = await supabase
        .from("revista_licencas_shopify")
        .select("id")
        .eq("whatsapp", wLocal)
        .eq("revista_id", revistaId)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (exist) return exist.id;

      const { data: ins, error } = await supabase
        .from("revista_licencas_shopify")
        .insert({
          whatsapp: wLocal,
          nome_comprador: nomeOk,
          email: emailFinal,
          revista_id: revistaId,
          expira_em: null,
          ativo: true,
          origem: "presente_campanha_retencao",
        })
        .select("id")
        .single();
      if (error) throw new Error(`insert revista_id=${revistaId}: ${error.message}`);
      return ins.id;
    }

    const licProfessorId = await criarLicencaDireto(REVISTA_PROFESSOR_ID);
    await criarLicencaDireto(INFOGRAFICO_ID);

    // Marcar concedida (antes dos efeitos colaterais — idempotência forte)
    if (ultRespId) {
      await supabase.from("retencao_respostas").update({
        licenca_concedida_em: new Date().toISOString(),
        licenca_revista_id: licProfessorId,
        licenca_erro: null,
      }).eq("id", ultRespId);
    }

    // ====== Efeitos colaterais (replicando ação 'resend' do admin) ======
    const errosEC: string[] = [];

    // Email via Resend
    if (emailFinal && emailFinal.includes("@")) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Central Gospel <relatorios@painel.editoracentralgospel.com.br>",
              to: [emailFinal],
              subject: `Seu presente: Cartas da Prisão (Professor + Infográfico)`,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                <h2>Olá, ${nomeOk}!</h2>
                <p>Liberamos seu acesso vitalício a:</p>
                <ul>
                  <li><strong>Revista Digital "Cartas da Prisão" — Professor</strong></li>
                  <li><strong>Infográfico premium "Cartas da Prisão"</strong></li>
                </ul>
                <div style="text-align:center;margin:30px 0">
                  <a href="${URL_ACESSO}" style="background:#2563eb;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold">Acessar agora</a>
                </div>
                <p style="color:#666;font-size:14px">Use seu WhatsApp (${wLocal}) para receber o código de acesso.</p>
              </div>`,
            }),
          });
          if (!r.ok) errosEC.push(`resend ${r.status}: ${await r.text()}`);
        }
      } catch (e: any) { errosEC.push(`email: ${e.message}`); }
    }

    // WhatsApp acesso (via Meta direto — não usar send-whatsapp-message)
    let waAcessoOk = false;
    try {
      const { data: settings0 } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);
      const sm0: Record<string, string> = {};
      (settings0 || []).forEach((s: any) => { sm0[s.key] = s.value; });
      const txt = `Ola, ${nomeOk}! Seu acesso a Cartas da Prisao (Professor + Infografico) esta liberado.\n\nAcesse:\n${URL_ACESSO}\n\nDigite seu WhatsApp para receber o codigo.`;
      await sendText(sm0["whatsapp_phone_number_id"], sm0["whatsapp_access_token"], wMeta, txt);
      waAcessoOk = true;
      if (ultRespId) {
        await supabase.from("retencao_respostas")
          .update({ wa_acesso_enviado_em: new Date().toISOString() })
          .eq("id", ultRespId);
      }
    } catch (e: any) {
      const msg = String(e.message || e);
      if (msg.includes("re-engagement") || msg.includes("131047")) {
        errosEC.push("wa_acesso_janela_fechada");
      } else {
        errosEC.push(`wa_acesso_falhou: ${msg}`);
      }
    }

    // Aguardar 5s pra confirmação não chegar antes
    await new Promise((r) => setTimeout(r, 5000));

    // Mensagem de confirmação direto via Meta
    let confirmacaoEnviada = false;
    try {
      const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);
      const sm: Record<string, string> = {};
      (settings || []).forEach((s: any) => { sm[s.key] = s.value; });
      const vendedorOk = vendedor_nome || "seu consultor";
      const conf = `Pronto, ${nomeOk}! 🎉

Acabei de liberar pra você:

✅ *Revista Digital "Cartas da Prisão"* — Versão Professor
✅ *Infográfico premium "Cartas da Prisão"*

Acesso vitalício, no seu nome, em todos os dispositivos.

Em instantes você recebe por email e WhatsApp os links de acesso e suas credenciais de login. É só entrar e começar a estudar.

Amanhã te mando o que mais preparamos pra esse trimestre (spoiler: tem como licenciar pra equipe inteira da EBD da sua igreja 👀).

Qualquer dúvida, é só me chamar ou falar com ${vendedorOk}, seu consultor dedicado.

Que Deus abençoe sua EBD essa semana 🙏`;
      await sendText(sm["whatsapp_phone_number_id"], sm["whatsapp_access_token"], wMeta, conf);
      confirmacaoEnviada = true;
    } catch (e: any) {
      const msg = String(e.message || e);
      if (msg.includes("re-engagement") || msg.includes("131047") || msg.includes("24")) {
        errosEC.push("janela_meta_fechada");
      } else {
        errosEC.push(`confirmacao: ${msg}`);
      }
    }

    if (errosEC.length && ultRespId) {
      await supabase.from("retencao_respostas")
        .update({ licenca_erro: errosEC.join(" | ").slice(0, 500) })
        .eq("id", ultRespId);
    }

    return new Response(JSON.stringify({ success: true, confirmacaoEnviada, avisos: errosEC }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    await gravarErro(String(err.message || err));
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
