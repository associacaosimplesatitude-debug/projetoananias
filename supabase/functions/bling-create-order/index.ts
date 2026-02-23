// v2 - deploy fix 2026-02-05
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Estados do Norte e Nordeste que devem usar a integração PE
const ESTADOS_NORTE_NORDESTE = [
  'AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO', // Norte
  'AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE' // Nordeste
];

// Função para determinar qual integração usar baseado no estado
function checkIsNorteNordeste(estado: string | null | undefined): boolean {
  if (!estado) return false;
  return ESTADOS_NORTE_NORDESTE.includes(estado.toUpperCase().trim());
}

// Função para renovar o token do Bling (funciona para ambas as integrações)
async function refreshBlingToken(supabase: any, config: any, tableName: string, clientId: string, clientSecret: string): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log(`[${tableName}] Renovando token do Bling...`);
  
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const tokenResponse = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
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

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || tokenData.error) {
    console.error(`[${tableName}] Erro ao renovar token:`, tokenData);
    throw new Error(tokenData.error_description || 'Erro ao renovar token do Bling');
  }

  // Calcular nova expiração
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  // Atualizar tokens no banco
  const { error: updateError } = await supabase
    .from(tableName)
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', config.id);

  if (updateError) {
    console.error(`[${tableName}] Erro ao salvar tokens:`, updateError);
    throw new Error('Erro ao salvar tokens renovados');
  }

  console.log(`[${tableName}] Token renovado com sucesso! Expira em:`, expiresAt.toISOString());
  return tokenData.access_token;
}

// Função para verificar se o token está expirado ou próximo de expirar
function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  // Considera expirado se faltam menos de 5 minutos
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

// Resolver o ID de uma situação no Bling pelo nome (IDs podem variar por conta)
// Cache global para evitar múltiplas chamadas à API (rate limiting)
let cachedSituacoesLoaded = false;
const cachedSituacaoIdsByName = new Map<string, number>();

async function loadAllSituacoes(accessToken: string): Promise<void> {
  if (cachedSituacoesLoaded) return;
  
  try {
    // ✅ ENDPOINT CORRETO API V3: /situacoes/modulo/{modulo}
    const url = 'https://www.bling.com.br/Api/v3/situacoes/modulo/pedidos_venda';
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const json = await resp.json();

    if (!resp.ok) {
      console.warn('[BLING] Falha ao listar situações.', json);
      return;
    }

    const situacoes: any[] = Array.isArray(json?.data) ? json.data : [];
    
    console.log('[BLING] ===== SITUAÇÕES DISPONÍVEIS NO MÓDULO PEDIDOS_VENDA =====');
    console.log('[BLING] Total de situações:', situacoes.length);
    
    // Cachear TODAS as situações de uma vez
    situacoes.forEach((s) => {
      const nome = String(s?.nome || '').trim().toLowerCase();
      const id = Number(s?.id);
      if (nome && Number.isFinite(id) && id > 0) {
        cachedSituacaoIdsByName.set(nome, id);
        console.log(`[BLING] Situação: ID=${id}, Nome="${s.nome}"`);
      }
    });
    
    console.log('[BLING] ========================================================');
    cachedSituacoesLoaded = true;
    
  } catch (e) {
    console.warn('[BLING] Erro ao carregar situações.', e);
  }
}

async function resolveSituacaoIdByName(accessToken: string, situacaoNome: string): Promise<number | null> {
  const key = String(situacaoNome || '').trim().toLowerCase();
  if (!key) return null;
  
  // Carregar todas as situações na primeira chamada
  if (!cachedSituacoesLoaded) {
    await loadAllSituacoes(accessToken);
  }
  
  // Busca exata
  if (cachedSituacaoIdsByName.has(key)) {
    return cachedSituacaoIdsByName.get(key)!;
  }
  
  // Busca parcial (case-insensitive)
  for (const [cachedName, id] of cachedSituacaoIdsByName.entries()) {
    if (cachedName.includes(key) || key.includes(cachedName)) {
      return id;
    }
  }
  
  return null;
}

async function resolveSituacaoEmAbertoId(accessToken: string): Promise<number> {
  const id = await resolveSituacaoIdByName(accessToken, 'Em aberto');
  return id ?? 9;
}

// IDs fixos da Penha para fallback absoluto
const NATUREZA_PENHA_PF = 15108893128; // Pessoa Física (CPF)
const NATUREZA_PENHA_PJ = 15108893188; // Pessoa Jurídica (CNPJ)

// Resolver ID da natureza de operação padrão - SEMPRE retorna um ID válido
async function resolveNaturezaOperacaoId(accessToken: string, isPessoaFisica: boolean): Promise<number> {
  try {
    const url = 'https://api.bling.com.br/Api/v3/naturezas-operacoes';
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const json = await resp.json();

    if (!resp.ok) {
      console.warn('[BLING] Falha ao listar naturezas de operação, usando fallback Penha');
      return isPessoaFisica ? NATUREZA_PENHA_PF : NATUREZA_PENHA_PJ;
    }

    const naturezas: any[] = Array.isArray(json?.data) ? json.data : [];
    
    console.log('[BLING] Naturezas de operação disponíveis:', {
      total: naturezas.length,
      primeiras5: naturezas.slice(0, 5).map((n) => ({ id: n.id, descricao: n.descricao })),
    });
    
    // Buscar natureza padrão para vendas (geralmente "Venda" ou similar)
    const vendaNatureza = naturezas.find((n) => 
      String(n?.descricao || '').toLowerCase().includes('venda') &&
      !String(n?.descricao || '').toLowerCase().includes('devolução')
    );
    
    if (vendaNatureza?.id) {
      console.log('[BLING] Natureza de operação selecionada:', { id: vendaNatureza.id, descricao: vendaNatureza.descricao });
      return Number(vendaNatureza.id);
    }
    
    // Fallback: usar a primeira natureza disponível
    if (naturezas.length > 0 && naturezas[0]?.id) {
      console.log('[BLING] Usando primeira natureza disponível:', { id: naturezas[0].id, descricao: naturezas[0].descricao });
      return Number(naturezas[0].id);
    }
    
    // Fallback final: IDs fixos da Penha
    console.log('[BLING] Sem naturezas na API, usando fallback Penha:', isPessoaFisica ? 'PF' : 'PJ');
    return isPessoaFisica ? NATUREZA_PENHA_PF : NATUREZA_PENHA_PJ;
  } catch (e) {
    console.warn('[BLING] Erro ao resolver natureza de operação, usando fallback Penha:', e);
    return isPessoaFisica ? NATUREZA_PENHA_PF : NATUREZA_PENHA_PJ;
  }
}

// ✅ NOVA FUNÇÃO: Buscar forma de pagamento "Conta a receber/pagar" para gerar Contas a Receber
let cachedFormaPagamentoContaReceberPagarId: number | null = null;

// ✅ Cache global para TODAS as formas de pagamento do Bling
let cachedFormasPagamentoByName: Map<string, number> | null = null;

async function loadAllFormasPagamento(accessToken: string): Promise<Map<string, number>> {
  if (cachedFormasPagamentoByName !== null) {
    return cachedFormasPagamentoByName;
  }

  cachedFormasPagamentoByName = new Map();

  try {
    const url = 'https://api.bling.com.br/Api/v3/formas-pagamentos';
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const json = await resp.json();

    if (!resp.ok) {
      console.warn('[BLING] Falha ao listar formas de pagamento.', json);
      return cachedFormasPagamentoByName;
    }

    const formasPagamento: any[] = Array.isArray(json?.data) ? json.data : [];
    
    console.log('[BLING] ✅ Carregando todas as formas de pagamento:', {
      total: formasPagamento.length,
    });

    for (const f of formasPagamento) {
      const desc = String(f?.descricao || '').toLowerCase().trim();
      const id = Number(f.id);
      if (desc && Number.isFinite(id) && id > 0) {
        cachedFormasPagamentoByName.set(desc, id);
        console.log(`[BLING] Forma de pagamento: ID=${id}, Descrição="${f.descricao}"`);
        
        // Também cachear "Conta a receber/pagar" se encontrar
        if (desc.includes('conta a receber') || desc.includes('a receber/pagar')) {
          cachedFormaPagamentoContaReceberPagarId = id;
        }
      }
    }

    return cachedFormasPagamentoByName;
  } catch (e) {
    console.warn('[BLING] Erro ao carregar formas de pagamento.', e);
    return cachedFormasPagamentoByName;
  }
}

// ✅ FUNÇÃO: Mapear forma_pagamento_loja para ID do Bling
function resolveFormaPagamentoLojaId(
  forma: string | undefined, 
  bandeira: string | undefined,
  formasMap: Map<string, number>
): number | null {
  if (!forma || formasMap.size === 0) return null;

  // Termos de busca priorizados por forma de pagamento
  const searchTerms: string[] = [];
  
  switch (forma) {
    case 'pix':
      searchTerms.push('pix');
      break;
    case 'dinheiro':
      searchTerms.push('dinheiro');
      break;
    case 'cartao_debito':
      searchTerms.push('débito', 'debito', 'cartão de débito', 'cartao de debito');
      break;
    case 'cartao_credito':
      // Tentar com bandeira específica primeiro
      if (bandeira) {
        const bandeiraLower = bandeira.toLowerCase();
        searchTerms.push(
          `credito ${bandeiraLower}`,
          `crédito ${bandeiraLower}`,
          bandeiraLower
        );
      }
      // Fallback para cartão genérico
      searchTerms.push('crédito', 'credito', 'cartão de crédito', 'cartao de credito');
      break;
  }

  // Buscar primeiro match nas formas disponíveis
  for (const term of searchTerms) {
    for (const [desc, id] of formasMap.entries()) {
      if (desc.includes(term)) {
        console.log(`[BLING] ✅ Forma "${forma}" mapeada para "${desc}" (ID: ${id})`);
        return id;
      }
    }
  }

  console.warn(`[BLING] ⚠️ Forma de pagamento "${forma}" não encontrada no Bling`);
  return null;
}

async function resolveFormaPagamentoContaReceberPagarId(accessToken: string): Promise<number | null> {
  // Se já temos o cache, usar diretamente
  if (cachedFormaPagamentoContaReceberPagarId !== null) {
    return cachedFormaPagamentoContaReceberPagarId;
  }

  // Carregar todas as formas (vai popular o cache de "Conta a receber/pagar" também)
  await loadAllFormasPagamento(accessToken);
  
  if (cachedFormaPagamentoContaReceberPagarId !== null) {
    console.log('[BLING] ✅ Forma de pagamento "Conta a receber/pagar" ENCONTRADA:', cachedFormaPagamentoContaReceberPagarId);
    return cachedFormaPagamentoContaReceberPagarId;
  }

  // Fallback: buscar manualmente no cache
  if (cachedFormasPagamentoByName) {
    for (const [desc, id] of cachedFormasPagamentoByName.entries()) {
      if (desc.includes('conta a receber') || desc.includes('a receber/pagar')) {
        cachedFormaPagamentoContaReceberPagarId = id;
        console.log('[BLING] ✅ Forma de pagamento "Conta a receber/pagar" ENCONTRADA (fallback):', id);
        return id;
      }
    }
  }

  console.warn('[BLING] ⚠️ Forma de pagamento "Conta a receber/pagar" NÃO encontrada');
  return null;
}

// ✅ Cache global para Unidades de Negócio do Bling
let cachedUnidadesNegocioByName: Map<string, number> | null = null;

async function loadAllUnidadesNegocio(accessToken: string): Promise<Map<string, number>> {
  if (cachedUnidadesNegocioByName !== null) {
    return cachedUnidadesNegocioByName;
  }

  cachedUnidadesNegocioByName = new Map();

  try {
    // ✅ ENDPOINT DIRETO: Listar unidades de negócio via API v3
    const url = 'https://www.bling.com.br/Api/v3/empresas';
    console.log(`[BLING] 🔍 Buscando unidades de negócio via endpoint /empresas...`);
    
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.warn(`[BLING] Falha ao buscar empresas/unidades: ${resp.status}`, errorText);
      
      // Fallback: tentar extrair de pedidos existentes
      console.log('[BLING] 🔄 Tentando fallback via pedidos existentes...');
      return await loadUnidadesFromOrders(accessToken);
    }

    const json = await resp.json();
    const empresas: any[] = Array.isArray(json?.data) ? json.data : [];
    
    console.log(`[BLING] ✅ Empresas/Unidades encontradas: ${empresas.length}`);

    for (const empresa of empresas) {
      const id = Number(empresa?.id);
      const nome = String(empresa?.nome || empresa?.razaoSocial || empresa?.descricao || '').trim();
      
      if (nome && Number.isFinite(id) && id > 0) {
        const descLower = nome.toLowerCase();
        cachedUnidadesNegocioByName.set(descLower, id);
        console.log(`[BLING] ✅ Unidade de Negócio: ID=${id}, Nome="${nome}"`);
      }
    }

    // Se não encontrou nada, tentar buscar de lojas
    if (cachedUnidadesNegocioByName.size === 0) {
      console.log('[BLING] 🔄 Nenhuma empresa encontrada, tentando via lojas...');
      
      const lojasUrl = 'https://www.bling.com.br/Api/v3/lojas';
      const lojasResp = await fetch(lojasUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      if (lojasResp.ok) {
        const lojasData = await lojasResp.json();
        const lojas: any[] = Array.isArray(lojasData?.data) ? lojasData.data : [];
        
        console.log(`[BLING] ✅ Lojas encontradas: ${lojas.length}`);
        
        for (const loja of lojas) {
          const unidade = loja?.unidadeNegocio;
          if (unidade?.id && unidade?.descricao) {
            const desc = String(unidade.descricao).toLowerCase().trim();
            if (!cachedUnidadesNegocioByName.has(desc)) {
              cachedUnidadesNegocioByName.set(desc, Number(unidade.id));
              console.log(`[BLING] ✅ Unidade de Negócio (via loja ${loja.descricao}): ID=${unidade.id}, Nome="${unidade.descricao}"`);
            }
          }
        }
      }
    }

    console.log(`[BLING] 📋 Total de unidades encontradas: ${cachedUnidadesNegocioByName.size}`);
    console.log('[BLING] 📋 Unidades mapeadas:', Array.from(cachedUnidadesNegocioByName.entries()));

    return cachedUnidadesNegocioByName;
  } catch (e) {
    console.warn('[BLING] Erro ao carregar unidades de negócio:', e);
    return cachedUnidadesNegocioByName;
  }
}

