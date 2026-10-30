import { createClient } from "npm:@supabase/supabase-js@2";

// Recebe notificações de cupom de fidelidade da Central Gospel Store.
// Autenticação: header x-webhook-secret == STORE_CG_WEBHOOK_SECRET
// (mesmo segredo compartilhado já usado por receive-order-from-store-cg).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-webhook-secret, content-type",
};

const TEMPLATE_NAME = "cupom_fidelidade_2a_compra";
const GRAPH_VERSION = "v21.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

// Armazena 11 dígitos (DDD + número), sem 55 — padrão do projeto
function normalizePhone(v: unknown): string | null {
  let d = onlyDigits(v);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d.length >= 10 ? d : null;
}

function formatDateBR(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Lê o cabeçalho do modelo aprovado no Meta. Se for mídia (IMAGE/VIDEO/DOCUMENT),
// copia a mídia de exemplo para o bucket permanente campaign-assets (uma única vez)
// e devolve o componente "header" com o link público.
let copyCodeIndexes: number[] = [];
async function resolveHeaderComponent(supabase: any, wabaId: string | undefined, token: string) {
  if (!wabaId) { console.warn("[loyalty] whatsapp_business_account_id ausente — enviando sem cabeçalho"); return null; }
  const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates?name=${TEMPLATE_NAME}&fields=name,language,status,components`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) { console.warn(`[loyalty] falha ao ler modelo [${r.status}]: ${await r.text()}`); return null; }
  const tpl = ((await r.json())?.data || []).find((t: any) => t.name === TEMPLATE_NAME && t.language === "pt_BR");
  const btns = tpl?.components?.find((c: any) => c.type === "BUTTONS")?.buttons || [];
  copyCodeIndexes = btns.map((b: any, i: number) => (b.type === "COPY_CODE" ? i : -1)).filter((i: number) => i >= 0);
  const h = tpl?.components?.find((c: any) => c.type === "HEADER");
  if (!h || !["IMAGE", "VIDEO", "DOCUMENT"].includes(h.format)) return null;
  const kind = h.format.toLowerCase();
  const ext = kind === "image" ? "jpg" : kind === "video" ? "mp4" : "pdf";
  const path = `templates/${TEMPLATE_NAME}.${ext}`;
  const { data: pub } = supabase.storage.from("campaign-assets").getPublicUrl(path);
  const publicUrl = pub.publicUrl;
  const head = await fetch(publicUrl, { method: "HEAD" });
  if (!head.ok) {
    const exampleUrl = h.example?.header_handle?.[0];
    if (!exampleUrl) throw new Error(`Modelo exige ${h.format} no cabeçalho mas não há mídia de exemplo`);
    const media = await fetch(exampleUrl);
    if (!media.ok) throw new Error(`Falha ao baixar mídia do modelo [${media.status}]`);
    const bytes = new Uint8Array(await media.arrayBuffer());
    const contentType = media.headers.get("content-type") || (kind === "image" ? "image/jpeg" : kind === "video" ? "video/mp4" : "application/pdf");
    const { error } = await supabase.storage.from("campaign-assets").upload(path, bytes, { contentType, upsert: true });
    if (error) throw new Error(`Falha ao salvar mídia do modelo: ${error.message}`);
    console.log(`[loyalty] mídia do cabeçalho copiada para campaign-assets/${path}`);
  }
  return { type: "header", parameters: [{ type: kind, [kind]: { link: publicUrl } }] };
}

async function sendWhatsApp(supabase: any, phone11: string, nome: string, code: string, validade: string) {
  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token", "whatsapp_business_account_id"]);
  const map: Record<string, string> = {};
  (settings || []).forEach((s: any) => (map[s.key] = s.value));
  const phoneNumberId = map["whatsapp_phone_number_id"];
  const token = map["whatsapp_access_token"];
  if (!phoneNumberId || !token) {
    return { ok: false, error: "Credenciais WhatsApp (system_settings) não configuradas" };
  }
  const components: any[] = [];
  const header = await resolveHeaderComponent(supabase, map["whatsapp_business_account_id"], token);
  if (header) components.push(header);
  components.push({
    type: "body",
    parameters: [
      { type: "text", text: nome || "Cliente" },
      { type: "text", text: code },
      { type: "text", text: validade || "-" },
    ],
  });
  for (const i of copyCodeIndexes) {
    components.push({ type: "button", sub_type: "copy_code", index: String(i), parameters: [{ type: "coupon_code", coupon_code: code }] });
  }
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: `55${phone11}`,
      type: "template",
      template: {
        name: TEMPLATE_NAME,
        language: { code: "pt_BR" },
        components,
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `Meta [${res.status}]: ${text}` };
  return { ok: true, response: text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const expected = Deno.env.get("STORE_CG_WEBHOOK_SECRET")?.trim() ?? "";
  const provided = req.headers.get("x-webhook-secret")?.trim() ?? "";
  if (!expected || provided !== expected) {
    console.warn("[loyalty] segredo inválido ou ausente");
    return json({ error: "invalid webhook secret" }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const event = body?.event;
  const cpf = onlyDigits(body?.customer_cpf);
  if (event !== "coupon_generated" && event !== "coupon_used") return json({ error: "invalid event" }, 400);
  if (cpf.length !== 11 && cpf.length !== 14) return json({ error: "invalid customer_cpf" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    if (event === "coupon_used") {
      const { data, error } = await supabase
        .from("clientes_cupom_fidelidade")
        .update({ usado: true, usado_em: new Date().toISOString() })
        .eq("cpf", cpf)
        .select("id");
      if (error) console.error("[loyalty] erro ao marcar usado:", error);
      else if (!data?.length) console.log(`[loyalty] coupon_used para CPF sem registro (${cpf.slice(0, 3)}***) — ignorado`);
      return json({ ok: true, updated: data?.length ?? 0 });
    }

    const code = String(body?.coupon_code ?? "").trim();
    if (!code) return json({ error: "missing coupon_code" }, 400);
    const expiresAt = body?.expires_at ? new Date(body.expires_at).toISOString() : null;
    const telefone = normalizePhone(body?.customer_phone);
    const nome = body?.customer_name ? String(body.customer_name).trim() : null;

    const { data: row, error: upErr } = await supabase
      .from("clientes_cupom_fidelidade")
      .upsert({
        cpf, nome, telefone,
        email: body?.customer_email ? String(body.customer_email).trim().toLowerCase() : null,
        coupon_code: code, expires_at: expiresAt,
        usado: false, usado_em: null, whatsapp_enviado_em: null,
        criado_em: new Date().toISOString(),
      }, { onConflict: "cpf" })
      .select("id")
      .single();
    if (upErr) {
      console.error("[loyalty] erro no upsert:", upErr);
      return json({ ok: false, error: "db error" });
    }

    let whatsapp: any = { ok: false, error: "sem telefone válido" };
    if (telefone) {
      try {
        whatsapp = await sendWhatsApp(supabase, telefone, (nome || "").split(" ")[0], code, formatDateBR(expiresAt));
      } catch (e) {
        whatsapp = { ok: false, error: String(e) };
      }
    }
    if (whatsapp.ok) {
      await supabase.from("clientes_cupom_fidelidade")
        .update({ whatsapp_enviado_em: new Date().toISOString() }).eq("id", row.id);
      console.log(`[loyalty] WhatsApp enviado (registro ${row.id})`);
    } else {
      console.error(`[loyalty] WhatsApp NÃO enviado (registro ${row.id}, template ${TEMPLATE_NAME}): ${whatsapp.error}`);
    }
    return json({ ok: true, id: row.id, whatsapp_sent: !!whatsapp.ok });
  } catch (e) {
    console.error("[loyalty] erro interno:", e);
    return json({ ok: false, error: "internal error" });
  }
});
