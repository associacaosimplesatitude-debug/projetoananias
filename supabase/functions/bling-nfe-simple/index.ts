import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEPLOY_VERSION = 'v2-enriched-penha-2026-02-24';

// Constantes fiscais Penha
const LOJA_PENHA_ID = 205891152;
const SERIE_PENHA = 1;
const NATUREZA_PENHA_PF_ID = 15108893128;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  return now.getTime() >= expiresAt.getTime() - 5 * 60 * 1000;
}

async function refreshBlingToken(supabase: any, config: any, tableName: string): Promise<string> {
  if (!config.refresh_token || !config.client_id || !config.client_secret) {
    throw new Error('Credenciais do Bling incompletas');
  }
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  const res = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error_description || 'Erro ao renovar token');

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 21600));
  await supabase.from(tableName).update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: expiresAt.toISOString(),
  }).eq('id', config.id);

  return data.access_token;
}

serve(async (req) => {
  console.log(`[BLING-NFE-SIMPLE] ========== VERSÃO: ${DEPLOY_VERSION} ==========`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { bling_order_id } = await req.json();
    if (!bling_order_id) {
      return new Response(JSON.stringify({ success: false, error: 'bling_order_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[SIMPLE] Pedido Bling: ${bling_order_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Conta unificada - todas as filiais usam o mesmo token OAuth
    const tableName = 'bling_config';
    let { data: config } = await supabase.from(tableName).select('*').limit(1).single();
    if (!config?.access_token) {
      throw new Error('Configuração do Bling não encontrada');
    }

    // Renovar token se expirado
    let accessToken = config.access_token;
    if (isTokenExpired(config.token_expires_at)) {
      console.log(`[SIMPLE] Token expirado, renovando...`);
      accessToken = await refreshBlingToken(supabase, config, tableName);
    }

    // Buscar dados do pedido para detectar loja
    console.log(`[SIMPLE] Buscando dados do pedido ${bling_order_id}...`);
    const orderRes = await fetch(
      `https://api.bling.com.br/Api/v3/pedidos/vendas/${bling_order_id}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const orderData = await orderRes.json();
    const pedido = orderData?.data;
    const isLojaPenha = pedido?.loja?.id === LOJA_PENHA_ID;
    console.log(`[SIMPLE] Loja do pedido: ${pedido?.loja?.id}, isPenha: ${isLojaPenha}`);

    // Montar payload - herança enriquecida para Penha
    let nfePayload: any = { idPedidoVenda: bling_order_id };
    if (isLojaPenha) {
      const doc = pedido?.contato?.numeroDocumento?.replace(/\D/g, '') || '';
      console.log(`[SIMPLE] Penha detectada. Doc contato: ${doc.length > 11 ? 'PJ' : 'PF'}`);
      nfePayload.serie = SERIE_PENHA;
      nfePayload.naturezaOperacao = { id: NATUREZA_PENHA_PF_ID };
      nfePayload.loja = { id: LOJA_PENHA_ID };
    }

    // PASSO 1: Criar NF-e por herança (vincula ao pedido - ícone "V")
    console.log(`[SIMPLE] PASSO 1: Herança ${isLojaPenha ? 'enriquecida (Penha)' : 'simples'} para pedido ${bling_order_id}`);
    console.log(`[SIMPLE] Payload:`, JSON.stringify(nfePayload));
    const createRes = await fetch('https://api.bling.com.br/Api/v3/nfe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(nfePayload),
    });

    const createData = await createRes.json();
    console.log(`[SIMPLE] Resposta criação: status=${createRes.status}`, JSON.stringify(createData).substring(0, 500));

    const nfeId = createData?.data?.id;
    if (!nfeId) {
      // Extrair erro
      let errorMsg = 'Falha na herança simples';
      if (createData?.error?.fields && Array.isArray(createData.error.fields)) {
        errorMsg = createData.error.fields.map((f: any) => f?.msg || f?.message).filter(Boolean).join(' | ') || errorMsg;
      } else if (createData?.error?.message) {
        errorMsg = createData.error.message;
      }
      console.error(`[SIMPLE] Erro: ${errorMsg}`);
      return new Response(JSON.stringify({ success: false, error: errorMsg, raw: createData }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[SIMPLE] NF-e criada com ID: ${nfeId}. Enviando para SEFAZ...`);

    // PASSO 2: Enviar para SEFAZ
    const sendRes = await fetch(`https://api.bling.com.br/Api/v3/nfe/${nfeId}/envio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const sendData = await sendRes.json();
    console.log(`[SIMPLE] Resposta envio SEFAZ: status=${sendRes.status}`, JSON.stringify(sendData).substring(0, 300));

    return new Response(JSON.stringify({
      success: true,
      nfe_id: nfeId,
      nfe_pendente: true,
      stage: 'polling',
      message: 'NF-e criada por herança e enviada para SEFAZ',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error(`[SIMPLE] Erro geral:`, err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
