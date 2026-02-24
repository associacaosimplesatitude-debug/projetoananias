import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEPLOY_VERSION = 'v3-penha-fullpayload-put-2026-02-24';

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

// Tentar vincular NF-e ao pedido via PUT
async function tryLinkNfeToPedido(accessToken: string, nfeId: number, orderId: number): Promise<boolean> {
  try {
    console.log(`[SIMPLE] PUT /nfe/${nfeId} com idPedidoVenda=${orderId} para vincular...`);
    const putRes = await fetch(`https://api.bling.com.br/Api/v3/nfe/${nfeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ idPedidoVenda: orderId }),
    });
    const putData = await putRes.json().catch(() => ({}));
    console.log(`[SIMPLE] PUT vinculação: status=${putRes.status}`, JSON.stringify(putData).substring(0, 300));
    return putRes.ok;
  } catch (err: any) {
    console.log(`[SIMPLE] PUT vinculação falhou: ${err.message}`);
    return false;
  }
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

    // =====================================================
    // PASSO 1: Tentar herança simples (funciona para Matriz)
    // =====================================================
    let nfePayload: any = { idPedidoVenda: bling_order_id };
    if (isLojaPenha) {
      nfePayload.serie = SERIE_PENHA;
      nfePayload.naturezaOperacao = { id: NATUREZA_PENHA_PF_ID };
      nfePayload.loja = { id: LOJA_PENHA_ID };
    }

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

    let nfeId = createData?.data?.id;

    // =====================================================
    // PASSO 1B: Se herança falhou E é Penha, usar payload completo
    // =====================================================
    if (!nfeId && isLojaPenha) {
      console.log(`[SIMPLE] Herança falhou para Penha. Construindo payload completo...`);

      const hoje = new Date().toISOString().split('T')[0];
      const doc = pedido?.contato?.numeroDocumento?.replace(/\D/g, '') || '';
      const tipoPessoa = doc.length > 11 ? 'J' : 'F';

      // Buscar contato completo
      let contatoDetalhe = pedido?.contato || {};
      if (pedido?.contato?.id) {
        try {
          const cRes = await fetch(`https://api.bling.com.br/Api/v3/contatos/${pedido.contato.id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (cRes.ok) {
            const cData = await cRes.json();
            contatoDetalhe = cData?.data || contatoDetalhe;
          }
        } catch (e) {
          console.log(`[SIMPLE] Aviso: erro ao buscar contato detalhado`);
        }
      }

      const endGeral = contatoDetalhe?.endereco?.geral || contatoDetalhe?.endereco || {};
      const enderecoLinha = endGeral.endereco || endGeral.logradouro || '';
      const cep = (endGeral.cep || '').replace(/\D/g, '');
      const municipio = endGeral.municipio || endGeral.cidade || '';
      const uf = endGeral.uf || endGeral.estado || '';

      // Mapear itens
      const itensNfe = (pedido?.itens || []).map((item: any, idx: number) => ({
        codigo: item.codigo || item.produto?.codigo || `ITEM-${idx + 1}`,
        descricao: item.descricao || item.produto?.descricao || 'Produto',
        unidade: item.unidade || 'UN',
        quantidade: Number(item.quantidade) || 1,
        valor: Number(item.valor) || 0,
        tipo: 'P',
        origem: 0,
        ncm: item.produto?.ncm || item.ncm || '49019900',
        cfop: item.produto?.cfop || item.cfop || '5102',
      }));

      console.log(`[SIMPLE] Itens mapeados: ${itensNfe.length}, Contato: ${contatoDetalhe?.nome}`);

      // Buscar próximo número NF-e para Penha
      let proximoNumero = 19001;
      try {
        let maxNum = 0;
        let pagina = 1;
        while (pagina <= 50) {
          const searchUrl = `https://api.bling.com.br/Api/v3/nfe?serie=${SERIE_PENHA}&pagina=${pagina}&limite=100&situacao=6`;
          const sRes = await fetch(searchUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (!sRes.ok) break;
          const sData = await sRes.json();
          const nfes = Array.isArray(sData?.data) ? sData.data : [];
          if (nfes.length === 0) break;
          for (const nfe of nfes) {
            const n = Number(nfe.numero) || 0;
            if (n < 30000 && n > maxNum) maxNum = n;
          }
          if (nfes.length < 100) break;
          pagina++;
        }
        if (maxNum > 0) proximoNumero = maxNum + 1;
        console.log(`[SIMPLE] Próximo número Penha: ${proximoNumero}`);
      } catch (e) {
        console.log(`[SIMPLE] Erro ao buscar numeração, usando ${proximoNumero}`);
      }

      const fullPayload: any = {
        tipo: 1,
        dataOperacao: hoje,
        dataEmissao: hoje,
        contato: {
          id: contatoDetalhe.id,
          nome: contatoDetalhe.nome,
          numeroDocumento: contatoDetalhe.numeroDocumento || pedido?.contato?.numeroDocumento,
          tipoPessoa: tipoPessoa,
          indicadorie: 9,
          endereco: {
            endereco: enderecoLinha,
            numero: endGeral.numero || 'S/N',
            bairro: endGeral.bairro || '',
            cep: cep,
            municipio: municipio,
            uf: uf,
          },
        },
        itens: itensNfe,
        idPedidoVenda: bling_order_id, // Manter para tentar vínculo
        serie: SERIE_PENHA,
        naturezaOperacao: { id: NATUREZA_PENHA_PF_ID },
        loja: { id: LOJA_PENHA_ID },
        numero: proximoNumero,
        indFinal: 1,
        indIEDest: 9,
      };

      console.log(`[SIMPLE] Payload completo Penha:`, JSON.stringify(fullPayload).substring(0, 800));

      const fullRes = await fetch('https://api.bling.com.br/Api/v3/nfe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(fullPayload),
      });

      const fullData = await fullRes.json();
      console.log(`[SIMPLE] Resposta payload completo: status=${fullRes.status}`, JSON.stringify(fullData).substring(0, 500));

      nfeId = fullData?.data?.id;

      // Se conflito de numeração, tentar incrementar
      if (!nfeId && fullRes.status === 400) {
        const errMsg = (fullData?.error?.fields || []).map((f: any) => f?.msg || '').join(' ').toLowerCase();
        if (errMsg.includes('existe') && errMsg.includes('numero')) {
          console.log(`[SIMPLE] Conflito de numeração, incrementando...`);
          for (let i = 1; i <= 10; i++) {
            fullPayload.numero = proximoNumero + i;
            const retryRes = await fetch('https://api.bling.com.br/Api/v3/nfe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify(fullPayload),
            });
            const retryData = await retryRes.json();
            if (retryData?.data?.id) {
              nfeId = retryData.data.id;
              console.log(`[SIMPLE] Sucesso com número ${fullPayload.numero}`);
              break;
            }
          }
        }
      }

      if (!nfeId) {
        let errorMsg = 'Falha ao criar NF-e com payload completo';
        if (fullData?.error?.fields && Array.isArray(fullData.error.fields)) {
          errorMsg = fullData.error.fields.map((f: any) => f?.msg || f?.message).filter(Boolean).join(' | ') || errorMsg;
        } else if (fullData?.error?.message) {
          errorMsg = fullData.error.message;
        }
        console.error(`[SIMPLE] Erro payload completo: ${errorMsg}`);
        return new Response(JSON.stringify({ success: false, error: errorMsg, raw: fullData }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // =====================================================
      // PASSO 1C: Tentar vincular via PUT após criação
      // =====================================================
      console.log(`[SIMPLE] NF-e criada com payload completo. ID: ${nfeId}. Tentando vincular via PUT...`);
      const linked = await tryLinkNfeToPedido(accessToken, nfeId, bling_order_id);
      console.log(`[SIMPLE] Vinculação via PUT: ${linked ? 'SUCESSO' : 'falhou (NF-e continua válida)'}`);
    }

    if (!nfeId) {
      // Herança falhou para não-Penha - retornar erro para frontend usar fallback
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
      message: 'NF-e criada e enviada para SEFAZ',
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
