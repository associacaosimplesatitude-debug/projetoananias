import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GRAPH_VERSION = "v22.0";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toUnix(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return isNaN(t) ? null : Math.floor(t / 1000);
}

async function fetchAnalytics(wabaId: string, token: string, templateId: string, start: number, end: number) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/template_analytics`);
  url.searchParams.set("start", String(start));
  url.searchParams.set("end", String(end));
  url.searchParams.set("granularity", "DAILY");
  url.searchParams.set("template_ids", `[${templateId}]`);
  url.searchParams.set("metric_types", `["SENT","DELIVERED","READ","CLICKED"]`);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}

async function enableInsights(wabaId: string, token: string) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ is_enabled_for_insights: true }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

function isNotEnabledError(body: any): boolean {
  const msg = (body?.error?.message || "").toLowerCase();
  return msg.includes("template insights") || msg.includes("not available") || msg.includes("not enabled for insights");
}

function sumClicks(body: any): { clicked: number; sent: number; delivered: number; read: number } {
  const totals = { clicked: 0, sent: 0, delivered: 0, read: 0 };
  const arr = body?.data?.[0]?.data_points || body?.template_analytics?.data?.[0]?.data_points || [];
  for (const dp of arr) {
    totals.sent += Number(dp.sent || 0);
    totals.delivered += Number(dp.delivered || 0);
    totals.read += Number(dp.read || 0);
    const c = dp.clicked;
    if (Array.isArray(c)) {
      for (const item of c) totals.clicked += Number(item?.count || 0);
    } else if (typeof c === "number") {
      totals.clicked += c;
    }
  }
  return totals;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { campanha_id } = await req.json().catch(() => ({}));
    if (!campanha_id) return json({ enabled: false, error: "campanha_id obrigatório" }, 400);

    const { data: camp, error: cErr } = await supabase
      .from("whatsapp_campanhas")
      .select("id, agendada_para, iniciada_em, finalizada_em, template_id, whatsapp_templates(meta_template_id, nome)")
      .eq("id", campanha_id)
      .single();

    if (cErr || !camp) return json({ enabled: false, error: "Campanha não encontrada" }, 404);

    const tpl: any = (camp as any).whatsapp_templates;
    const metaTemplateId: string | null = tpl?.meta_template_id || null;
    if (!metaTemplateId) {
      return json({ enabled: false, message: "Template sem meta_template_id — impossível consultar analytics." });
    }

    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_access_token", "whatsapp_business_account_id"]);
    const smap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { smap[s.key] = s.value; });
    const token = smap["whatsapp_access_token"];
    const wabaId = smap["whatsapp_business_account_id"];
    if (!token || !wabaId) {
      return json({ enabled: false, message: "Credenciais Meta ausentes (whatsapp_access_token/whatsapp_business_account_id)." });
    }

    // Range: usa iniciada_em || agendada_para até finalizada_em || now.
    // Estende o start em 1 dia para trás para tolerância de fuso e o end sempre +1 dia (Meta usa buckets diários).
    const startBase = toUnix(camp.iniciada_em) ?? toUnix(camp.agendada_para) ?? Math.floor(Date.now() / 1000) - 7 * 86400;
    const endBase = toUnix(camp.finalizada_em) ?? Math.floor(Date.now() / 1000);
    const start = startBase - 86400;
    const end = endBase + 86400;

    let attempt = await fetchAnalytics(wabaId, token, metaTemplateId, start, end);

    if (!attempt.ok && isNotEnabledError(attempt.body)) {
      // Try to enable insights once, then retry
      const en = await enableInsights(wabaId, token);
      if (en.ok) {
        attempt = await fetchAnalytics(wabaId, token, metaTemplateId, start, end);
        if (!attempt.ok) {
          return json({
            enabled: false,
            message: "Template Analytics ainda não está pronto nesta WABA. Habilitamos agora — os dados podem levar até 24h para aparecer.",
            meta_error: attempt.body?.error?.message,
          });
        }
      } else {
        return json({
          enabled: false,
          message: "Template Analytics não está habilitado nesta WABA e a habilitação automática falhou. Habilite manualmente no Meta Business Suite.",
          meta_error: attempt.body?.error?.message || en.body?.error?.message,
        });
      }
    }

    if (!attempt.ok) {
      console.error("[template-analytics] Meta error:", attempt.body);
      return json({
        enabled: false,
        message: "Falha ao consultar Template Analytics no Meta.",
        meta_error: attempt.body?.error?.message,
      });
    }

    const totals = sumClicks(attempt.body);
    return json({
      enabled: true,
      template_id: metaTemplateId,
      template_nome: tpl?.nome || null,
      periodo: { start, end },
      totais: totals,
      clicked: totals.clicked,
    });
  } catch (e) {
    console.error("[template-analytics] erro:", e);
    return json({ enabled: false, message: "Erro interno ao consultar analytics.", error: String(e) }, 200);
  }
});
