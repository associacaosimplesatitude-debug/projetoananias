import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  const resp = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${credentials}` },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: config.refresh_token }),
  });
  const tokenData = await resp.json();
  if (!resp.ok || tokenData.error) throw new Error(tokenData.error_description || 'Erro ao renovar token');
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));
  await supabase.from('bling_config').update({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: expiresAt.toISOString(),
  }).eq('id', config.id);
  return tokenData.access_token;
}

function isTokenExpired(exp: string | null): boolean {
  if (!exp) return true;
  return Date.now() >= new Date(exp).getTime() - 5 * 60 * 1000;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function findProductBySku(token: string, sku: string): Promise<any | null> {
  const url = `https://api.bling.com.br/Api/v3/produtos?codigo=${encodeURIComponent(sku)}&limite=1`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json?.data?.[0] || null;
}

async function fetchProductDetails(token: string, id: number): Promise<any | null> {
  const resp = await fetch(`https://api.bling.com.br/Api/v3/produtos/${id}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json?.data ?? json;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const skusInput: string[] = Array.isArray(body.skus)
      ? body.skus
      : body.sku ? [body.sku] : [];
    const skus = skusInput.map((s) => String(s).trim()).filter(Boolean);
    if (skus.length === 0) {
      return new Response(JSON.stringify({ error: 'sku obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Check cache
    const { data: cached } = await admin
      .from('shopify_produto_pesos')
      .select('sku, peso_bruto_kg, peso_liquido_kg')
      .in('sku', skus);
    const cacheMap = new Map((cached || []).map((c: any) => [c.sku, c]));
    const missing = skus.filter((s) => !cacheMap.has(s));

    if (missing.length > 0) {
      const { data: cfg, error: cfgErr } = await admin.from('bling_config').select('*').single();
      if (cfgErr || !cfg) throw new Error('Configuração do Bling não encontrada');

      let token = cfg.access_token;
      if (isTokenExpired(cfg.token_expires_at)) {
        token = await refreshBlingToken(admin, cfg);
      }

      for (const sku of missing) {
        try {
          await delay(350);
          const found = await findProductBySku(token, sku);
          if (!found) {
            await admin.from('shopify_produto_pesos').upsert({
              sku, peso_bruto_kg: 0, peso_liquido_kg: 0, updated_at: new Date().toISOString(),
            });
            cacheMap.set(sku, { sku, peso_bruto_kg: 0, peso_liquido_kg: 0 });
            continue;
          }
          await delay(350);
          const details = await fetchProductDetails(token, Number(found.id));
          const pesoBruto = Number(details?.pesoBruto ?? found?.pesoBruto ?? 0) || 0;
          const pesoLiquido = Number(details?.pesoLiquido ?? found?.pesoLiquido ?? 0) || 0;
          await admin.from('shopify_produto_pesos').upsert({
            sku,
            peso_bruto_kg: pesoBruto,
            peso_liquido_kg: pesoLiquido,
            bling_product_id: Number(found.id),
            updated_at: new Date().toISOString(),
          });
          cacheMap.set(sku, { sku, peso_bruto_kg: pesoBruto, peso_liquido_kg: pesoLiquido });
        } catch (e) {
          console.error(`Erro ao buscar SKU ${sku}:`, e);
          cacheMap.set(sku, { sku, peso_bruto_kg: 0, peso_liquido_kg: 0 });
        }
      }
    }

    const result = skus.map((s) => cacheMap.get(s) || { sku: s, peso_bruto_kg: 0, peso_liquido_kg: 0 });

    return new Response(JSON.stringify({ success: true, pesos: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('bling-get-product-weight error:', e);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