// Fallback: extrair unidades de pedidos existentes
async function loadUnidadesFromOrders(accessToken: string): Promise<Map<string, number>> {
  try {
    const ordersUrl = 'https://www.bling.com.br/Api/v3/pedidos/vendas?pagina=1&limite=50';
    const ordersResp = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!ordersResp.ok) {
      console.warn('[BLING] Falha ao buscar pedidos para extrair unidades de negócio');
      return cachedUnidadesNegocioByName!;
    }

    const ordersData = await ordersResp.json();
    const orders: any[] = Array.isArray(ordersData?.data) ? ordersData.data : [];
    
    console.log(`[BLING] 🔍 Buscando unidades de negócio em ${orders.length} pedidos...`);

    for (let i = 0; i < Math.min(20, orders.length); i++) {
      const orderId = orders[i]?.id;
      if (!orderId) continue;

      try {
        const detailUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas/${orderId}`;
        const detailResp = await fetch(detailUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });
        
        if (detailResp.ok) {
          const detailData = await detailResp.json();
          
          // Tentar várias estruturas possíveis
          const unidade = detailData?.data?.unidadeNegocio 
            || detailData?.data?.loja?.unidadeNegocio;
          
          if (unidade?.id && (unidade?.descricao || unidade?.nome)) {
            const desc = String(unidade.descricao || unidade.nome).toLowerCase().trim();
            if (!cachedUnidadesNegocioByName!.has(desc)) {
              cachedUnidadesNegocioByName!.set(desc, Number(unidade.id));
              console.log(`[BLING] ✅ Unidade via pedido ${orderId}: ID=${unidade.id}, Nome="${unidade.descricao || unidade.nome}"`);
            }
          }
          
          // Log para debug - ver estrutura do pedido
          if (i === 0) {
            console.log(`[BLING] 🔎 Estrutura do pedido ${orderId}:`, JSON.stringify({
              unidadeNegocio: detailData?.data?.unidadeNegocio,
              loja: detailData?.data?.loja ? { 
                id: detailData.data.loja.id, 
                descricao: detailData.data.loja.descricao,
                unidadeNegocio: detailData.data.loja.unidadeNegocio 
              } : null
            }));
          }
        }
      } catch (e) {
        // Ignorar erros individuais
      }
    }

    console.log(`[BLING] 📋 Total de unidades via pedidos: ${cachedUnidadesNegocioByName!.size}`);
    return cachedUnidadesNegocioByName!;
  } catch (e) {
    console.warn('[BLING] Erro ao buscar unidades via pedidos:', e);
    return cachedUnidadesNegocioByName!;
  }
}

// ✅ FUNÇÃO: Resolver ID da Unidade de Negócio "Penha/Loja Penha"
function resolveUnidadeNegocioPenhaId(unidadesMap: Map<string, number>): number | null {
  if (unidadesMap.size === 0) return null;

  // Termos de busca para encontrar a unidade "Penha"
  const searchTerms = ['loja penha', 'penha', 'polo penha'];
  
  for (const term of searchTerms) {
    for (const [desc, id] of unidadesMap.entries()) {
      if (desc.includes(term)) {
        console.log(`[BLING] ✅ Unidade "Penha" encontrada: "${desc}" (ID: ${id})`);
        return id;
      }
    }
  }

  console.warn('[BLING] ⚠️ Unidade de Negócio "Penha" não encontrada nas unidades disponíveis');
  return null;
}

// ✅ FUNÇÃO: Resolver ID da Unidade de Negócio "Polo Pernambuco / Norte-Nordeste"
function resolveUnidadeNegocioPEId(unidadesMap: Map<string, number>): number | null {
  if (unidadesMap.size === 0) return null;

  // Termos de busca para encontrar a unidade de Pernambuco/Norte-Nordeste
  const searchTerms = ['pernambuco', 'jaboatao', 'polo pe', 'polo jaboatão', 'norte', 'nordeste'];
  
  for (const term of searchTerms) {
    for (const [desc, id] of unidadesMap.entries()) {
      if (desc.includes(term)) {
        console.log(`[BLING] ✅ Unidade "PE/Norte-Nordeste" encontrada: "${desc}" (ID: ${id})`);
        return id;
      }
    }
  }

  console.warn('[BLING] ⚠️ Unidade de Negócio "PE/Norte-Nordeste" não encontrada nas unidades disponíveis');
  return null;
}

// ✅ FUNÇÃO: Resolver ID da Unidade de Negócio "Matriz RJ"
function resolveUnidadeNegocioRJId(unidadesMap: Map<string, number>): number | null {
  if (unidadesMap.size === 0) return null;

  // Termos de busca para encontrar a unidade Matriz RJ
  const searchTerms = ['matriz', 'rio', 'rj', 'centro', 'sede', 'principal'];
  
  for (const term of searchTerms) {
    for (const [desc, id] of unidadesMap.entries()) {
      if (desc.includes(term)) {
        console.log(`[BLING] ✅ Unidade "Matriz RJ" encontrada: "${desc}" (ID: ${id})`);
        return id;
      }
    }
  }

  // Se não encontrou por termo específico, usa a primeira unidade como fallback
  const firstEntry = unidadesMap.entries().next().value;
  if (firstEntry) {
    console.log(`[BLING] ⚠️ Unidade "Matriz RJ" não encontrada, usando primeira unidade: "${firstEntry[0]}" (ID: ${firstEntry[1]})`);
    return firstEntry[1];
  }

  console.warn('[BLING] ⚠️ Nenhuma Unidade de Negócio disponível');
  return null;
}

// ✅ MAPEAMENTO ESTRITO: Email → ID numérico do vendedor no Bling
// Ambas variações de email da Neila estão mapeadas para o mesmo ID.
// Se o email não estiver aqui, o campo vendedor será omitido.
const VENDEDOR_EMAIL_TO_BLING_ID: Record<string, number> = {
  'neila.lima@editoracentralgospel.com': 15596550898,
  'neila.lima@editoracentraglospel.com': 15596550898, // variação com typo
  'daniel.sousa@editoracentralgospel.com': 15596329684,
  'elaine.ribeiro@editoracentralgospel.com': 15596096564,
  'glorinha21carreiro@gmail.com': 15596422682,
  'ivani.santos@editoracentralgospel.com': 15596392965,
  'nilson.curitibasp@gmail.com': 15596336493,
  'antonio.goulart@editoracentralgospel.com': 15596422684,
  'vendedorteste@gmail.com': 15596840637,
};

// ✅ FUNÇÃO SIMPLIFICADA: Retorna ID numérico ou null (sem fallback de nome)
function resolveVendedorIdByEmail(email: string): number | null {
  if (!email) {
    console.warn('[BLING] ⚠️ Email do vendedor não fornecido - omitindo campo vendedor');
    return null;
  }

  const emailNormalizado = email.toLowerCase().trim();
  const vendedorId = VENDEDOR_EMAIL_TO_BLING_ID[emailNormalizado] ?? null;

  if (vendedorId !== null) {
    console.log('[BLING] Enviando Pedido com Vendedor ID:', vendedorId);
  } else {
    console.warn('[BLING] ⚠️ Email não encontrado no mapeamento:', emailNormalizado, '- omitindo campo vendedor');
  }

  return vendedorId;
}



serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // ============================================================
    // DEBUG: LOGAR PAYLOAD DE ENTRADA
    // ============================================================
    console.log("[INPUT_KEYS]", Object.keys(body || {}));
    console.log("[INPUT_CLIENTE_KEYS]", Object.keys(body?.cliente || {}));
    console.log("[INPUT_CLIENTE]", JSON.stringify({
      nome: body?.cliente?.nome,
      email: body?.cliente?.email,
      cpf: body?.cliente?.cpf,
      cpf_cnpj: body?.cliente?.cpf_cnpj,
      cpfCnpj: body?.cliente?.cpfCnpj,
      documento: body?.cliente?.documento,
      numeroDocumento: body?.cliente?.numeroDocumento,
      tipoPessoa: body?.cliente?.tipoPessoa,
    }, null, 2));
    console.log("[INPUT_ENDERECO]", JSON.stringify({
      ...body?.endereco_entrega,
      etiqueta_cpf: body?.transporte?.etiqueta?.numeroDocumento,
    }, null, 2));
    
    const { 
      cliente,          // Dados do cliente do formulário (nome, sobrenome, cpf_cnpj, email, telefone)
      endereco_entrega, // Endereço de entrega do checkout (rua, numero, complemento, bairro, cep, cidade, estado)
      itens,            // Itens com preço de lista (preco_cheio) e preço com desconto (valor)
      pedido_id,
      valor_frete,
      metodo_frete,     // PAC, SEDEX, FREE, manual, retirada_penha
      forma_pagamento,  // PIX, CARTAO, BOLETO, FATURAMENTO, pagamento_loja
      faturamento_prazo, // 30, 60 ou 90 (apenas para FATURAMENTO)
      valor_produtos,   // Total dos produtos com desconto
      valor_total,      // Total final (produtos + frete)
      vendedor_nome,    // Vendor name for Bling (legacy - agora usamos vendedor_email)
      vendedor_email,   // ✅ Email do vendedor logado - usado para buscar ID no Bling
      desconto_percentual, // Discount percentage applied
      // Dados de frete manual
      frete_tipo,           // 'automatico' ou 'manual'
      frete_transportadora, // Nome da transportadora (apenas para frete manual)
      frete_observacao,     // Observação interna sobre o frete manual
      // Dados de pagamento na loja (Loja Penha)
      forma_pagamento_loja, // pix, dinheiro, cartao_debito, cartao_credito
      bandeira_cartao,      // visa, mastercard, elo, etc.
      parcelas_cartao,      // 1 a 10 (apenas para crédito)
      deposito_origem,      // local, matriz, pernambuco
      origem,               // shopify_mercadopago, webhook, manual, etc.
    } = body;

    if (!cliente || !itens || itens.length === 0) {
      throw new Error('Dados do cliente e itens são obrigatórios');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determinar qual integração usar baseado no estado de entrega
    const estadoEntrega = endereco_entrega?.estado?.toUpperCase()?.trim() || '';
    const usarIntegracaoPE = checkIsNorteNordeste(estadoEntrega);
    
    console.log(`Estado de entrega: ${estadoEntrega} - Usar integração PE: ${usarIntegracaoPE}`);

    // Buscar configuração da integração correta
    let config: any;
    let configTableName: string;
    let clientId: string;
    let clientSecret: string;

    if (usarIntegracaoPE) {
      // Usar integração de Pernambuco para Norte/Nordeste
      configTableName = 'bling_config_pe';
      clientId = Deno.env.get('BLING_CLIENT_ID_PE') || '';
      clientSecret = Deno.env.get('BLING_CLIENT_SECRET_PE') || '';
      
      const { data: configPE, error: configErrorPE } = await supabase
        .from('bling_config_pe')
        .select('*')
        .single();
      
      if (configErrorPE || !configPE) {
        console.warn('Configuração PE não encontrada, usando RJ como fallback');
        // Fallback para RJ se PE não estiver configurado
        configTableName = 'bling_config';
        const { data: configRJ, error: configErrorRJ } = await supabase
          .from('bling_config')
          .select('*')
          .single();
        
        if (configErrorRJ || !configRJ) {
          throw new Error('Nenhuma configuração do Bling encontrada');
        }
        config = configRJ;
        clientId = config.client_id;
        clientSecret = config.client_secret;
      } else {
        config = configPE;
        // Se PE não tiver token ainda, usar credenciais dos secrets
        if (!clientId || !clientSecret) {
          clientId = config.client_id || '';
          clientSecret = config.client_secret || '';
        }
      }
    } else {
      // Usar integração RJ padrão
      configTableName = 'bling_config';
      const { data: configRJ, error: configErrorRJ } = await supabase
        .from('bling_config')
        .select('*')
        .single();
      
      if (configErrorRJ || !configRJ) {
        throw new Error('Configuração não encontrada');
      }
      config = configRJ;
      clientId = config.client_id;
      clientSecret = config.client_secret;
    }

    console.log(`Usando integração: ${configTableName}`);

    if (!config.access_token) {
      throw new Error(`Token de acesso não configurado para ${configTableName}`);
    }

    // Verificar se o token está expirado e renovar se necessário
    let accessToken = config.access_token;
    if (isTokenExpired(config.token_expires_at)) {
      console.log(`Token expirado ou próximo de expirar para ${configTableName}, renovando...`);
      accessToken = await refreshBlingToken(supabase, config, configTableName, clientId, clientSecret);
    }

    // IDs de situações podem variar por conta.
    // - padrão: "Em aberto"
    // - B2B faturamento: se existir, usar "Aprovada B2B" (que você criou no Bling)
    // - Pagar na loja (Glorinha): usar "Atendido" (já foi pago)
    const isFaturamentoPagamento = forma_pagamento?.toLowerCase() === 'faturamento';
    const isPagamentoLoja = forma_pagamento === 'pagamento_loja';
    // ✅ Pedidos Mercado Pago já pagos devem ir como "Em andamento"
    const isMercadoPagoPago = origem === 'shopify_mercadopago';

    // ✅ DESCOBERTA DINÂMICA DE SITUAÇÕES - API V3
    // Primeiro, listar os MÓDULOS disponíveis para encontrar o ID correto de pedidos_venda
    let todasSituacoes: any[] = [];
    let moduloIdVendas: number | null = null;
    
    try {
      // 1) Primeiro, listar todos os módulos que possuem situações
      const urlModulos = 'https://www.bling.com.br/Api/v3/situacoes/modulos';
      console.log('[BLING] Buscando módulos em:', urlModulos);
      const respModulos = await fetch(urlModulos, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      const jsonModulos = await respModulos.json();
      console.log('[BLING] Resposta módulos:', JSON.stringify(jsonModulos));
      
      const modulos = Array.isArray(jsonModulos?.data) ? jsonModulos.data : [];
      console.log('[BLING] ========== MÓDULOS COM SITUAÇÕES ==========');
      modulos.forEach((m: any) => {
        console.log(`[BLING] Módulo: ID=${m.id}, Nome="${m.nome}", Descrição="${m.descricao}"`);
        // Identificar módulo de pedidos de venda
        const nomeNorm = String(m.nome || m.descricao || '').toLowerCase();
        if (nomeNorm.includes('venda') || nomeNorm.includes('pedido') || nomeNorm === 'pedidos_venda') {
          moduloIdVendas = m.id;
        }
      });
      console.log('[BLING] Módulo de Vendas encontrado: ID =', moduloIdVendas);
      console.log('[BLING] =============================================');

      // 2) Se encontramos o módulo, buscar suas situações
      if (moduloIdVendas) {
        const urlSituacoes = `https://www.bling.com.br/Api/v3/situacoes/modulos/${moduloIdVendas}`;
        console.log('[BLING] Buscando situações do módulo em:', urlSituacoes);
        const respSituacoes = await fetch(urlSituacoes, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });
        const jsonSituacoes = await respSituacoes.json();
        console.log('[BLING] Resposta situações módulo:', JSON.stringify(jsonSituacoes));
        
        // A resposta pode ter data.situacoes ou apenas data como array
        todasSituacoes = Array.isArray(jsonSituacoes?.data?.situacoes) 
          ? jsonSituacoes.data.situacoes 
          : (Array.isArray(jsonSituacoes?.data) ? jsonSituacoes.data : []);
      }
      
      // 3) Se não funcionou, tentar endpoint alternativo direto
      if (todasSituacoes.length === 0) {
        const urlAlt = 'https://www.bling.com.br/Api/v3/situacoes';
        console.log('[BLING] Tentando endpoint alternativo:', urlAlt);
        const respAlt = await fetch(urlAlt, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });
        const jsonAlt = await respAlt.json();
        console.log('[BLING] Resposta endpoint alternativo:', JSON.stringify(jsonAlt));
        todasSituacoes = Array.isArray(jsonAlt?.data) ? jsonAlt.data : [];
      }
      
      console.log('[BLING] ========== TODAS AS SITUAÇÕES DISPONÍVEIS ==========');
      console.log('[BLING] Total de situações:', todasSituacoes.length);
      todasSituacoes.forEach((s: any) => {
        console.log(`[BLING] Situação: ID=${s.id}, Nome="${s.nome}", Cor="${s.cor}"`);
      });
      console.log('[BLING] =====================================================');
    } catch (e) {
      console.warn('[BLING] Erro ao listar situações:', e);
    }

    // Buscar situação "Em aberto" (padrão) - geralmente é a primeira ou tem nome específico
    let situacaoEmAbertoId = await resolveSituacaoIdByName(accessToken, 'Em aberto');
    
    // Se não encontrou "Em aberto", usar a primeira situação disponível
    if (!situacaoEmAbertoId && todasSituacoes.length > 0) {
      situacaoEmAbertoId = todasSituacoes[0].id;
      console.log('[BLING] Usando primeira situação como fallback:', situacaoEmAbertoId);
    }
    
    // Fallback final se nenhuma situação foi encontrada
    if (!situacaoEmAbertoId) {
      situacaoEmAbertoId = 9; // fallback antigo
      console.log('[BLING] Usando fallback hardcoded: 9');
    }

    // Para B2B faturamento, buscar situação "Em andamento"
    // Carregar todas as situações UMA VEZ antes de buscar
    await loadAllSituacoes(accessToken);
    
    // Buscar "Em andamento" no cache (já carregado)
    let situacaoEmAndamentoId = cachedSituacaoIdsByName.get('em andamento') || null;
    
    // Se não encontrou no cache, usar fallback hardcoded (ID da conta Central Gospel)
    if (!situacaoEmAndamentoId) {
      // ID 15 é "Em andamento" na conta Central Gospel
      situacaoEmAndamentoId = 15;
      console.log('[BLING] ⚠️ Usando fallback hardcoded para "Em andamento": ID 15');
    } else {
      console.log(`[BLING] ✅ Situação "Em andamento" encontrada no cache com ID: ${situacaoEmAndamentoId}`);
    }
    
    console.log('[BLING DEBUG] Situação "Em andamento" encontrada com ID:', situacaoEmAndamentoId);

    // Buscar "Atendido" no cache para pagamento na loja (Glorinha)
    let situacaoAtendidoId = cachedSituacaoIdsByName.get('atendido') || null;
    
    // Se não encontrou no cache, usar fallback hardcoded (ID 9 é comum para "Atendido")
    if (!situacaoAtendidoId) {
      situacaoAtendidoId = 9;
      console.log('[BLING] ⚠️ Usando fallback hardcoded para "Atendido": ID 9');
    } else {
      console.log(`[BLING] ✅ Situação "Atendido" encontrada no cache com ID: ${situacaoAtendidoId}`);
    }

    // ✅ Buscar "Aprovado" no cache para pedidos Mercado Pago
    let situacaoAprovadoId = cachedSituacaoIdsByName.get('aprovado') || 
                             cachedSituacaoIdsByName.get('aprovada') || 
                             null;
    
    if (situacaoAprovadoId) {
      console.log(`[BLING] ✅ Situação "Aprovado" encontrada no cache com ID: ${situacaoAprovadoId}`);
    } else {
      console.log('[BLING] ⚠️ Situação "Aprovado" não encontrada, usando "Em andamento" como fallback para Mercado Pago');
    }
    
    // ✅ REGRA: Pagamento na Loja → "Em andamento" (será atualizado para "Atendido" APÓS gerar NF-e)
    // CORREÇÃO: Não usar "Atendido" como situação inicial para pagamento_loja,
    // pois impede a herança simples na geração de NF-e (o "V" laranja não aparece)
    const situacaoInicialId = isPagamentoLoja 
      ? (situacaoEmAndamentoId || situacaoEmAbertoId)  // Pagar na Loja → "Em andamento" (Atendido será após NF-e)
      : isFaturamentoPagamento 
        ? (situacaoEmAndamentoId || situacaoEmAbertoId)  // Faturamento → "Em andamento"
        : situacaoEmAbertoId;  // PIX/Cartão/Boleto → "Em aberto"
    
    console.log('[BLING] Situação inicial selecionada:', situacaoInicialId, 
      isPagamentoLoja ? '(Pagamento na Loja → Em andamento, Atendido será após NF-e)' :
      isFaturamentoPagamento ? '(Faturamento → Em andamento)' : '(Pagamento direto → Em aberto)');
    
    // ✅ NATUREZA DE OPERAÇÃO - SEMPRE retorna ID válido
    // Determinar tipo de pessoa (PF vs PJ) para seleção correta
    const documentoCliente = (cliente?.cpf_cnpj || cliente?.cpf || cliente?.documento || '').replace(/\D/g, '');
    const isPessoaFisica = documentoCliente.length <= 11;
    
    // ✅ DETECÇÃO EXPLÍCITA DE ROTA PENHA - ANTES de resolver natureza
    // Penha = retirada_penha OU pagamento_loja com deposito_origem === 'local'
    const isRotaPenha = (
      metodo_frete === 'retirada_penha' ||
      (forma_pagamento === 'pagamento_loja' && deposito_origem === 'local')
    );
    
    console.log('[ROUTING_FISCAL] Detecção de rota:', {
      metodo_frete,
      forma_pagamento,
      deposito_origem,
      isRotaPenha,
      isPessoaFisica,
      docLen: documentoCliente.length,
    });
    
    // ✅ NATUREZA FIXA PARA PENHA (override obrigatório)
    let naturezaOperacaoId: number;
    if (isRotaPenha) {
      // IDs fixos da Penha - não usar API, forçar diretamente
      naturezaOperacaoId = isPessoaFisica ? NATUREZA_PENHA_PF : NATUREZA_PENHA_PJ;
      console.log(`[ROUTING_FISCAL] ✅ PENHA DETECTADA - Natureza FORÇADA: ${naturezaOperacaoId} (${isPessoaFisica ? 'PF' : 'PJ'})`);
    } else {
      // Pedido normal - usar resolução padrão (ainda com fallback Penha se API falhar)
      naturezaOperacaoId = await resolveNaturezaOperacaoId(accessToken, isPessoaFisica);
      console.log('[BLING] ✅ Natureza de operação via API:', naturezaOperacaoId, isPessoaFisica ? '(PF)' : '(PJ)');
    }

    // ✅ FORMA DE PAGAMENTO - Buscar ID de "Conta a receber/pagar" para gerar Contas a Receber
    const formaPagamentoContaReceberPagarId = await resolveFormaPagamentoContaReceberPagarId(accessToken);
    console.log('[BLING] ✅ ID da forma de pagamento "Conta a receber/pagar":', formaPagamentoContaReceberPagarId);

    // ✅ VENDEDOR - Sempre enviar apenas { id: number } (API V3)
    // Prioridade do email para mapear:
    // 1) vendedor_email recebido no payload (quem criou o pedido)
    // 2) buscar na tabela vendedor_propostas via pedido_id (quando pedido_id = proposta.id)
    // 3) email do usuário logado (JWT) (último recurso; pode ser o aprovador)
    let vendedorIdBling: number | null = null;

    // 1) Payload
    let vendedorEmailFinal: string | null = vendedor_email || null;

    // 2) DB fallback por pedido/proposta
    if (!vendedorEmailFinal && pedido_id) {
      try {
        const { data: propostaVendedor, error: propostaVendedorError } = await supabase
          .from('vendedor_propostas')
          .select('id, vendedor_id, vendedor_nome, vendedor:vendedores(email)')
          .eq('id', pedido_id)
          .maybeSingle();

        if (propostaVendedorError) {
          console.warn('[BLING] Falha ao buscar vendedor na proposta para fallback de email:', propostaVendedorError);
        } else {
          vendedorEmailFinal = (propostaVendedor as any)?.vendedor?.email || null;
          console.log('[BLING] Fallback vendedor_email via vendedor_propostas:', {
            pedido_id,
            vendedor_id: (propostaVendedor as any)?.vendedor_id,
            vendedor_nome: (propostaVendedor as any)?.vendedor_nome,
            vendedor_email: vendedorEmailFinal,
          });
        }
      } catch (e) {
        console.warn('[BLING] Erro inesperado ao fazer fallback de vendedor_email:', e);
      }
    }

    // 3) JWT (último recurso)
    if (!vendedorEmailFinal) {
      try {
        const authHeader = req.headers.get('Authorization') || '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        if (!authHeader) {
          console.warn('[BLING] ⚠️ Authorization header ausente; não foi possível identificar o usuário logado.');
        } else if (!anonKey) {
          console.warn('[BLING] ⚠️ SUPABASE_ANON_KEY ausente; não foi possível identificar o usuário logado.');
        } else {
          const supabaseAuth = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
            auth: { persistSession: false },
          });

          const { data: userRes, error: userErr } = await supabaseAuth.auth.getUser();
          if (userErr) {
            console.warn('[BLING] ⚠️ Falha ao obter usuário logado:', userErr);
          } else {
            vendedorEmailFinal = userRes?.user?.email || null;
          }
        }
      } catch (e) {
        console.warn('[BLING] ⚠️ Erro inesperado ao obter email do usuário logado:', e);
      }
    }

    if (vendedorEmailFinal) {
      vendedorIdBling = resolveVendedorIdByEmail(vendedorEmailFinal);
      console.log('[BLING] Vendedor Email (selecionado para mapeamento):', vendedorEmailFinal);
    } else {
      console.warn('[BLING] ⚠️ Não foi possível determinar o email do vendedor; omitindo campo vendedor');
    }

    // ✅ LOG DE DEBUG OBRIGATÓRIO - Mostra situações disponíveis e qual foi selecionada
    console.log('[BLING DEBUG] ==============================================');
    console.log('[BLING DEBUG] DESCOBERTA DINÂMICA DE SITUAÇÃO - API V3');
    console.log('[BLING DEBUG] ==============================================');
    console.log('[BLING DEBUG] Forma de Pagamento:', forma_pagamento);
    console.log('[BLING DEBUG] É Faturamento B2B:', isFaturamentoPagamento);
    console.log('[BLING DEBUG] Situação "Em andamento" encontrada com ID:', situacaoEmAndamentoId);
    console.log('[BLING DEBUG] Situação "Em Aberto" ID (fallback):', situacaoEmAbertoId);
    console.log('[BLING DEBUG] >>> SITUAÇÃO FINAL SELECIONADA: ID =', situacaoInicialId, '<<<');
    console.log('[BLING DEBUG] Natureza de Operação ID:', naturezaOperacaoId);
    console.log('[BLING DEBUG] Vendedor Email (payload):', vendedor_email, '| Vendedor Email (final):', vendedorEmailFinal, '| Vendedor Bling ID:', vendedorIdBling);
    console.log('[BLING DEBUG] ==============================================');
    
    console.log('[BLING] Payload situacao e naturezaOperacao:', {
      isFaturamentoPagamento,
      situacaoEmAndamentoId,
      situacaoEmAbertoId,
      situacaoInicialId,
      naturezaOperacaoId,
      payloadSituacao: { id: situacaoInicialId },
      payloadNaturezaOperacao: naturezaOperacaoId ? { id: naturezaOperacaoId } : null,
    });

    // ============================================================
    // GESTÃO DE CONTATO NO BLING - GARANTIR CPF/CNPJ E ENDEREÇO COMPLETO
    // ============================================================
    // REGRA: O contato DEVE ter CPF/CNPJ preenchido e endereço com número
    // para que a NF possa ser emitida sem pendências cadastrais.
    // ============================================================
    
    // 1) SEMPRE buscar CPF/CNPJ no banco (public.ebd_clientes) usando contato.id (UUID do nosso sistema)
    const contatoSistemaId: string | null = body?.contato?.id || cliente?.id || body?.cliente_id || null;

    if (!contatoSistemaId) {
      console.warn('[DOC_DB] contatoSistemaId ausente no request (body.contato.id / cliente.id / body.cliente_id).');
    }

    const maskLast4 = (v: string) => {
      const digits = String(v || '').replace(/\D/g, '');
      if (!digits) return '';
      const last4 = digits.slice(-4);
      return `***${last4}`;
    };

    const isAllSameDigits = (s: string) => /^([0-9])\1+$/.test(s);

    // Validação real (checksum) — o Bling rejeita CPF/CNPJ inválidos mesmo com tamanho correto.
    const isValidCPF = (cpf: string) => {
      const v = String(cpf || '').replace(/\D/g, '');
      if (v.length !== 11) return false;
      if (isAllSameDigits(v)) return false;

      let sum = 0;
      for (let i = 0; i < 9; i++) sum += Number(v[i]) * (10 - i);
      let d1 = (sum * 10) % 11;
      if (d1 === 10) d1 = 0;
      if (d1 !== Number(v[9])) return false;

      sum = 0;
      for (let i = 0; i < 10; i++) sum += Number(v[i]) * (11 - i);
      let d2 = (sum * 10) % 11;
      if (d2 === 10) d2 = 0;
      if (d2 !== Number(v[10])) return false;

      return true;
    };

    const isValidCNPJ = (cnpj: string) => {
      const v = String(cnpj || '').replace(/\D/g, '');
      if (v.length !== 14) return false;
      if (isAllSameDigits(v)) return false;

      const calc = (baseLen: number) => {
        const weights = baseLen === 12
          ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
          : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

        let sum = 0;
        for (let i = 0; i < baseLen; i++) sum += Number(v[i]) * weights[i];
        const mod = sum % 11;
        return mod < 2 ? 0 : 11 - mod;
      };

      const d1 = calc(12);
      const d2 = calc(13);
      return d1 === Number(v[12]) && d2 === Number(v[13]);
    };

    let clienteDb: any = null;

    if (contatoSistemaId) {
      const { data, error } = await supabase
        .from('ebd_clientes')
        .select('cpf, cnpj, possui_cnpj, nome_igreja, telefone, email_superintendente, nome_responsavel')
        .eq('id', contatoSistemaId)
        .maybeSingle();

      if (error) {
        console.error('[DOC_DB] erro ao buscar cliente no banco:', error);
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar cliente no banco.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      clienteDb = data;
    }

    const possuiCnpj = Boolean(clienteDb?.possui_cnpj);
    const rawDocDb = possuiCnpj ? clienteDb?.cnpj : clienteDb?.cpf;
    const documento = String(rawDocDb || '').replace(/\D/g, '');
    const tipoPessoa = possuiCnpj ? 'J' : 'F';

    // LOGS obrigatórios
    console.log(`[DOC_DB] contatoId=${contatoSistemaId} possui_cnpj=${possuiCnpj} cpf=${maskLast4(clienteDb?.cpf)} cnpj=${maskLast4(clienteDb?.cnpj)}`);
    console.log(`[DOC_CHECK] docLen=${documento.length} docMasked=${maskLast4(documento)}`);

    // Validar: tamanho + checksum
    const expectedLen = possuiCnpj ? 14 : 11;
    const okLen = Boolean(documento) && documento.length === expectedLen;
    const okChecksum = possuiCnpj ? isValidCNPJ(documento) : isValidCPF(documento);

    if (!okLen || !okChecksum) {
      return new Response(
        JSON.stringify({ error: 'Cliente sem CPF/CNPJ válido no banco. Abra o cadastro e salve novamente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Nome (preferir nome_igreja do banco)
    const nomeCompleto = (clienteDb?.nome_igreja || '').trim() || (
      cliente.sobrenome ? `${cliente.nome} ${cliente.sobrenome}`.trim() : (cliente.nome || '').trim()
    );

    if (!nomeCompleto) {
      console.error('[CONTATO] ERRO: Nome do cliente não fornecido');
      throw new Error('Nome do cliente é obrigatório');
    }

    // 2) Sanitizar endereço - NÚMERO nunca pode ficar vazio
    const enderecoNumero = (endereco_entrega?.numero || '').toString().trim() || 'S/N';
    const enderecoCep = (endereco_entrega?.cep || '').replace(/\D/g, '');

    console.log(`[CONTATO] Endereço: rua="${endereco_entrega?.rua}" numero="${enderecoNumero}" cep="${enderecoCep}"`);

    // 3) Montar payload do contato com todos os campos obrigatórios
    const contatoPayloadCompleto: any = {
      nome: nomeCompleto,
      tipo: tipoPessoa,
      numeroDocumento: documento, // CPF/CNPJ vindo do banco
      email: clienteDb?.email_superintendente || cliente.email || '',
      telefone: String(clienteDb?.telefone || cliente.telefone || '').replace(/\D/g, ''),
      situacao: 'A',
      endereco: {
        geral: {
          endereco: endereco_entrega?.rua || '',
          numero: enderecoNumero,
          complemento: endereco_entrega?.complemento || '',
          bairro: endereco_entrega?.bairro || '',
          cep: enderecoCep,
          municipio: endereco_entrega?.cidade || '',
          uf: (endereco_entrega?.estado || '').toUpperCase(),
          pais: 'Brasil',
        },
      },
    };

    // IE para pessoa jurídica (se fornecido)
    if (tipoPessoa === 'J' && cliente.ie) {
      contatoPayloadCompleto.ie = cliente.ie.replace(/\D/g, '');
    }

    console.log('[CONTATO] Payload completo:', JSON.stringify(contatoPayloadCompleto, null, 2));

    
    // 4) Tentar localizar contato existente no Bling pelo CPF/CNPJ
    let contatoId: number | null = null;
    let contatoEncontrado = false;
    let contatoPrecisaAtualizar = false;
    
    // Delay para respeitar rate limit
    const delayContato = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    await delayContato(350);
    
    // Buscar por numeroDocumento no Bling
    console.log(`[CONTATO] Buscando contato existente por CPF/CNPJ: ${documento}`);
    const searchUrl = `https://www.bling.com.br/Api/v3/contatos?numeroDocumento=${documento}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    
    const searchResult = await searchResponse.json();
    
    if (searchResponse.ok && searchResult.data && searchResult.data.length > 0) {
      // Encontrou contato existente
      const contatoExistente = searchResult.data[0];
      contatoId = contatoExistente.id;
      contatoEncontrado = true;
      
      console.log(`[CONTATO] contato encontrado? sim - ID=${contatoId}`);
      
      // Buscar detalhes completos do contato para verificar campos
      await delayContato(350);
      const detailUrl = `https://www.bling.com.br/Api/v3/contatos/${contatoId}`;
      const detailResponse = await fetch(detailUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      if (detailResponse.ok) {
        const detailData = await detailResponse.json();
        const contatoDetalhado = detailData?.data || {};
        
        // Verificar se falta CPF/CNPJ ou campos essenciais do endereço
        const docAtual = (contatoDetalhado.numeroDocumento || '').replace(/\D/g, '');
        const enderecoAtual = contatoDetalhado.endereco?.geral || contatoDetalhado.endereco || {};

        const numeroAtual = (enderecoAtual.numero || '').toString().trim();
        const cepAtual = String(enderecoAtual.cep || '').replace(/\D/g, '');
        const ufAtual = String(enderecoAtual.uf || '').toUpperCase().trim();
        const municipioAtual = String(enderecoAtual.municipio || '').trim();
        const ruaAtual = String(enderecoAtual.endereco || '').trim();
        const bairroAtual = String(enderecoAtual.bairro || '').trim();

        const enderecoIncompleto =
          !ruaAtual ||
          !numeroAtual ||
          !bairroAtual ||
          !municipioAtual ||
          !ufAtual ||
          cepAtual.length < 8;

        console.log(
          `[CONTATO] Dados atuais: cpfCnpj="${docAtual}" rua="${ruaAtual}" numero="${numeroAtual}" bairro="${bairroAtual}" municipio="${municipioAtual}" uf="${ufAtual}" cepLen=${cepAtual.length}`,
        );

        // Precisa atualizar se:
        // - CPF/CNPJ está vazio ou diferente
        // - Qualquer campo essencial do endereço está faltando
        if (!docAtual || docAtual !== documento || enderecoIncompleto) {
          contatoPrecisaAtualizar = true;
          console.log(
            `[CONTATO] Contato precisa atualização: docFaltando=${!docAtual || docAtual !== documento} enderecoIncompleto=${enderecoIncompleto}`,
          );
        }
      }
    } else {
      console.log(`[CONTATO] contato encontrado? nao`);
    }
    
    // 5) Criar ou Atualizar contato conforme necessário
    if (!contatoEncontrado) {
      // Criar novo contato
      console.log('[CONTATO] Criando novo contato no Bling...');
      await delayContato(350);
      
      const createResponse = await fetch('https://www.bling.com.br/Api/v3/contatos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(contatoPayloadCompleto),
      });
      
      const createResult = await createResponse.json();
      
      if (createResponse.ok && createResult.data?.id) {
        contatoId = createResult.data.id;
        console.log(`[CONTATO] criado id=${contatoId}`);
      } else {
        // Se erro de duplicidade, tentar buscar novamente
        console.log('[CONTATO] Erro ao criar:', JSON.stringify(createResult));
        
        // Tentar busca alternativa por nome
        if (createResult.error?.fields || createResult.error?.type === 'VALIDATION_ERROR') {
          console.log('[CONTATO] Tentando busca alternativa por nome...');
          await delayContato(350);
          
          const altSearchUrl = `https://www.bling.com.br/Api/v3/contatos?pesquisa=${encodeURIComponent(nomeCompleto.substring(0, 30))}`;
          const altSearchResponse = await fetch(altSearchUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });
          
          const altSearchResult = await altSearchResponse.json();
          if (altSearchResponse.ok && altSearchResult.data && altSearchResult.data.length > 0) {
            // Procurar match exato de nome ou documento
            const matchExato = altSearchResult.data.find((c: any) => {
              const docMatch = (c.numeroDocumento || '').replace(/\D/g, '') === documento;
              const nomeMatch = (c.nome || '').toLowerCase().trim() === nomeCompleto.toLowerCase().trim();
              return docMatch || nomeMatch;
            });
            
            if (matchExato) {
              contatoId = matchExato.id;
              contatoEncontrado = true;
              contatoPrecisaAtualizar = true; // Forçar atualização para garantir dados completos
              console.log(`[CONTATO] Encontrado via busca alternativa id=${contatoId}`);
            }
          }
        }
        
        // Se ainda não encontrou, lançar erro (CPF/CNPJ é obrigatório)
        if (!contatoId) {
          console.error('[CONTATO] ERRO CRÍTICO: Não foi possível criar contato no Bling');
          throw new Error('Falha ao criar contato no Bling. Verifique os dados do cliente.');
        }
      }
    }
    
    // 6) Atualizar contato se necessário
    if (contatoId && contatoPrecisaAtualizar) {
      console.log(`[CONTATO] Atualizando contato id=${contatoId} com dados completos...`);
      await delayContato(350);
      
      const updateResponse = await fetch(`https://www.bling.com.br/Api/v3/contatos/${contatoId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(contatoPayloadCompleto),
      });
      
      if (updateResponse.ok) {
        console.log(`[CONTATO] atualizado id=${contatoId}`);
      } else {
        const updateError = await updateResponse.json();
        console.warn('[CONTATO] Falha ao atualizar (continuando):', JSON.stringify(updateError));
      }
    }
    
    // LOG OBRIGATÓRIO: ID final do contato
    console.log(`[CONTATO] FINAL: contatoId=${contatoId}`);
    
    if (!contatoId) {
      throw new Error('Contato não foi criado/encontrado no Bling. CPF/CNPJ é obrigatório para emissão de NF.');
    }

    // Gerar identificadores únicos
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Calcular desconto total da venda
    let descontoTotalVenda = 0;
    
    // Helper: delay para respeitar rate limit do Bling (3 req/s)
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // Helper: fetch com retry automático para 429
    async function blingFetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await fetch(url, options);
        if (response.status === 429) {
          const waitTime = attempt * 1000; // 1s, 2s, 3s
          console.log(`Rate limit atingido (429). Aguardando ${waitTime}ms antes de tentar novamente (tentativa ${attempt}/${maxRetries})...`);
          await delay(waitTime);
          continue;
        }
        return response;
      }
      // Última tentativa sem retry
      return fetch(url, options);
    }

    // ============================================================
    // ROTEAMENTO POR UF - LOJA FIXA, UNIDADE DE NEGÓCIO VARIÁVEL
    // ============================================================
    // Regra de negócio:
    // - Norte/Nordeste (AC,AP,AM,PA,RO,RR,TO,MA,PI,CE,RN,PB,PE,AL,SE,BA): 
    //   loja.id = 205797806, loja.unidadeNegocio.id = 1, Depósito = BLING_DEPOSITO_ID_PERNAMBUCO
    // - Demais regiões (Centro-Oeste, Sudeste, Sul):
    //   loja.id = 205797806, loja.unidadeNegocio.id = 2, Depósito = BLING_DEPOSITO_ID_GERAL
    // ============================================================
    
    const UFS_NORTE_NORDESTE = ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO', 'MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'];
    
    // ============================================================
    // CONFIGURAÇÃO DE IDs FIXOS (por região/ponto de retirada)
    // ============================================================
    // Norte/Nordeste -> Loja Pernambuco: 205882190
    // Demais regiões -> Loja FATURADOS: 205797806
    // Polo Penha -> Loja POLO PENHA: 205891152
    // Loja Penha PDV -> Loja LOJA PENHA: 205441191 (pagamento presencial)
    const BLING_LOJA_PERNAMBUCO_ID = 205882190;
    const BLING_LOJA_FATURADOS_ID = 205797806;
    const BLING_LOJA_PENHA_ID = 205891152;
    const BLING_LOJA_PENHA_PDV_ID = 205441191; // Canal de vendas para pagamentos presenciais
    
    // ✅ BUSCA DINÂMICA de Unidades de Negócio via API
    // Não usa mais IDs hardcoded - resolve dinamicamente pela API do Bling
    console.log('[BLING] 🔍 Buscando Unidades de Negócio via API...');
    const unidadesNegocioMap = await loadAllUnidadesNegocio(accessToken);
    
    console.log(`[BLING] 📋 Total de unidades encontradas: ${unidadesNegocioMap.size}`);
    if (unidadesNegocioMap.size > 0) {
      for (const [desc, id] of unidadesNegocioMap.entries()) {
        console.log(`[BLING] 📋 Unidade disponível: "${desc}" (ID: ${id})`);
      }
    }

    // ✅ Resolver dinamicamente TODAS as unidades de negócio
    // Penha
    let UNIDADE_NEGOCIO_PENHA = resolveUnidadeNegocioPenhaId(unidadesNegocioMap);
    if (UNIDADE_NEGOCIO_PENHA === null) {
      console.warn('[BLING] ⚠️ Unidade Penha não encontrada! Definindo como 0 para omitir do payload');
      UNIDADE_NEGOCIO_PENHA = 0;
    } else {
      console.log(`[BLING] ✅ Unidade Penha resolvida: ID=${UNIDADE_NEGOCIO_PENHA}`);
    }
    
    // Pernambuco / Norte-Nordeste
    let UNIDADE_NEGOCIO_NORTE_NORDESTE = resolveUnidadeNegocioPEId(unidadesNegocioMap);
    if (UNIDADE_NEGOCIO_NORTE_NORDESTE === null) {
      console.warn('[BLING] ⚠️ Unidade PE/Norte-Nordeste não encontrada! Definindo como 0 para omitir do payload');
      UNIDADE_NEGOCIO_NORTE_NORDESTE = 0;
    } else {
      console.log(`[BLING] ✅ Unidade PE/Norte-Nordeste resolvida: ID=${UNIDADE_NEGOCIO_NORTE_NORDESTE}`);
    }
    
    // Matriz RJ / Outras regiões
    let UNIDADE_NEGOCIO_OUTRAS = resolveUnidadeNegocioRJId(unidadesNegocioMap);
    if (UNIDADE_NEGOCIO_OUTRAS === null) {
      console.warn('[BLING] ⚠️ Unidade Matriz RJ não encontrada! Definindo como 0 para omitir do payload');
      UNIDADE_NEGOCIO_OUTRAS = 0;
    } else {
      console.log(`[BLING] ✅ Unidade Matriz RJ resolvida: ID=${UNIDADE_NEGOCIO_OUTRAS}`);
    }
    
    console.log(`[BLING] 📊 RESUMO UNIDADES: Penha=${UNIDADE_NEGOCIO_PENHA}, PE=${UNIDADE_NEGOCIO_NORTE_NORDESTE}, RJ=${UNIDADE_NEGOCIO_OUTRAS}`)
    
    // Depósitos - OBRIGATÓRIOS (via secrets)
    const BLING_DEPOSITO_ID_GERAL_RAW = Deno.env.get('BLING_DEPOSITO_ID_GERAL');
    const BLING_DEPOSITO_ID_PERNAMBUCO_RAW = Deno.env.get('BLING_DEPOSITO_ID_PERNAMBUCO');
    const BLING_DEPOSITO_ID_PENHA_RAW = Deno.env.get('BLING_DEPOSITO_ID_PENHA');
    
    // Validar apenas depósitos (obrigatórios)
    const missingSecrets: string[] = [];
    if (!BLING_DEPOSITO_ID_GERAL_RAW) missingSecrets.push('BLING_DEPOSITO_ID_GERAL');
    if (!BLING_DEPOSITO_ID_PERNAMBUCO_RAW) missingSecrets.push('BLING_DEPOSITO_ID_PERNAMBUCO');
    
    if (missingSecrets.length > 0) {
      console.error('[SECRETS] ERRO: Secrets obrigatórios não configurados:', missingSecrets.join(', '));
      throw new Error(`Configuração incompleta: faltam os secrets ${missingSecrets.join(', ')}`);
    }
    
    const BLING_DEPOSITO_ID_RJ = Number(BLING_DEPOSITO_ID_GERAL_RAW);
    const BLING_DEPOSITO_ID_PE = Number(BLING_DEPOSITO_ID_PERNAMBUCO_RAW);
    // Penha: usa secret se disponível, fallback para RJ
    const BLING_DEPOSITO_ID_PENHA = BLING_DEPOSITO_ID_PENHA_RAW 
      ? Number(BLING_DEPOSITO_ID_PENHA_RAW) 
      : BLING_DEPOSITO_ID_RJ;
    
    // Validar depósitos
    if (isNaN(BLING_DEPOSITO_ID_RJ) || BLING_DEPOSITO_ID_RJ <= 0) {
      console.error('[SECRETS] ERRO: BLING_DEPOSITO_ID_GERAL inválido:', BLING_DEPOSITO_ID_GERAL_RAW);
      throw new Error('BLING_DEPOSITO_ID_GERAL tem valor inválido');
    }
    if (isNaN(BLING_DEPOSITO_ID_PE) || BLING_DEPOSITO_ID_PE <= 0) {
      console.error('[SECRETS] ERRO: BLING_DEPOSITO_ID_PERNAMBUCO inválido:', BLING_DEPOSITO_ID_PERNAMBUCO_RAW);
      throw new Error('BLING_DEPOSITO_ID_PERNAMBUCO tem valor inválido');
    }
    
    console.log('[SECRETS] Depósitos OK');
    
    // Detectar UF: primeiro de transporte.endereco.uf (se vier no request), fallback para endereco_entrega.estado
    const ufEntrega = (endereco_entrega?.uf || endereco_entrega?.estado || '').toUpperCase().trim();
    const isNorteNordeste = UFS_NORTE_NORDESTE.includes(ufEntrega);
    
    // metodo_frete já vem do body (linha 340): PAC, SEDEX, FREE, manual, retirada, retirada_pe, retirada_penha
    console.log(`[ROUTING] metodo_frete=${metodo_frete || 'N/A'} ufEntrega=${ufEntrega} isNorteNordeste=${isNorteNordeste}`);
    
    // Selecionar IDs baseado na região OU ponto de retirada
    // PRIORIDADE 1: Pontos de retirada específicos (metodo_frete)
    // PRIORIDADE 2: UF de entrega (Norte/Nordeste vs outras)
    let lojaSelecionada = '';
    let lojaIdSelecionada: number;
    let unidadeNegocioSelecionada = '';
    let unidadeNegocioIdSelecionada: number;
    let depositoSelecionado = '';
    let depositoIdSelecionado: number;
    
    // PRIORIDADE 0: Pagamento na Loja (PDV Loja Penha)
    if (forma_pagamento === 'pagamento_loja') {
      // Depósito E Unidade de Negócio baseados na escolha do vendedor
      switch (deposito_origem) {
        case 'local':
          // ✅ CORREÇÃO: Usar loja POLO PENHA (205891152) que tem Unidade Penha configurada
          // A loja PDV (205441191) ignora unidadeNegocio enviada e força Matriz
          lojaSelecionada = 'POLO PENHA';
          lojaIdSelecionada = BLING_LOJA_PENHA_ID; // = 205891152
          depositoSelecionado = 'LOJA PENHA';
          depositoIdSelecionado = BLING_DEPOSITO_ID_PENHA;
          unidadeNegocioSelecionada = 'Loja Penha';
          unidadeNegocioIdSelecionada = UNIDADE_NEGOCIO_PENHA;
          break;
        case 'pernambuco':
          lojaSelecionada = 'Pernambuco';
          lojaIdSelecionada = BLING_LOJA_PERNAMBUCO_ID; // = 205882190
          depositoSelecionado = 'PERNANBUCO [ALFA]';
          depositoIdSelecionado = BLING_DEPOSITO_ID_PE;
          unidadeNegocioSelecionada = 'Polo Jaboatão (PE)';
          unidadeNegocioIdSelecionada = UNIDADE_NEGOCIO_NORTE_NORDESTE; // = 1
          break;
        default: // matriz
          lojaSelecionada = 'FATURADOS';
          lojaIdSelecionada = BLING_LOJA_FATURADOS_ID; // = 205797806
          depositoSelecionado = 'Geral';
          depositoIdSelecionado = BLING_DEPOSITO_ID_RJ;
          unidadeNegocioSelecionada = 'Matriz (RJ)';
          unidadeNegocioIdSelecionada = UNIDADE_NEGOCIO_OUTRAS; // = 2
      }
      
      console.log(`[ROUTING] PAGAMENTO LOJA: forma=${forma_pagamento_loja}, bandeira=${bandeira_cartao}, parcelas=${parcelas_cartao}, deposito=${deposito_origem}`);
      console.log(`[ROUTING] PAGAMENTO LOJA: loja=${lojaSelecionada} (${lojaIdSelecionada}) unidadeNegocio=${unidadeNegocioSelecionada} (${unidadeNegocioIdSelecionada})`);
      
  } else if (metodo_frete === 'retirada_penha') {
    // PRIORIDADE 1: Retirada no Polo Penha (Loja Penha)
    lojaSelecionada = 'POLO PENHA';
    lojaIdSelecionada = BLING_LOJA_PENHA_ID;
    unidadeNegocioSelecionada = 'Loja Penha';
    unidadeNegocioIdSelecionada = UNIDADE_NEGOCIO_PENHA; // Usa secret ou fallback para Matriz
    depositoSelecionado = 'LOJA PENHA';
    depositoIdSelecionado = BLING_DEPOSITO_ID_PENHA;

  } else if (metodo_frete === 'retirada_pe') {
      // PRIORIDADE 1: Retirada no Polo Pernambuco
      lojaSelecionada = 'Pernambuco';
      lojaIdSelecionada = BLING_LOJA_PERNAMBUCO_ID; // = 205882190
      unidadeNegocioSelecionada = 'Polo Jaboatão (PE)';
      unidadeNegocioIdSelecionada = UNIDADE_NEGOCIO_NORTE_NORDESTE; // = 1
      depositoSelecionado = 'PERNANBUCO [ALFA]';
      depositoIdSelecionado = BLING_DEPOSITO_ID_PE;
      
    } else if (metodo_frete === 'retirada' || metodo_frete === 'manual') {
      // PRIORIDADE 1: Retirada na Matriz RJ (inclui 'manual' que vem das propostas)
      lojaSelecionada = 'FATURADOS';
      lojaIdSelecionada = BLING_LOJA_FATURADOS_ID; // = 205797806
      unidadeNegocioSelecionada = 'Matriz (RJ)';
      unidadeNegocioIdSelecionada = UNIDADE_NEGOCIO_OUTRAS; // = 2
      depositoSelecionado = 'Geral';
      depositoIdSelecionado = BLING_DEPOSITO_ID_RJ;
      console.log(`[ROUTING] metodo_frete '${metodo_frete}' mapeado para retirada Matriz RJ`);
      
    } else if (isNorteNordeste) {
      // PRIORIDADE 2: Entrega para Norte/Nordeste
      lojaSelecionada = 'Pernambuco';
      lojaIdSelecionada = BLING_LOJA_PERNAMBUCO_ID; // = 205882190
      unidadeNegocioSelecionada = 'Polo Jaboatão (PE)';
      unidadeNegocioIdSelecionada = UNIDADE_NEGOCIO_NORTE_NORDESTE; // = 1
      depositoSelecionado = 'PERNANBUCO [ALFA]';
      depositoIdSelecionado = BLING_DEPOSITO_ID_PE;
      
    } else {
      // PRIORIDADE 3: Demais entregas → Matriz RJ
      lojaSelecionada = 'FATURADOS';
      lojaIdSelecionada = BLING_LOJA_FATURADOS_ID; // = 205797806
      unidadeNegocioSelecionada = 'Matriz (RJ)';
      unidadeNegocioIdSelecionada = UNIDADE_NEGOCIO_OUTRAS; // = 2
      depositoSelecionado = 'Geral';
      depositoIdSelecionado = BLING_DEPOSITO_ID_RJ;
    }
    
    // LOG OBRIGATÓRIO: Seleções finais
    console.log(`[ROUTING] loja=${lojaSelecionada} (${lojaIdSelecionada}) unidadeNegocio=${unidadeNegocioSelecionada} (${unidadeNegocioIdSelecionada})`);
    console.log(`[ROUTING] deposito=${depositoSelecionado} id=${depositoIdSelecionado}`);
    
    // Tipo para compatibilidade
    type DepositoInfo = { id: number; descricao: string; padrao: boolean };

    // Função auxiliar para buscar produto no Bling pelo código (SKU)
    async function findBlingProductBySku(sku: string): Promise<{ id: number; codigo: string } | null> {
      try {
        console.log(`Buscando produto no Bling pelo SKU/código: "${sku}"`);
        
        // Delay para respeitar rate limit
        await delay(350);
        
        // Buscar diretamente pelo código usando o endpoint de produtos
        const searchResponse = await blingFetchWithRetry(
          `https://www.bling.com.br/Api/v3/produtos?codigo=${encodeURIComponent(sku)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          }
        );

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.log(`Erro HTTP ao buscar produto por SKU: ${sku}. Status: ${searchResponse.status}. Body: ${errorText}`);
          return null;
        }

        const searchData = await searchResponse.json();
        const produtos = searchData.data || [];
        
        console.log(`Bling retornou ${produtos.length} produtos para SKU "${sku}"`);

        if (produtos.length > 0) {
          // Procurar match exato do código
          const exactMatch = produtos.find((p: any) => 
            String(p.codigo).trim().toLowerCase() === sku.trim().toLowerCase()
          );
          
          if (exactMatch) {
            console.log(`Produto encontrado por SKU exato: "${exactMatch.nome}" (código: ${exactMatch.codigo}) -> ID ${exactMatch.id}`);
            return { id: exactMatch.id, codigo: exactMatch.codigo };
          }
          
          // Se não houver match exato, usar o primeiro resultado
          const firstProduct = produtos[0];
          console.log(`Produto encontrado por SKU (primeiro resultado): "${firstProduct.nome}" (código: ${firstProduct.codigo}) -> ID ${firstProduct.id}`);
          return { id: firstProduct.id, codigo: firstProduct.codigo };
        }

        console.log(`Nenhum produto encontrado para SKU: ${sku}`);
        return null;
      } catch (error) {
        console.error(`Erro ao buscar produto por SKU: ${error}`);
        return null;
      }
    }

    // Função auxiliar para buscar produto no Bling pelo nome (fallback)
    async function findBlingProductByName(productName: string): Promise<number | null> {
      try {
        // Normalizar para comparação (remover acentos e case)
        const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        
        // Extrair informações importantes do nome do produto
        // Ex: "Revista EBD N08 Jovens e Adultos - O Cativeiro Babilônico ALUNO"
        // Partes importantes: N08 (número), "Jovens e Adultos" ou "Juniores" (faixa), ALUNO/PROFESSOR (tipo)
        const normalizedSearch = normalize(productName);
        
        // Detectar número da revista (N01, N02, N08, etc.)
        const numeroRevistaMatch = productName.match(/N(\d+)/i);
        const numeroRevista = numeroRevistaMatch ? numeroRevistaMatch[1].padStart(2, '0') : null;
        
        // Detectar tipo (ALUNO ou PROFESSOR)
        const isAluno = /aluno/i.test(productName);
        const isProfessor = /professor/i.test(productName);
        const tipo = isAluno ? 'aluno' : (isProfessor ? 'professor' : null);
        
        // Detectar faixa etária
        const faixaEtaria = normalizedSearch.includes('jovens e adultos') ? 'jovens e adultos' :
                           normalizedSearch.includes('adolescentes') || normalizedSearch.includes('adolecentes') ? 'adolescentes' :
                           normalizedSearch.includes('juniores') ? 'juniores' :
                           normalizedSearch.includes('jardim de infancia') || normalizedSearch.includes('jardim de infância') ? 'jardim de infancia' :
                           normalizedSearch.includes('discipulado') ? 'discipulado' :
                           normalizedSearch.includes('passo a passo') ? 'passo a passo' :
                           null;
        
        console.log(`Buscando produto por nome: "${productName}"`);
        console.log(`  -> Número: ${numeroRevista}, Tipo: ${tipo}, Faixa: ${faixaEtaria}`);
        
        const palavrasIgnorar = ['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'um', 'uma', 'uns', 'umas', '-', 'livro', 'revista', 'ebd'];
        const palavras = productName.split(/\s+/).filter(p => p.length > 0);
        const palavrasSignificativas = palavras.filter(p => !palavrasIgnorar.includes(p.toLowerCase()) && p.length > 2);
        
        // Diferentes termos de busca para tentar
        const searchAttempts: string[] = [];
        
        // 1. Buscar com número da revista + tipo se disponível
        if (numeroRevista && tipo) {
          searchAttempts.push(`N${numeroRevista} ${tipo}`);
        }
        
        // 2. Palavras significativas (max 4)
        if (palavrasSignificativas.length >= 2) {
          searchAttempts.push(palavrasSignificativas.slice(0, 4).join(' '));
        }
        
        // 3. Primeiras 6 palavras originais
        if (palavras.length >= 3) {
          searchAttempts.push(palavras.slice(0, 6).join(' '));
        }
        
        // 4. Primeiras 3 palavras
        searchAttempts.push(palavras.slice(0, 3).join(' '));
        
        // Remover duplicatas
        const uniqueAttempts = [...new Set(searchAttempts)];
        
        // Função para calcular score de match
        const calculateMatchScore = (produtoNome: string): number => {
          const normalizedProduto = normalize(produtoNome);
          let score = 0;
          
          // Match exato = 1000 pontos
          if (normalizedProduto === normalizedSearch) {
            return 1000;
          }
          
          // Match de número da revista (muito importante)
          if (numeroRevista) {
            const produtoNumero = produtoNome.match(/N(\d+)/i);
            if (produtoNumero && produtoNumero[1].padStart(2, '0') === numeroRevista) {
              score += 100;
            } else {
              // Se o número não bate, penalizar fortemente
              score -= 200;
            }
          }
          
          // Match de tipo (ALUNO/PROFESSOR)
          if (tipo) {
            if (tipo === 'aluno' && /aluno/i.test(produtoNome)) {
              score += 50;
            } else if (tipo === 'professor' && /professor/i.test(produtoNome)) {
              score += 50;
            } else if (tipo === 'aluno' && /professor/i.test(produtoNome)) {
              // Tipo diferente, penalizar muito
              score -= 100;
            } else if (tipo === 'professor' && /aluno/i.test(produtoNome)) {
              score -= 100;
            }
          }
          
          // Match de faixa etária
          if (faixaEtaria) {
            const normalizedProdutoCheck = normalizedProduto;
            if (faixaEtaria === 'jovens e adultos' && normalizedProdutoCheck.includes('jovens e adultos')) {
              score += 30;
            } else if (faixaEtaria === 'adolescentes' && (normalizedProdutoCheck.includes('adolescentes') || normalizedProdutoCheck.includes('adolecentes'))) {
              score += 30;
            } else if (faixaEtaria === 'juniores' && normalizedProdutoCheck.includes('juniores')) {
              score += 30;
            } else if (faixaEtaria === 'jardim de infancia' && normalizedProdutoCheck.includes('jardim')) {
              score += 30;
            } else if (faixaEtaria === 'discipulado' && normalizedProdutoCheck.includes('discipulado')) {
              score += 30;
            } else if (faixaEtaria === 'passo a passo' && normalizedProdutoCheck.includes('passo a passo')) {
              score += 30;
            }
          }
          
          // Match por inclusão
          if (normalizedSearch.includes(normalizedProduto) || normalizedProduto.includes(normalizedSearch)) {
            score += 20;
          }
          
          // Match de palavras significativas
          const matchedWords = palavrasSignificativas.filter(palavra => 
            normalizedProduto.includes(normalize(palavra))
          ).length;
          score += matchedWords * 5;
          
          return score;
        };
        
        for (const searchTerms of uniqueAttempts) {
          console.log(`Buscando produto no Bling com termo: "${searchTerms}"`);
          
          // Delay entre buscas para respeitar rate limit
          await delay(350);
          
          const searchResponse = await blingFetchWithRetry(
            `https://www.bling.com.br/Api/v3/produtos?pagina=1&limite=100&nome=${encodeURIComponent(searchTerms)}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
              },
            }
          );

          if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            console.log(`Erro HTTP ao buscar produto por nome: ${productName}. Status: ${searchResponse.status}. Body: ${errorText}`);
            continue; // Tentar próximo termo
          }

          const searchData = await searchResponse.json();
          const produtos = searchData.data || [];
          
          console.log(`Bling retornou ${produtos.length} produtos para busca "${searchTerms}"`);

          if (produtos.length > 0) {
            // Calcular score para cada produto
            const produtosComScore = produtos.map((p: any) => ({
              ...p,
              matchScore: calculateMatchScore(p.nome || '')
            }));
            
            // Ordenar por score descendente
            produtosComScore.sort((a: any, b: any) => b.matchScore - a.matchScore);
            
            const melhorMatch = produtosComScore[0];
            console.log(`Melhor match: "${melhorMatch.nome}" com score ${melhorMatch.matchScore}`);
            
            // Só aceitar se o score for positivo e razoável
            if (melhorMatch.matchScore >= 50) {
              console.log(`Produto encontrado (score ${melhorMatch.matchScore}): ${melhorMatch.nome} -> ID ${melhorMatch.id}`);
              return melhorMatch.id;
            }
            
            // Match exato
            const exactMatch = produtos.find((p: any) =>
              normalize(p.nome || '') === normalizedSearch
            );

            if (exactMatch) {
              console.log(`Produto encontrado (match exato): ${exactMatch.nome} -> ID ${exactMatch.id}`);
              return exactMatch.id;
            }
          }
        }

        // Fallback: listar produtos (paginação limitada) e fazer match local.
        // Isso resolve casos em que o filtro "nome" não retorna resultados por limitações do Bling.
        const MAX_PAGES = 3;
        const LIMIT = 100;

        for (let page = 1; page <= MAX_PAGES; page++) {
          console.log(`Fallback: listando produtos do Bling (página ${page}/${MAX_PAGES}) para match local...`);

          // Delay entre páginas para respeitar rate limit
          await delay(400);

          const listResponse = await blingFetchWithRetry(
            `https://www.bling.com.br/Api/v3/produtos?pagina=${page}&limite=${LIMIT}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
              },
            }
          );

          if (!listResponse.ok) {
            const errorText = await listResponse.text();
            console.log(`Fallback: erro HTTP ao listar produtos. Status: ${listResponse.status}. Body: ${errorText}`);
            break;
          }

          const listData = await listResponse.json();
          const produtos = listData.data || [];
          console.log(`Fallback: Bling retornou ${produtos.length} produtos na página ${page}`);

          if (!Array.isArray(produtos) || produtos.length === 0) break;

          // Calcular score para cada produto usando a mesma função
          const produtosComScore = produtos.map((p: any) => ({
            ...p,
            matchScore: calculateMatchScore(p.nome || '')
          }));
          
          // Ordenar por score descendente
          produtosComScore.sort((a: any, b: any) => b.matchScore - a.matchScore);
          
          const melhorMatch = produtosComScore[0];
          
          // Só aceitar se o score for muito alto (mais rigoroso no fallback)
          if (melhorMatch && melhorMatch.matchScore >= 80) {
            console.log(`Produto encontrado (fallback score ${melhorMatch.matchScore}): ${melhorMatch.nome} -> ID ${melhorMatch.id}`);
            return melhorMatch.id;
          }

          // Se veio menos que LIMIT, não há mais páginas.
          if (produtos.length < LIMIT) break;
        }

        console.log(`Nenhum produto encontrado para: ${productName}`);
        return null;
      } catch (error) {
        console.error(`Erro ao buscar produto por nome: ${error}`);
        return null;
      }
    }

    // Cache simples para não bater no endpoint de estoque repetidas vezes
    const estoqueCache = new Map<string, number>();

    // Busca saldo físico/virtual no Bling (quando disponível)
    // Observação: no painel do Bling geralmente aparece o **saldo físico**,
    // mas a validação da venda costuma considerar o **saldo virtual/disponível** (saldo físico - reservas).
    async function getBlingStock(
      produtoId: number,
      depositoId?: number
    ): Promise<{ saldoFisico: number | null; saldoVirtual: number | null } | null> {
      try {
        const cacheKey = `${produtoId}:${depositoId ?? 'all'}`;
        if (estoqueCache.has(cacheKey)) {
          const cachedVirtual = estoqueCache.get(cacheKey)!;
          return { saldoFisico: null, saldoVirtual: cachedVirtual };
        }

        // Rate limit: respeitar espaçamento entre chamadas
        await delay(350);

        const depositFilter = depositoId ? `&idsDepositos[]=${encodeURIComponent(String(depositoId))}` : '';
        const url = `https://www.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${produtoId}${depositFilter}`;
        const resp = await blingFetchWithRetry(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!resp.ok) {
          const body = await resp.text();
          console.log(
            `[STOCK CHECK] Falha ao consultar saldo do produto ${produtoId} (deposito=${depositoId ?? 'all'}): status=${resp.status} body=${body}`
          );
          return null;
        }

        const json = await resp.json();
        const row = Array.isArray(json?.data) ? json.data.find((d: any) => Number(d?.id) === produtoId) : null;

        const saldoFisico = row?.saldoFisico != null ? Number(row.saldoFisico) : null;
        const saldoVirtual = row?.saldoVirtual != null ? Number(row.saldoVirtual) : null;

        // Cache apenas o saldo virtual (mais importante pra validação)
        if (saldoVirtual != null && !Number.isNaN(saldoVirtual)) {
          estoqueCache.set(cacheKey, saldoVirtual);
        }

        console.log(
          `[STOCK CHECK] produto=${produtoId} deposito=${depositoId ?? 'all'} saldoFisico=${saldoFisico ?? 'n/a'} saldoVirtual=${saldoVirtual ?? 'n/a'}`
        );
        return { saldoFisico, saldoVirtual };
      } catch (e) {
        console.log(`[STOCK CHECK] Erro ao consultar saldo do produto ${produtoId}: ${String(e)}`);
        return null;
      }
    }

    // Preparar itens (enviando o PREÇO LISTA + DESCONTO separados para exibição correta no Bling)
    const itensBling = [];

    // ✅ ROTEAMENTO: Depósito será usado baseado na UF (já calculado acima)
    console.log('[DEPOSITO] Usando depósito baseado em roteamento por UF:', {
      depositoId: depositoIdSelecionado,
      descricao: depositoSelecionado
    });

    // Total real baseado nos itens que vamos enviar ao Bling (após desconto)
    // Método A: arredonda por UNIDADE e depois multiplica
    // Método B: multiplica primeiro (total do item) e só então arredonda (comportamento comum do Bling na validação)
    let totalBrutoBling = 0;
    let totalBrutoBlingMetodoB = 0;
    for (const item of itens as any[]) {
      let blingProdutoId: number | null = null;
      let blingProdutoCodigo: string | null = null;
      
      // Log obrigatório para confirmar payload real
      console.log("ITEM RECEBIDO:", JSON.stringify(item));
      console.log("SKU candidates:", {
        item_sku: (item as any).sku,
        item_codigo: (item as any).codigo,
        item_variantSku: (item as any).variantSku,
        item_variant_id: (item as any).variantId,
        item_produto_codigo: (item as any)?.produto?.codigo,
      });

      // Normalizar leitura do SKU/código (SKU é string; pode conter letras)
      const skuRecebido = String(
        (item as any).codigo ??
          (item as any).sku ??
          (item as any).variantSku ??
          (item as any)?.produto?.codigo ??
          ""
      ).trim();

      console.log(`Processando item: "${item.descricao}"`);
      console.log(`  SKU recebido: "${skuRecebido}"`);
      
      // SKU é obrigatório para criar pedido no Bling (sem fallback por nome)
      if (!skuRecebido) {
        throw new Error('Item sem SKU. Não é permitido criar pedido no Bling sem SKU.');
      }

      console.log(`Buscando produto SOMENTE por SKU: "${skuRecebido}"`);

      const produtoBySku = await findBlingProductBySku(skuRecebido);

      if (produtoBySku) {
        blingProdutoId = produtoBySku.id;
        blingProdutoCodigo = produtoBySku.codigo;
        console.log(`Produto encontrado por SKU! ID: ${blingProdutoId}, Código: ${blingProdutoCodigo}`);
      } else {
        console.error(`ERRO: SKU "${skuRecebido}" não encontrado no Bling`);
        throw new Error(`Produto não encontrado no Bling com SKU/código: "${skuRecebido}". Verifique se o código está cadastrado corretamente no Bling.`);
      }

      // preco_cheio = preço de tabela (sem desconto)
      // valor = preço com desconto aplicado
      const precoLista = Number(item.preco_cheio || item.valor);
      const precoComDesconto = Number(item.valor);
      const quantidade = Number(item.quantidade);

      // Checagem preventiva (SEM depósito): como não enviamos deposito.id, deixamos o Bling usar o padrão.
      // Aqui consultamos o saldo agregado (sem filtro) apenas para sinalização.
      const stock = await getBlingStock(blingProdutoId);
      if (stock?.saldoVirtual != null && !Number.isNaN(stock.saldoVirtual) && stock.saldoVirtual < quantidade) {
        const fisicoTxt = stock.saldoFisico == null || Number.isNaN(stock.saldoFisico)
          ? 'n/a'
          : stock.saldoFisico.toFixed(2);
        const virtualTxt = stock.saldoVirtual.toFixed(2);

        console.log(
          `[STOCK CHECK] Saldo agregado insuficiente (sem depósito): produto=${blingProdutoId} saldoVirtual=${virtualTxt} solicitado=${quantidade}`
        );

        throw new Error(
          `Estoque insuficiente no Bling para: ${item.descricao}. ` +
          `Saldo (agregado/sem depósito) insuficiente: saldo=${virtualTxt}, solicitado=${quantidade}. ` +
          `Saldo físico: ${fisicoTxt} • Saldo disponível (virtual): ${virtualTxt}.`
        );
      }

      // ESTRATÉGIA CORRIGIDA (2026-01-26): Enviar preço CHEIO + desconto no PEDIDO
      // O Bling subtrai o desconto.valor do total dos itens, então precisamos:
      // 1. Enviar itens com preço CHEIO (precoLista)
      // 2. Enviar desconto total no nível do pedido
      // 3. Parcelas = (total itens cheio + frete) - desconto total
      
      // Preço cheio (lista) - o que será enviado ao Bling
      const precoUnitarioCheio = Math.round(precoLista * 100) / 100;
      
      // Preço com desconto (para cálculo do desconto total)
      const precoUnitarioLiquido = Math.round(precoComDesconto * 100) / 100;
      
      // Total do item com preço CHEIO (o que Bling vai somar)
      const totalItemCheio = Math.round((precoUnitarioCheio * quantidade) * 100) / 100;
      
      // Total do item com desconto (para cálculo final das parcelas)
      const totalItemLiquido = Math.round((precoUnitarioLiquido * quantidade) * 100) / 100;
      
      // Desconto do item = diferença entre cheio e líquido
      const descontoTotalItem = Math.max(0, Math.round((totalItemCheio - totalItemLiquido) * 100) / 100);

      // Acumular totais CHEIOS (o que o Bling vai calcular antes do desconto)
      totalBrutoBling += totalItemCheio;
      totalBrutoBlingMetodoB += totalItemCheio;

      // Acumular desconto total (para enviar no nível do pedido)
      descontoTotalVenda += descontoTotalItem;

      console.log(`Item: ${item.descricao}`);
      console.log(`  - SKU recebido: ${skuRecebido}`);
      console.log(`  - bling_produto_id: ${blingProdutoId}`);
      console.log(`  - bling_produto_codigo: ${blingProdutoCodigo || 'N/A'}`);
      console.log(`  - Preço Lista (enviado ao Bling): R$ ${precoUnitarioCheio.toFixed(2)}`);
      console.log(`  - Preço Líquido (referência): R$ ${precoUnitarioLiquido.toFixed(2)}`);
      console.log(`  - Total Item Cheio: R$ ${totalItemCheio.toFixed(2)}`);
      console.log(`  - Total Item Líquido: R$ ${totalItemLiquido.toFixed(2)}`);
      console.log(`  - Desconto do Item: R$ ${descontoTotalItem.toFixed(2)}`);
      console.log(`  - Quantidade: ${quantidade}`);

      // ESTRATÉGIA: Enviar preço CHEIO - o desconto será aplicado no nível do pedido
      const itemBling: any = {
        codigo: skuRecebido,
        descricao: item.descricao,
        unidade: item.unidade || 'UN',
        quantidade: quantidade,
        // PREÇO CHEIO (lista) - Bling vai subtrair o desconto do pedido depois
        valor: Number(precoUnitarioCheio.toFixed(2)),
        produto: {
          id: blingProdutoId,
        },
      };
      // NÃO enviar desconto por item - usamos desconto global no pedido

      itensBling.push(itemBling);
    }

    // Calcular o total exato que Bling vai computar:
    // - Bling soma os itens (preço cheio) = totalBrutoBling
    // - Bling subtrai o desconto.valor = descontoTotalVenda
    // - Bling adiciona o frete = valorFreteNum
    // - Total final para parcelas = (totalBrutoBling - descontoTotalVenda + frete)
    const valorFreteNum = Number(Number(valor_frete || 0).toFixed(2));

    const totalItensCheio_A = Math.round(totalBrutoBling * 100) / 100;
    const totalItensCheio_B = Math.round(totalBrutoBlingMetodoB * 100) / 100;
    
    // IMPORTANTE: O Bling calcula: itens CHEIOS + frete - desconto = total
    // As parcelas devem somar exatamente esse valor
    const valorTotalAntesDesconto = Math.round((totalItensCheio_B + valorFreteNum) * 100) / 100;
    const valorTotalAposDesconto = Math.round((valorTotalAntesDesconto - descontoTotalVenda) * 100) / 100;

    console.log(`=== CÁLCULO BLING (CORRIGIDO) ===`);
    console.log(`Total Itens CHEIO (A): R$ ${totalItensCheio_A.toFixed(2)}`);
    console.log(`Total Itens CHEIO (B): R$ ${totalItensCheio_B.toFixed(2)}`);
    console.log(`Frete:                 R$ ${valorFreteNum.toFixed(2)}`);
    console.log(`Subtotal (itens+frete): R$ ${valorTotalAntesDesconto.toFixed(2)}`);
    console.log(`Desconto Total:        -R$ ${descontoTotalVenda.toFixed(2)}`);
    console.log(`TOTAL FINAL (para parcelas): R$ ${valorTotalAposDesconto.toFixed(2)}`);

    // Gerar número único para o pedido
    const numeroPedido = `${timestamp}-${randomSuffix}`;

    // Mapear tipo de frete para nome do transportador
    // Se for frete manual, usar o nome da transportadora fornecida
    let freteInfo: { nome: string; servico: string };
    if (frete_tipo === 'manual' && frete_transportadora) {
      freteInfo = { nome: frete_transportadora, servico: 'FRETE MANUAL' };
      console.log(`Frete manual: Transportadora = ${frete_transportadora}`);
      if (frete_observacao) {
        console.log(`Observação do frete: ${frete_observacao}`);
      }
    } else {
      const tipoFreteMap: { [key: string]: { nome: string; servico: string } } = {
        'pac': { nome: 'Correios', servico: 'PAC' },
        'sedex': { nome: 'Correios', servico: 'SEDEX' },
        'free': { nome: 'Correios', servico: 'PAC CONTRATO AG' },
        'retirada': { nome: 'Retirada na Matriz', servico: 'RETIRADA' },
        'retirada_penha': { nome: 'Retirada Loja Penha', servico: 'RETIRADA_PENHA' },
        'retirada_pe': { nome: 'Retirada Polo PE', servico: 'RETIRADA_PE' },
      };
      freteInfo = tipoFreteMap[metodo_frete?.toLowerCase()] || { nome: 'Correios', servico: metodo_frete || 'A Combinar' };
    }

    // Mapear forma de pagamento
    const formaPagamentoMap: { [key: string]: string } = {
      'pix': 'PIX',
      'card': 'Cartão de Crédito',
      'boleto': 'Boleto Bancário',
      'faturamento': 'Faturamento 30/60/90',
    };
    const formaPagamentoDescricao = formaPagamentoMap[forma_pagamento?.toLowerCase()] || forma_pagamento || 'Outros';

    // Usar valores calculados: total APÓS desconto para consistência
    const valorProdutosLiquido = Math.round((totalItensCheio_B - descontoTotalVenda) * 100) / 100;
    const valorTotalCorreto = valorTotalAposDesconto;

    console.log('=== RESUMO DO PEDIDO ===');
    console.log(`Valor Produtos (líquido): R$ ${valorProdutosLiquido.toFixed(2)}`);
    console.log(`Valor Frete: R$ ${valorFreteNum.toFixed(2)}`);
    console.log(`Valor Total: R$ ${valorTotalCorreto.toFixed(2)}`);
    console.log(`Desconto Total: R$ ${descontoTotalVenda.toFixed(2)}`);
    console.log(`Transportador: ${freteInfo.nome} - ${freteInfo.servico}`);

    // Montar observações detalhadas (incluindo economia para visibilidade)
    const observacoesBase = [
      `Pedido EBD #${pedido_id}`,
      `Forma de Pagamento: ${formaPagamentoDescricao}`,
      `Transportador: ${freteInfo.nome}`,
      `Serviço: ${freteInfo.servico}`,
      `Valor Produtos: R$ ${valorProdutosLiquido.toFixed(2)}`,
      `Valor Frete: R$ ${valorFreteNum.toFixed(2)}`,
      `Valor Total: R$ ${valorTotalCorreto.toFixed(2)}`,
    ];
    
    // Adicionar economia se houver desconto
    if (descontoTotalVenda > 0) {
      observacoesBase.push(`💰 ECONOMIA: R$ ${descontoTotalVenda.toFixed(2)}`);
    }
    
    // Adicionar indicação de frete grátis nas observações
    if (metodo_frete?.toLowerCase() === 'free') {
      observacoesBase.push('🚚 FRETE GRÁTIS');
    }
    
    observacoesBase.push(`Gerado em: ${new Date().toISOString()}`);
    const observacoes = observacoesBase.join(' | ');

    // Gerar parcelas baseado na forma de pagamento
    let parcelas: any[] = [];
    const isFaturamento = forma_pagamento?.toLowerCase() === 'faturamento';

    if (isFaturamento && faturamento_prazo) {
      // Faturamento B2B: criar parcelas baseado no prazo selecionado
      // Verificar se é prazo "direto" (1 boleto no prazo especificado)
      const isPrazoDireto = String(faturamento_prazo).includes('_direto');
      const isPrazo60_90 = String(faturamento_prazo) === '60_90';
      const isPrazo60_75_90 = String(faturamento_prazo) === '60_75_90';
      const isPrazo60_90_120 = String(faturamento_prazo) === '60_90_120';
      const prazoNumerico = parseInt(String(faturamento_prazo).replace('_direto', '').replace('_90', '').replace('_75_90', '').replace('_90_120', ''));
      
      // Número de parcelas e dias de vencimento
      let numParcelas: number;
      let diasVencimentos: number[] = [];
      
      if (isPrazoDireto) {
        numParcelas = 1; // Sempre 1 boleto para prazo direto (ex: 60_direto = 1 boleto em 60 dias)
        diasVencimentos = [prazoNumerico];
      } else if (isPrazo60_90) {
        // 60/90 = 2 parcelas em 60 e 90 dias
        numParcelas = 2;
        diasVencimentos = [60, 90];
      } else if (isPrazo60_75_90) {
        // 60/75/90 = 3 parcelas em 60, 75 e 90 dias
        numParcelas = 3;
        diasVencimentos = [60, 75, 90];
      } else if (isPrazo60_90_120) {
        // 60/90/120 = 3 parcelas em 60, 90 e 120 dias
        numParcelas = 3;
        diasVencimentos = [60, 90, 120];
      } else {
        numParcelas = prazoNumerico === 30 ? 1 : prazoNumerico === 60 ? 2 : 3;
        for (let i = 1; i <= numParcelas; i++) {
          diasVencimentos.push(30 * i);
        }
      }
      
      const prazo = prazoNumerico; // Usar prazo numérico para observações

       // ✅ Parcelas precisam bater com o TOTAL DA VENDA no Bling.
       // Usamos o mesmo total que o payload induz no Bling (método B + frete).
       const totalBaseParcelas = valorTotalAposDesconto;

      // Calcular parcelas em centavos para evitar problemas de arredondamento
      const totalBaseCentavos = Math.round(totalBaseParcelas * 100);
      const parcelaBaseCentavos = Math.floor(totalBaseCentavos / numParcelas);
      const restoCentavos = totalBaseCentavos - parcelaBaseCentavos * numParcelas;

      const parcelasValoresCentavos: number[] = [];
      for (let i = 0; i < numParcelas; i++) {
        parcelasValoresCentavos.push(parcelaBaseCentavos);
      }

      // Ajustar a diferença (centavos) na ÚLTIMA parcela
      parcelasValoresCentavos[numParcelas - 1] += restoCentavos;

      const somaFinalCentavos = parcelasValoresCentavos.reduce((acc, v) => acc + v, 0);

      console.log(
        `Faturamento B2B: ${numParcelas} parcela(s) | base=${totalBaseParcelas.toFixed(2)} (itens_cheio=${totalItensCheio_B.toFixed(2)} - desconto=${descontoTotalVenda.toFixed(2)} + frete=${valorFreteNum.toFixed(2)}) | base_cent=${totalBaseCentavos} | base_unit_cent=${parcelaBaseCentavos} | diff_cent=${restoCentavos} | soma_final_cent=${somaFinalCentavos} | parcelas=${parcelasValoresCentavos
          .map((c) => (c / 100).toFixed(2))
          .join(', ')}`
      );

      for (let i = 1; i <= numParcelas; i++) {
        const dataVencimento = new Date();
        
        // Usar o array de dias de vencimento calculado
        dataVencimento.setDate(dataVencimento.getDate() + diasVencimentos[i - 1]);

        const valorParcela = parcelasValoresCentavos[i - 1] / 100;

        // Criar label de observação baseado no tipo de prazo
        let observacoesLabel: string;
        if (isPrazoDireto) {
          observacoesLabel = `Pagamento único - Faturamento ${prazoNumerico} dias (à vista)`;
        } else if (isPrazo60_90) {
          observacoesLabel = `Parcela ${i}/${numParcelas} - Faturamento 60/90 dias`;
        } else if (isPrazo60_75_90) {
          observacoesLabel = `Parcela ${i}/${numParcelas} - Faturamento 60/75/90 dias`;
        } else if (isPrazo60_90_120) {
          observacoesLabel = `Parcela ${i}/${numParcelas} - Faturamento 60/90/120 dias`;
        } else {
          observacoesLabel = `Parcela ${i}/${numParcelas} - Faturamento ${prazo} dias`;
        }

        // ✅ ESTRUTURA CORRETA: formaPagamento com ID numérico para gerar Contas a Receber
        const parcelaObj: any = {
          dataVencimento: dataVencimento.toISOString().split('T')[0],
          valor: Number(valorParcela.toFixed(2)),
          observacoes: observacoesLabel,
        };

        // ✅ USAR ID da forma de pagamento "Conta a receber/pagar" (se encontrado)
        if (formaPagamentoContaReceberPagarId) {
          parcelaObj.formaPagamento = { id: formaPagamentoContaReceberPagarId };
        } else {
          // Fallback para descrição se ID não encontrado
          parcelaObj.formaPagamento = { descricao: 'Conta a receber/pagar' };
        }

        parcelas.push(parcelaObj);
      }
    } else {
      // Pagamento à vista
      // Para manter consistência com o total calculado a partir do payload, usamos Método B (itens) aqui também.
      const parcelaVistaObj: any = {
        dataVencimento: new Date().toISOString().split('T')[0],
        valor: Number((Math.round(Number(valorTotalAposDesconto) * 100) / 100).toFixed(2)),
        observacoes: `Pagamento via ${formaPagamentoDescricao}`,
      };

      // ✅ PARA PAGAMENTO NA LOJA (GLORINHA): usar forma específica (PIX, Dinheiro, Cartão)
      if (isPagamentoLoja && forma_pagamento_loja) {
        // Carregar formas de pagamento se ainda não carregou
        const formasMap = await loadAllFormasPagamento(accessToken);
        const formaPagLojaId = resolveFormaPagamentoLojaId(forma_pagamento_loja, bandeira_cartao, formasMap);
        
        if (formaPagLojaId) {
          parcelaVistaObj.formaPagamento = { id: formaPagLojaId };
          console.log(`[BLING] ✅ Usando forma de pagamento da loja: ${forma_pagamento_loja} (ID: ${formaPagLojaId})`);
        } else {
          // Fallback para descrição textual se não encontrar ID
          const descricaoMap: Record<string, string> = {
            'pix': 'PIX',
            'dinheiro': 'Dinheiro',
            'cartao_debito': 'Cartão de débito',
            'cartao_credito': bandeira_cartao 
              ? `Cartão de crédito ${bandeira_cartao.charAt(0).toUpperCase() + bandeira_cartao.slice(1)}` 
              : 'Cartão de crédito',
          };
          parcelaVistaObj.formaPagamento = { descricao: descricaoMap[forma_pagamento_loja] || 'PIX' };
          console.log(`[BLING] ⚠️ Usando descrição textual para forma de pagamento: ${descricaoMap[forma_pagamento_loja]}`);
        }
        
        // Melhorar observação para pagamento na loja
        const bandeiraLabel = bandeira_cartao 
          ? ` (${bandeira_cartao.charAt(0).toUpperCase() + bandeira_cartao.slice(1)})` 
          : '';
        const parcelasLabel = parcelas_cartao && Number(parcelas_cartao) > 1 
          ? ` em ${parcelas_cartao}x` 
          : '';
        const formaLabel = forma_pagamento_loja === 'pix' ? 'PIX' 
          : forma_pagamento_loja === 'dinheiro' ? 'Dinheiro'
          : forma_pagamento_loja === 'cartao_debito' ? 'Cartão Débito'
          : forma_pagamento_loja === 'cartao_credito' ? 'Cartão Crédito'
          : forma_pagamento_loja;
        parcelaVistaObj.observacoes = `Pago na Loja Penha - ${formaLabel}${bandeiraLabel}${parcelasLabel}`;
      } else {
        // ✅ Outros pagamentos: usar "Conta a receber/pagar"
        if (formaPagamentoContaReceberPagarId) {
          parcelaVistaObj.formaPagamento = { id: formaPagamentoContaReceberPagarId };
        } else {
          // Fallback para descrição se ID não encontrado
          parcelaVistaObj.formaPagamento = { descricao: 'Conta a receber/pagar' };
        }
      }

      parcelas = [parcelaVistaObj];
    }

    // ============================================================
    // AUDITORIA OBRIGATÓRIA: Verificar se parcelas batem com total
    // ============================================================
    const somaParcelas = parcelas.reduce((acc, p) => acc + Number(p.valor), 0);
    const diferencaCentavos = Math.round((valorTotalAposDesconto - somaParcelas) * 100);
    console.log(`[AUDITORIA] Total Pedido: R$ ${valorTotalAposDesconto.toFixed(2)} | Soma Parcelas: R$ ${somaParcelas.toFixed(2)} | Diferença: ${diferencaCentavos} centavos`);

    if (Math.abs(diferencaCentavos) > 0) {
      console.warn(`[AUDITORIA] ALERTA: Diferença detectada de ${diferencaCentavos} centavos! Ajustando última parcela...`);
      // Corrigir a última parcela para garantir que a soma bata exatamente
      if (parcelas.length > 0) {
        const ultimaParcela = parcelas[parcelas.length - 1];
        ultimaParcela.valor = Number((Number(ultimaParcela.valor) + (diferencaCentavos / 100)).toFixed(2));
        console.log(`[AUDITORIA] Última parcela ajustada para: R$ ${ultimaParcela.valor.toFixed(2)}`);
      }

      // Recalcular e logar novamente após ajuste
      const somaParcelasAjustada = parcelas.reduce((acc, p) => acc + Number(p.valor), 0);
      const diferencaFinal = Math.round((valorTotalAposDesconto - somaParcelasAjustada) * 100);
      console.log(`[AUDITORIA] Pós-ajuste | Soma Parcelas: R$ ${somaParcelasAjustada.toFixed(2)} | Diferença: ${diferencaFinal} centavos`);
    }

    // Criar pedido no Bling com dados de transporte corretos
    // USAR LOJA CORRETA BASEADA NA REGIÃO + UNIDADE DE NEGÓCIO
    // Norte/Nordeste -> Loja Pernambuco (205882190) + Unidade 1
    // Demais regiões -> Loja FATURADOS (205797806) + Unidade 2
    
    // Montar objeto loja com unidadeNegocio baseado na região
    // IMPORTANTE: Se unidadeNegocioIdSelecionada === 0, OMITIR o campo para evitar erro
    // "Unidade de negócio não encontrada" quando a API não retorna lista de unidades
    const lojaPayload: any = {
      id: lojaIdSelecionada,
      // Somente incluir unidadeNegocio se temos um ID válido (> 0)
      ...(unidadeNegocioIdSelecionada > 0 && {
        unidadeNegocio: { id: unidadeNegocioIdSelecionada }
      }),
    };
    
    // LOG OBRIGATÓRIO antes do POST
    console.log(`[BLING] Enviando para loja ${lojaSelecionada} (${lojaIdSelecionada}) - unidadeNegocio: ${unidadeNegocioIdSelecionada}`);
    
    // ============================================================
    // ESTRUTURA CORRETA BLING API v3 (Pedidos de Venda):
    // - Endereço de entrega vai em transporte.etiqueta (NÃO em contato.enderecoEntrega)
    // - contato.enderecoEntrega funciona apenas para cadastro de contatos
    // - Para Pedidos de Venda, usar transporte.etiqueta
    // ============================================================
    
    // Contato (injetar doc do banco também - não depender do front)
    const contatoPayload: any = {
      id: contatoId,
      nome: clienteDb?.nome_igreja,
      numeroDocumento: documento,
      telefone: clienteDb?.telefone,
      email: clienteDb?.email_superintendente,
    };

    const pedidoData: any = {
      numero: numeroPedido,
      data: new Date().toISOString().split('T')[0], // ✅ Formato ISO 8601: AAAA-MM-DD
      // ✅ LOJA BASEADA NA REGIÃO + UNIDADE DE NEGÓCIO
      loja: lojaPayload,
      // ✅ CONTATO (id + numeroDocumento)
      contato: contatoPayload,
      // ✅ DEPÓSITO SEMPRE incluído baseado no roteamento por UF
      itens: itensBling.map((item: any) => ({
        ...item,
        deposito: { id: depositoIdSelecionado },
      })),
      // ❌ NÃO ENVIAR SITUAÇÃO NO POST - Bling rejeita com "Não há transições definidas"
      // A automação de 06/01/2026 foi interna do Bling, não via payload
      // Usaremos PATCH após criação para alterar o status
      
      // ✅ NATUREZA DE OPERAÇÃO - SEMPRE incluída (garantida pelo fallback)
      naturezaOperacao: {
        id: naturezaOperacaoId,
      },
      observacoes: observacoes 
        + (isFaturamento ? ` | FATURAMENTO B2B ${faturamento_prazo} DIAS` : '') 
        + (desconto_percentual ? ` | DESCONTO: ${desconto_percentual}%` : '')
        + ` | UNIDADE: ${unidadeNegocioSelecionada} | DEPÓSITO: ${depositoSelecionado}`,
      parcelas,
      // ✅ VENDEDOR - Enviar SOMENTE se conseguimos resolver o ID (evita erro e evita “nome” que não vincula)
      ...(vendedorIdBling ? { vendedor: { id: vendedorIdBling } } : {}),
    };
    
    // ✅ NOVO: Adicionar desconto TOTAL no nível do pedido (em R$)
    // Isso mostra o desconto no resumo do pedido Bling SEM causar erro de parcelas
    // Como os itens já estão com preço líquido, este desconto é apenas informativo/visual
    if (descontoTotalVenda > 0) {
      pedidoData.desconto = {
        valor: Number(descontoTotalVenda.toFixed(2)),
        unidade: 'REAL', // Indica que é valor em R$, não percentual
      };
      console.log(`[BLING] ✅ Desconto total adicionado ao pedido: R$ ${descontoTotalVenda.toFixed(2)}`);
    }
    
    // LOG do payload completo para debug
    console.log('[BLING] Payload do pedido (estrutura chave):', {
      numero: pedidoData.numero,
      data: pedidoData.data,
      situacao: pedidoData.situacao,
      naturezaOperacao: pedidoData.naturezaOperacao,
      contatoId: pedidoData.contato?.id,
      totalItens: pedidoData.itens?.length,
      desconto: pedidoData.desconto,
    });

    // LOGS obrigatórios antes do POST
    const enderecoNumeroRef = (endereco_entrega?.numero || '').toString().trim() || 'S/N';

    console.log(`[PAYLOAD_CHECK] contato.numeroDocumentoLen=${String(pedidoData?.contato?.numeroDocumento || '').replace(/\D/g,'').length}`);
    console.log(`[PAYLOAD_CHECK] pedido.contato.id=${pedidoData.contato.id} transporte.etiqueta.numero=${enderecoNumeroRef}`);
    console.log(`[PAYLOAD_CHECK] payload.loja.id=${pedidoData.loja.id} payload.loja.unidadeNegocio.id=${pedidoData.loja.unidadeNegocio?.id || 'N/A'} itens[0].deposito.id=${pedidoData.itens[0]?.deposito?.id}`);


    // Adicionar transporte com etiqueta (endereço de entrega) - ESTRUTURA CORRETA API v3
    // ✅ Para Pedidos de Venda, o endereço de entrega vai em transporte.etiqueta
    if (endereco_entrega) {
      // Para manter o total da venda consistente com as parcelas, enviamos frete por conta do remetente (0 = CIF).
      // 0 = CIF (Remetente), 1 = FOB (Destinatário), 2 = Terceiros
      const fretePorConta = 0;

      // IMPORTANTE: Para frete manual, usar o nome da transportadora informada pelo vendedor
      // e NÃO usar o nome do cliente como fallback
      const isFreteManual = frete_tipo === 'manual';
      const transportadorNome = isFreteManual && frete_transportadora 
        ? frete_transportadora 
        : 'Correios';
      const servicoLogistico = isFreteManual 
        ? 'FRETE MANUAL' 
        : freteInfo.servico;

      // ✅ ESTRUTURA CORRETA: transporte.etiqueta para endereço de entrega
      // Usar enderecoNumeroRef que já foi sanitizado (nunca vazio)
      pedidoData.transporte = {
        fretePorConta,
        frete: valorFreteNum, // Valor do frete
        // ✅ ETIQUETA: Campo correto para endereço de entrega na API v3 de Pedidos de Venda
        etiqueta: {
          nome: nomeCompleto,
          endereco: endereco_entrega.rua || '',
          numero: enderecoNumeroRef, // NUNCA vazio - usar S/N se não tiver
          complemento: endereco_entrega.complemento || '',
          bairro: endereco_entrega.bairro || '',
          cep: (endereco_entrega.cep || '').replace(/\D/g, ''),
          municipio: endereco_entrega.cidade || '',
          uf: (endereco_entrega.estado || '').toUpperCase(),
          nomePais: 'BRASIL',
        },
        volumes: [
          {
            servico: freteInfo.servico, // PAC, SEDEX, FRETE GRATIS
            codigoRastreamento: '', // Será preenchido depois
          },
        ],
        contato: {
          nome: nomeCompleto,
          telefone: String(clienteDb?.telefone || cliente.telefone || '').replace(/\D/g, ''),
          // reforçar CPF/CNPJ também no contato de transporte
          numeroDocumento: documento,
        },
      };
      
      // Log do endereço de entrega
      console.log(`[ENDERECO_ENTREGA] Usando transporte.etiqueta: ${JSON.stringify(pedidoData.transporte.etiqueta)}`);
    }

    // ✅ LOG DE AUDITORIA: Payload Final Bling (inclui endereço completo com complemento)
    console.log('Payload Final Bling:', JSON.stringify({
      ...pedidoData,
      _meta: {
        isFaturamento: isFaturamentoPagamento,
        statusAposCreate: isFaturamentoPagamento ? 'Em andamento' : 'Em aberto (padrão Bling)',
        situacaoIdAplicar: isFaturamentoPagamento ? situacaoEmAndamentoId : null,
      }
    }, null, 2));

    // Bling aplica rate-limit bem agressivo (ex: 3 req/seg). Como este fluxo pode fazer
    // múltiplas chamadas (contato, busca produto, etc.), fazemos um pequeno delay antes
    // de criar o pedido e tentamos novamente se vier TOO_MANY_REQUESTS.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await sleep(450);

    let orderResponse: Response | undefined;
    let responseData: any = null;

    // Resolver (1x) um possível ID de transportador no Bling para frete manual.
    // Observação: o Bling tende a tratar transportador como um contato cadastrado; enviar só "nome" pode ser ignorado.
    let manualTransportadorId: number | null = null;
    const resolveManualTransportadorId = async (): Promise<number | null> => {
      if (manualTransportadorId !== null) return manualTransportadorId;
      if (frete_tipo !== 'manual' || !frete_transportadora) return null;

      const name = String(frete_transportadora).trim();
      if (!name) return null;

      const tryUrls = [
        `https://www.bling.com.br/Api/v3/contatos?nome=${encodeURIComponent(name)}`,
        `https://www.bling.com.br/Api/v3/contatos?pesquisa=${encodeURIComponent(name)}`,
      ];

      for (const url of tryUrls) {
        try {
          await sleep(350);
          const resp = await blingFetchWithRetry(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });

          const json = await resp.json().catch(() => null);
          const list: any[] = Array.isArray(json?.data) ? json.data : [];
          const found = list.find((c: any) => String(c?.nome ?? '').trim().toLowerCase() === name.toLowerCase());

          console.log('[BLING] Busca transportador (frete manual):', JSON.stringify({ url, count: list.length, foundId: found?.id ?? null }, null, 2));

          if (found?.id != null) {
            manualTransportadorId = Number(found.id);
            return manualTransportadorId;
          }
        } catch (e) {
          console.warn('[BLING] Falha ao buscar transportador por nome:', String(e));
        }
      }

      // Não achou; manter apenas o nome.
      manualTransportadorId = null;
      return null;
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      // ✅ REGRA DEFINITIVA (aplicar como última etapa antes do envio, em TODA tentativa)
      // - Para frete manual: transporte.contato.nome = nome do transportador (não cliente!)
      // - transportador.nome também deve ser o transportador
      if (frete_tipo === 'manual') {
        pedidoData.transporte = pedidoData.transporte || {};

        const transportadorId = await resolveManualTransportadorId();
        const nomeTransportador = String(frete_transportadora ?? '').trim();

        // Definir transportador
        pedidoData.transporte.transportador = transportadorId
          ? { id: transportadorId, nome: nomeTransportador }
          : { nome: nomeTransportador };

        // ✅ CORREÇÃO CRÍTICA: O Bling usa transporte.contato.nome como transportador!
        // Então precisamos colocar o nome do transportador aqui também
        pedidoData.transporte.contato = pedidoData.transporte.contato || {};
        pedidoData.transporte.contato.nome = nomeTransportador;

        // Alguns campos do Bling podem ler o serviço logístico no nível do transporte.
        pedidoData.transporte.servico_logistico = 'FRETE MANUAL';
      }

      // ✅ Log do payload FINAL COMPLETO que será enviado (por tentativa)
      console.log(`PAYLOAD BLING FINAL (PRE-SEND) [attempt ${attempt + 1}/3]:`, JSON.stringify(pedidoData, null, 2));

      orderResponse = await fetch('https://www.bling.com.br/Api/v3/pedidos/vendas', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(pedidoData),
      });

      responseData = await orderResponse.json();
      console.log('[BLING] Response /pedidos/vendas (raw):', JSON.stringify(responseData, null, 2));

      // Retry em rate limit
      if (!orderResponse.ok && responseData?.error?.type === 'TOO_MANY_REQUESTS' && attempt < 2) {
        const backoff = 800 * (attempt + 1);
        console.warn(`Bling rate limit (TOO_MANY_REQUESTS). Retry em ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }

      break;
    }

    if (!orderResponse) {
      throw new Error('Falha ao criar pedido no Bling');
    }

    if (!orderResponse.ok) {
      console.error('Erro ao criar pedido:', JSON.stringify(responseData, null, 2));

      // Extract specific error message from Bling
      let errorMessage = 'Erro ao criar pedido no Bling';
      let errorType = 'UNKNOWN_ERROR';

      const fields = responseData?.error?.fields;

      // Bling pode retornar `fields` como ARRAY ou como OBJETO (ex: { "1": { msg: "..." } })
      if (fields) {
        const fieldErrors: any[] = Array.isArray(fields) ? fields : Object.values(fields);

        const errorMessages = fieldErrors
          .map((f: any) => f?.msg)
          .filter(Boolean)
          .map((m: string) => m.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());

        if (errorMessages.length > 0) {
          const stockError = errorMessages.find((m) =>
            m.toLowerCase().includes('estoque') && m.toLowerCase().includes('insuficiente')
          );

          if (stockError) {
            errorType = 'INSUFFICIENT_STOCK';
            const productMatch = stockError.match(/insuficiente[:\s]*(.+)/i);
            const products = productMatch ? productMatch[1].trim() : '';
            errorMessage = products
              ? `Estoque insuficiente no Bling para: ${products}`
              : 'Estoque insuficiente no Bling para um ou mais produtos';
          } else {
            errorMessage = errorMessages.join('; ');
          }
        }
      } else if (responseData?.error?.message) {
        errorMessage = responseData.error.message;
      }

      console.error('Erro processado:', errorMessage, errorType);

      // Retornar 400 para erros de validação (como estoque)
      return new Response(
        JSON.stringify({ error: errorMessage, errorType }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Pedido criado com sucesso:', responseData);

    // ✅ ATUALIZAR STATUS PARA "EM ANDAMENTO" SE FOR FATURAMENTO B2B
    // O POST não aceita situacao nesta conta, então usamos PATCH após criar
    const createdOrderId = responseData?.data?.id;
    if (createdOrderId && isFaturamentoPagamento && situacaoEmAndamentoId) {
      console.log(`[BLING] Atualizando pedido ${createdOrderId} para "Em andamento" (ID: ${situacaoEmAndamentoId}) via PATCH - Faturamento B2B`);
      
      await sleep(400); // Respeitar rate limit
      
      try {
        const updateStatusResponse = await fetch(
          `https://www.bling.com.br/Api/v3/pedidos/vendas/${createdOrderId}/situacoes/${situacaoEmAndamentoId}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          }
        );
        
        if (updateStatusResponse.ok) {
          console.log(`[BLING] ✅ Status atualizado para "Em andamento" (ID: ${situacaoEmAndamentoId}) via PATCH`);
        } else {
          const updateResult = await updateStatusResponse.json();
          console.warn(`[BLING] ⚠️ Falha ao atualizar status via PATCH (pedido criado com sucesso):`, updateResult);
        }
      } catch (statusError) {
        console.warn('[BLING] ⚠️ Erro ao tentar atualizar status do pedido:', statusError);
      }
    }

    // ✅ ATUALIZAR STATUS PARA "APROVADO" SE FOR MERCADO PAGO PAGO
    // Usa "Aprovado" se existir, senão fallback para "Em andamento"
    if (createdOrderId && isMercadoPagoPago) {
      const situacaoMercadoPago = situacaoAprovadoId || situacaoEmAndamentoId;
      const nomeStatus = situacaoAprovadoId ? 'Aprovado' : 'Em andamento';
      
      console.log(`[BLING] Atualizando pedido ${createdOrderId} para "${nomeStatus}" (ID: ${situacaoMercadoPago}) via PATCH - Mercado Pago`);
      
      await sleep(400); // Respeitar rate limit
      
      try {
        const updateStatusResponse = await fetch(
          `https://www.bling.com.br/Api/v3/pedidos/vendas/${createdOrderId}/situacoes/${situacaoMercadoPago}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          }
        );
        
        if (updateStatusResponse.ok) {
          console.log(`[BLING] ✅ Status atualizado para "${nomeStatus}" (ID: ${situacaoMercadoPago}) via PATCH - Mercado Pago`);
        } else {
          const updateResult = await updateStatusResponse.json();
          console.warn(`[BLING] ⚠️ Falha ao atualizar status para "${nomeStatus}" via PATCH:`, updateResult);
        }
      } catch (statusError) {
        console.warn('[BLING] ⚠️ Erro ao tentar atualizar status para Mercado Pago:', statusError);
      }
    }

    // ✅ CORREÇÃO: Para pagamento_loja (Penha), fazer PATCH para "Em andamento"
    // O Bling ignora situacao no POST, então precisamos do PATCH igual ao B2B
    // Isso garante que a herança simples funcione na geração de NF-e (V laranja)
    if (createdOrderId && isPagamentoLoja && situacaoEmAndamentoId) {
      console.log(`[BLING] 🔄 Atualizando pedido Penha para "Em andamento" (situação ID: ${situacaoEmAndamentoId})`);
      await sleep(400);
      try {
        const updateStatusResponse = await fetch(
          `https://www.bling.com.br/Api/v3/pedidos/vendas/${createdOrderId}/situacoes/${situacaoEmAndamentoId}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          }
        );
        if (updateStatusResponse.ok) {
          console.log('[BLING] ✅ Status atualizado para "Em andamento" via PATCH - Pagamento Loja');
        } else {
          const updateResult = await updateStatusResponse.json();
          console.warn('[BLING] ⚠️ Falha ao atualizar status para "Em andamento" (Penha):', updateResult);
        }
      } catch (statusError) {
        console.warn('[BLING] ⚠️ Erro ao tentar atualizar status para Pagamento Loja:', statusError);
      }
    }

    // DEBUG: conferir a situação que o Bling gravou de fato (algumas contas sobrescrevem por automação)
    try {
      if (createdOrderId) {
        await sleep(350);
        const detailResp = await fetch(`https://www.bling.com.br/Api/v3/pedidos/vendas/${createdOrderId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });
        const detailJson = await detailResp.json();
        console.log('[BLING] Pedido criado - situação final:', {
          idPedido: createdOrderId,
          situacao: detailJson?.data?.situacao,
        });
      }
    } catch (e) {
      console.warn('[BLING] Não foi possível consultar a situação do pedido após criar.', e);
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ PROPAGAR bling_order_id PARA vendedor_propostas
    // Isso permite que bling-sync-order-status encontre a proposta
    // ═══════════════════════════════════════════════════════════════
    if (createdOrderId && pedido_id) {
      console.log(`[BLING] Propagando bling_order_id ${createdOrderId} para vendedor_propostas (proposta_id: ${pedido_id})`);
      
      try {
        const { error: propostaUpdateError } = await supabase
          .from('vendedor_propostas')
          .update({
            bling_order_id: createdOrderId,
            bling_order_number: responseData.data?.numero || null,
            status: 'PAGO',
            updated_at: new Date().toISOString(),
          })
          .eq('id', pedido_id);

        if (propostaUpdateError) {
          console.warn('[BLING] ⚠️ Erro ao propagar bling_order_id para vendedor_propostas:', propostaUpdateError);
        } else {
          console.log(`[BLING] ✅ vendedor_propostas atualizada com bling_order_id: ${createdOrderId}, status: PAGO`);
        }
      } catch (propError) {
        console.warn('[BLING] ⚠️ Erro inesperado ao propagar para vendedor_propostas:', propError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        bling_order_id: responseData.data?.id,
        bling_order_number: responseData.data?.numero,
        needs_atendido: isPagamentoLoja, // Flag para bling-generate-nfe aplicar "Atendido" após NF-e
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    // Se já identificamos um erro de estoque na checagem preventiva, devolver 400 (para o frontend tratar corretamente)
    const isInsufficientStock = errorMessage.toLowerCase().includes('estoque insuficiente');

    return new Response(
      JSON.stringify({
        error: errorMessage,
        ...(isInsufficientStock ? { errorType: 'INSUFFICIENT_STOCK' } : {}),
      }),
      {
        status: isInsufficientStock ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
