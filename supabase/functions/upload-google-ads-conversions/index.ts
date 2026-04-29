import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface GoogleAdsCredentials {
  developer_token: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  customer_id: string;
  login_customer_id?: string;
  conversion_action_id: string;
}

const REQUIRED_KEYS = [
  "google_ads_developer_token",
  "google_ads_client_id",
  "google_ads_client_secret",
  "google_ads_refresh_token",
  "google_ads_customer_id",
  "google_ads_conversion_action_id",
];

async function getCredentials(
  supabaseAdmin: any,
): Promise<{ creds?: GoogleAdsCredentials; missing?: string }> {
  const keys = [...REQUIRED_KEYS, "google_ads_login_customer_id"];
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("key, value")
    .in("key", keys);

  if (error) throw new Error(`Erro ao buscar credenciais: ${error.message}`);

  const settings: Record<string, string> = {};
  (data || []).forEach((row: any) => {
    if (row.value) settings[row.key] = row.value;
  });

  for (const k of REQUIRED_KEYS) {
    if (!settings[k]) return { missing: k };
  }

  return {
    creds: {
      developer_token: settings.google_ads_developer_token,
      client_id: settings.google_ads_client_id,
      client_secret: settings.google_ads_client_secret,
      refresh_token: settings.google_ads_refresh_token,
      customer_id: settings.google_ads_customer_id.replace(/-/g, ""),
      login_customer_id:
        settings.google_ads_login_customer_id?.replace(/-/g, "") || undefined,
      conversion_action_id: settings.google_ads_conversion_action_id,
    },
  };
}

