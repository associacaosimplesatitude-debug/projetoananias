// Dispara o template "resumo_diario_diretoria" para todos os destinatários ativos
// configurados em resumo_diario_destinatarios. Pode ser chamada manualmente
// (admin via JWT) ou pelo cron job diário (header x-disparo-tipo: cron).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-disparo-tipo",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const META_API_BASE = "https://graph.facebook.com/v23.0";
const TEMPLATE_NAME = "resumo_diario_diretoria";
const TEMPLATE_LANG = "pt_BR";

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v) || 0);
}

function fmtInt(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(Number(v) || 0);
}

function fmtDataBR(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-");
  return `${d}/${m}/${y}`;
}

function hojeBRT(): string {
  // yyyy-MM-dd em America/Sao_Paulo
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function onlyDigits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

function buildVariacaoTexto(faturamentoOntem: number, variacaoPct: number): string {
  if (!faturamentoOntem || faturamentoOntem === 0) return "—";
  const pct = Math.abs(variacaoPct).toFixed(1).replace(".", ",");
  if (variacaoPct > 0) return `↗ +${pct}% vs ontem`;
  if (variacaoPct < 0) return `↘ -${pct}% vs ontem`;
  return "—";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Resolve credenciais: env primeiro, fallback para system_settings
    let WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || Deno.env.get("META_WHATSAPP_TOKEN") || "";
    let PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      const { data: settings } = await admin
        .from("system_settings")
        .select("key, value")
        .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);
      const sm: Record<string, string> = {};
      (settings || []).forEach((s: any) => { sm[s.key] = s.value; });
      WHATSAPP_TOKEN = WHATSAPP_TOKEN || sm["whatsapp_access_token"] || "";
      PHONE_NUMBER_ID = PHONE_NUMBER_ID || sm["whatsapp_phone_number_id"] || "";
    }

    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      return jsonResponse({ error: "Credenciais WhatsApp não configuradas" }, 500);
    }

    // ---- Parse body
    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    const headerTipo = req.headers.get("x-disparo-tipo") || "";
    const disparoTipo: "manual" | "cron" =
      headerTipo === "cron" || body?.disparo_tipo === "cron" ? "cron" : "manual";

    const dataRef: string = body?.data_ref || hojeBRT();

    // ---- Auth
    let disparadoPor: string | null = null;
    let userToken: string | null = null;
    if (disparoTipo === "manual") {
      const auth = req.headers.get("Authorization") || "";
      const token = auth.replace("Bearer ", "").trim();
      if (!token) return jsonResponse({ error: "Não autorizado" }, 401);

      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser(token);
      if (userErr || !userData?.user) return jsonResponse({ error: "Não autorizado" }, 401);

      const { data: roleOk } = await admin.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (!roleOk) return jsonResponse({ error: "Permissão negada" }, 403);
      disparadoPor = userData.user.id;
      userToken = token;
    }

    // ---- Carrega resumo (usa client autenticado pq RPC exige admin via auth.uid)
    const rpcClient = userToken
      ? createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: `Bearer ${userToken}` } },
        })
      : admin;
    const { data: resumo, error: resumoErr } = await rpcClient.rpc("get_resumo_diario", {
      data_ref: dataRef,
    });
    if (resumoErr) {
      return jsonResponse({ error: "Falha ao gerar resumo", detalhe: resumoErr.message }, 500);
    }
    const r: any = resumo || {};

    // ---- Destinatários ativos (ou override por telefones)
    let destinatarios: any[] | null = null;
    let destErr: any = null;
    if (Array.isArray(body?.telefones_override) && body.telefones_override.length > 0) {
      destinatarios = body.telefones_override.map((tel: string, i: number) => ({
        id: `override-${i}`,
        nome: `Override ${i + 1}`,
        telefone: tel,
        ativo: true,
      }));
    } else {
      const res = await admin
        .from("resumo_diario_destinatarios")
        .select("id, nome, telefone, ativo")
        .eq("ativo", true);
      destinatarios = res.data;
      destErr = res.error;
    }
    if (destErr) {
      return jsonResponse({ error: "Falha ao carregar destinatários", detalhe: destErr.message }, 500);
    }

    if (!destinatarios || destinatarios.length === 0) {
      return jsonResponse({
        data_ref: dataRef,
        sucesso: 0,
        falhas: 0,
        message: "Nenhum destinatário ativo",
      });
    }

    // ---- Monta variáveis
    const totais = r.totais || {};
    const top = (r.vendedores_top5 || [])[0] || null;
    const destaque = r.destaque_produto || null;

    const vars: string[] = [
      fmtDataBR(dataRef),                                                // {{1}}
      fmtBRL(totais.faturamento || 0),                                   // {{2}}
      buildVariacaoTexto(totais.faturamento_ontem || 0, totais.variacao_pct || 0), // {{3}}
      fmtInt(totais.pedidos || 0),                                       // {{4}}
      fmtBRL(totais.ticket_medio || 0),                                  // {{5}}
      top?.nome || "Sem vendas",                                         // {{6}}
      fmtBRL(top?.total || 0),                                           // {{7}}
      destaque?.titulo
        ? `${destaque.titulo} (${fmtInt(destaque.quantidade || 0)} un)`
        : "Sem destaque",                                                // {{8}}
      fmtInt(totais.produtos || 0),                                      // {{9}}
    ];

    // ---- Loop de envio (sequencial)
    let sucesso = 0;
    let falhas = 0;
    const detalhes: any[] = [];

    for (const dest of destinatarios) {
      const telDigits = onlyDigits(dest.telefone);

      // Dedup: no cron, não reenviar para o mesmo destinatário no mesmo dia
      if (disparoTipo === "cron") {
        const { data: existente } = await admin
          .from("resumo_diario_envios_log")
          .select("id")
          .eq("destinatario_id", dest.id)
          .eq("data_ref", dataRef)
          .eq("disparo_tipo", "cron")
          .eq("status", "sucesso")
          .limit(1);
        if (existente && existente.length > 0) {
          detalhes.push({ telefone: dest.telefone, status: "pulado", motivo: "ja_enviado_cron" });
          continue;
        }
      }

      const payload = {
        messaging_product: "whatsapp",
        to: telDigits,
        type: "template",
        template: {
          name: TEMPLATE_NAME,
          language: { code: TEMPLATE_LANG },
          components: [
            {
              type: "body",
              parameters: vars.map((text) => ({ type: "text", text })),
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: dataRef }],
            },
          ],
        },
      };

      let messageId: string | null = null;
      let status: "sucesso" | "falha" = "falha";
      let erroMsg: string | null = null;

      try {
        const resp = await fetch(`${META_API_BASE}/${PHONE_NUMBER_ID}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const respJson = await resp.json().catch(() => ({}));
        if (resp.ok) {
          messageId = respJson?.messages?.[0]?.id || null;
          status = "sucesso";
          sucesso++;
        } else {
          erroMsg = JSON.stringify(respJson?.error || respJson || { status: resp.status });
          falhas++;
        }
      } catch (e) {
        erroMsg = `Exception: ${(e as Error).message}`;
        falhas++;
      }

      // Log
      await admin.from("resumo_diario_envios_log").insert({
        data_ref: dataRef,
        destinatario_id: typeof dest.id === "string" && dest.id.startsWith("override-") ? null : dest.id,
        telefone: dest.telefone,
        whatsapp_message_id: messageId,
        status,
        erro_mensagem: erroMsg,
        payload_enviado: payload,
        disparo_tipo: disparoTipo,
        disparado_por: disparadoPor,
      });

      detalhes.push({
        telefone: dest.telefone,
        status,
        message_id: messageId,
        erro: erroMsg,
      });
    }

    return jsonResponse({
      data_ref: dataRef,
      total_destinatarios: destinatarios.length,
      sucesso,
      falhas,
      detalhes,
    });
  } catch (e) {
    return jsonResponse({ error: "Erro interno", detalhe: (e as Error).message }, 500);
  }
});
