import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REVISTA_PROFESSOR_ID = "3a9fbd84-cad5-4c41-b0cb-a271109df565";
const INFOGRAFICO_ID = "30274872-b3c0-46eb-ae21-b6a52962b453";

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
  if (!res.ok) throw new Error(`Meta error: ${JSON.stringify(j)}`);
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let cliente_id: string | null = null;

  try {
    const body = await req.json();
    cliente_id = body.cliente_id;
    const { telefone, nome, email, vendedor_nome } = body;

    if (!cliente_id || !telefone) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: corsHeaders });
    }

    // Validar idempotência
    const { data: jaConcedido } = await supabase
      .from("retencao_respostas")
      .select("id")
      .eq("cliente_id", cliente_id)
      .not("licenca_concedida_em", "is", null)
      .limit(1)
      .maybeSingle();

    if (jaConcedido) {
      return new Response(JSON.stringify({ skipped: true, reason: "presente já liberado" }), { headers: corsHeaders });
    }

    const wLocal = whatsappLocal(telefone);
    const wMeta = normalizeForMeta(telefone);
    const emailFinal = email && email.includes("@") ? email : `${wLocal}@gestaoebd.com.br`;
    const nomeOk = nome || "Cliente";

    // Liberar as 2 licenças via revista-licencas-shopify-admin (action=insert)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    async function criarLicenca(revistaId: string) {
      const res = await fetch(`${supabaseUrl}/functions/v1/revista-licencas-shopify-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          action: "insert",
          record: {
            whatsapp: wLocal,
            nome_comprador: nomeOk,
            email: emailFinal,
            revista_id: revistaId,
            expira_em: null,
            ativo: true,
            origem: "presente_campanha_retencao",
          },
        }),
      });
      const j = await res.json();
      if (!res.ok || j?.error) throw new Error(j?.error || "Erro ao criar licença");
      return j;
    }

    await criarLicenca(REVISTA_PROFESSOR_ID);
    await criarLicenca(INFOGRAFICO_ID);

    // Buscar id da licença da revista para gravar
    const { data: lic } = await supabase
      .from("revista_licencas_shopify")
      .select("id")
      .eq("whatsapp", wLocal)
      .eq("revista_id", REVISTA_PROFESSOR_ID)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Atualizar registro retencao_respostas (último 'aceitar_presente')
    const { data: ultResp } = await supabase
      .from("retencao_respostas")
      .select("id")
      .eq("cliente_id", cliente_id)
      .eq("tipo", "aceitar_presente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultResp) {
      await supabase.from("retencao_respostas").update({
        licenca_concedida_em: new Date().toISOString(),
        licenca_revista_id: lic?.id || null,
      }).eq("id", ultResp.id);
    }

    // Aguardar 5s para que email/whatsapp do sistema saiam primeiro
    await new Promise((r) => setTimeout(r, 5000));

    // Mensagem de confirmação
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

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[liberar-presente] error", err);
    if (cliente_id) {
      try {
        const { data: ultResp } = await supabase
          .from("retencao_respostas")
          .select("id")
          .eq("cliente_id", cliente_id)
          .eq("tipo", "aceitar_presente")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ultResp) {
          await supabase.from("retencao_respostas").update({ licenca_erro: String(err.message || err) }).eq("id", ultResp.id);
        }
      } catch { /* ignore */ }
    }
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