async function refreshAccessToken(creds: GoogleAdsCredentials): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const rawBody = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    data = {};
  }

  if (!res.ok || data.error) {
    throw new Error(
      `Erro OAuth2: ${data.error_description || data.error || rawBody}`,
    );
  }

  const accessToken =
    typeof data.access_token === "string" ? data.access_token : undefined;
  if (!accessToken) throw new Error("OAuth2: access_token ausente");
  return accessToken;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatDateTimeSP(iso: string): string {
  // Convert any timestamp to "yyyy-MM-dd HH:mm:ss-03:00" in America/Sao_Paulo (fixed -03:00)
  const d = new Date(iso);
  // Shift to -03:00
  const utcMs = d.getTime();
  const sp = new Date(utcMs - 3 * 60 * 60 * 1000);
  const yyyy = sp.getUTCFullYear();
  const mm = String(sp.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(sp.getUTCDate()).padStart(2, "0");
  const HH = String(sp.getUTCHours()).padStart(2, "0");
  const MM = String(sp.getUTCMinutes()).padStart(2, "0");
  const SS = String(sp.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}-03:00`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchAllRows(
  supabase: any,
  table: string,
  columns: string,
  filters: (q: any) => any,
): Promise<any[]> {
  const out: any[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(columns).range(from, from + pageSize - 1);
    q = filters(q);
    const { data, error } = await q;
    if (error) throw new Error(`Query ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function uploadBatch(
  creds: GoogleAdsCredentials,
  accessToken: string,
  conversions: any[],
  validateOnly: boolean,
): Promise<{ accepted: number; errors: any[] }> {
  const url = `https://googleads.googleapis.com/v23/customers/${creds.customer_id}:uploadClickConversions`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": creds.developer_token,
    "Content-Type": "application/json",
  };
  if (creds.login_customer_id) {
    headers["login-customer-id"] = creds.login_customer_id;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      conversions,
      partialFailure: true,
      validateOnly,
    }),
  });

  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    console.error("uploadClickConversions HTTP error", res.status, text.slice(0, 500));
    throw new Error(`Google Ads API ${res.status}: ${text.slice(0, 300)}`);
  }

  const results = Array.isArray(json.results) ? json.results : [];
  const errors: any[] = [];

  if (json.partialFailureError) {
    const pfe = json.partialFailureError;
    const details = Array.isArray(pfe.details) ? pfe.details : [];
    for (const d of details) {
      const failures = d?.errors || [];
      for (const f of failures) {
        errors.push({
          message: f.message,
          code: f.errorCode,
          location: f.location,
        });
      }
    }
    if (errors.length === 0 && pfe.message) {
      errors.push({ message: pfe.message });
    }
    console.log(
      `partial_failure: ${errors.length} erros — amostra:`,
      JSON.stringify(errors.slice(0, 3)),
    );
  }

  // accepted = results com conversionDateTime preenchido (não-vazio)
  const accepted = results.filter((r: any) => r && Object.keys(r).length > 0).length;
  return { accepted, errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const start_date: string = body.start_date;
    const end_date: string = body.end_date;
    const canal: string = body.canal || "ambos";
    const validateOnly: boolean = !!body.validate_only;

    if (!start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: "start_date e end_date são obrigatórios (YYYY-MM-DD)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!["ambos", "mercadopago", "ecommerce"].includes(canal)) {
      return new Response(
        JSON.stringify({ error: "canal inválido (ambos|mercadopago|ecommerce)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { creds, missing } = await getCredentials(supabaseAdmin);
    if (!creds) {
      return new Response(
        JSON.stringify({ error: `Credencial faltante em system_settings: ${missing}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const endExclusive = addDays(end_date, 1);
    const canaisProcessados: string[] = [];
    const encontrados: Record<string, number> = {};
    const ignoradosSemEmail: Record<string, number> = {};
    const conversions: any[] = [];

    // Mercado Pago
    if (canal === "ambos" || canal === "mercadopago") {
      canaisProcessados.push("mercadopago");
      const rowsMp = await fetchAllRows(
        supabaseAdmin,
        "ebd_shopify_pedidos_mercadopago",
        "cliente_email, valor_total, updated_at",
        (q: any) =>
          q
            .eq("status", "PAGO")
            .gte("updated_at", `${start_date}T00:00:00`)
            .lt("updated_at", `${endExclusive}T00:00:00`),
      );
      let semEmail = 0;
      let valid = 0;
      for (const r of rowsMp) {
        const email = (r.cliente_email || "").trim().toLowerCase();
        const valor = Number(r.valor_total || 0);
        if (!email || !r.updated_at) {
          semEmail++;
          continue;
        }
        const hashedEmail = await sha256Hex(email);
        conversions.push({
          conversionAction: `customers/${creds.customer_id}/conversionActions/${creds.conversion_action_id}`,
          conversionDateTime: formatDateTimeSP(r.updated_at),
          conversionValue: valor,
          currencyCode: "BRL",
          userIdentifiers: [{ hashedEmail }],
        });
        valid++;
      }
      encontrados.mercadopago = valid;
      ignoradosSemEmail.mercadopago = semEmail;
    }

    // E-commerce
    if (canal === "ambos" || canal === "ecommerce") {
      canaisProcessados.push("ecommerce");
      const rowsEc = await fetchAllRows(
        supabaseAdmin,
        "ebd_shopify_pedidos",
        "customer_email, valor_total, order_date",
        (q: any) =>
          q
            .eq("status_pagamento", "paid")
            .gte("order_date", `${start_date}T00:00:00`)
            .lt("order_date", `${endExclusive}T00:00:00`),
      );
      let semEmail = 0;
      let valid = 0;
      for (const r of rowsEc) {
        const email = (r.customer_email || "").trim().toLowerCase();
        const valor = Number(r.valor_total || 0);
        if (!email || !r.order_date) {
          semEmail++;
          continue;
        }
        const hashedEmail = await sha256Hex(email);
        conversions.push({
          conversionAction: `customers/${creds.customer_id}/conversionActions/${creds.conversion_action_id}`,
          conversionDateTime: formatDateTimeSP(r.order_date),
          conversionValue: valor,
          currencyCode: "BRL",
          userIdentifiers: [{ hashedEmail }],
        });
        valid++;
      }
      encontrados.ecommerce = valid;
      ignoradosSemEmail.ecommerce = semEmail;
    }

    const accessToken = await refreshAccessToken(creds);

    const BATCH = 2000;
    let aceitos = 0;
    const allErrors: any[] = [];
    for (let i = 0; i < conversions.length; i += BATCH) {
      const slice = conversions.slice(i, i + BATCH);
      const { accepted, errors } = await uploadBatch(creds, accessToken, slice, validateOnly);
      aceitos += accepted;
      allErrors.push(...errors);
    }

    const result = {
      periodo: `${start_date} → ${end_date}`,
      canais_processados: canaisProcessados,
      encontrados,
      ignorados_sem_email: ignoradosSemEmail,
      enviados_ao_google: conversions.length,
      aceitos_pelo_google: aceitos,
      erros_partial_failure: allErrors.slice(0, 50),
      validate_only: validateOnly,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("upload-google-ads-conversions error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
