import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== CONFIGURAÇÃO FISCAL LOJA PENHA ==========
// Série fiscal diferenciada para a loja Penha (por tipo de pessoa)
const LOJA_PENHA_ID = 205891152;
const SERIE_PENHA_PJ = 1;   // Série 1 para Pessoa Jurídica (CNPJ)
const SERIE_PENHA_PF = 15;  // Série 15 para Pessoa Física (CPF)

// Natureza de Operação específicas para Penha
const NATUREZA_PENHA_PF_ID = 15108893128; // "PENHA - Venda de mercadoria - PF"
const NATUREZA_PENHA_PJ_ID = 15108893188; // "PENHA - Venda de mercadoria - PJ"
// ====================================================

// Helper para extrair mensagem de erro fiscal do Bling
// CORRIGIDO: Agora extrai mensagens de data.error.fields quando é ARRAY (formato atual do Bling)
function extractFiscalError(data: any): string | null {
  if (!data) return null;
  
  // ========== PRIORIDADE 1: Extrair de data.error.fields (formato mais comum atualmente) ==========
  // O Bling retorna erros de validação em fields como:
  // { error: { fields: [{ field: "numero", msg: "Já existe uma nota..." }] } }
  if (data.error?.fields) {
    // Caso ARRAY (formato atual do Bling para validações)
    if (Array.isArray(data.error.fields) && data.error.fields.length > 0) {
      const fieldMsgs = data.error.fields
        .map((f: any) => f?.msg || f?.message || f?.mensagem)
        .filter(Boolean);
      if (fieldMsgs.length > 0) {
        console.log(`[extractFiscalError] Extraído de fields ARRAY: ${fieldMsgs.join(' | ')}`);
        return fieldMsgs.join(' | ');
      }
    }
    // Caso OBJETO (formato antigo)
    if (typeof data.error.fields === 'object' && !Array.isArray(data.error.fields)) {
      const fieldErrors = Object.entries(data.error.fields)
        .map(([field, msg]) => typeof msg === 'string' ? msg : (msg as any)?.msg || (msg as any)?.message)
        .filter(Boolean)
        .join('; ');
      if (fieldErrors) {
        console.log(`[extractFiscalError] Extraído de fields OBJECT: ${fieldErrors}`);
        return fieldErrors;
      }
    }
  }
  
  // ========== PRIORIDADE 2: Mensagem de erro genérica ==========
  if (data.error?.message) return data.error.message;
  if (data.error?.description) return data.error.description;
  if (data.message) return data.message;
  if (data.mensagem) return data.mensagem;
  
  // ========== PRIORIDADE 3: Arrays de erros ==========
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.map((e: any) => e.message || e.mensagem || e.msg || JSON.stringify(e)).join('; ');
  }
  if (Array.isArray(data.erros) && data.erros.length > 0) {
    return data.erros.map((e: any) => e.message || e.mensagem || e.msg || JSON.stringify(e)).join('; ');
  }
  
  return null;
}

// Função para renovar o token do Bling
async function refreshBlingToken(supabase: any, config: any, tableName: string, clientId: string, clientSecret: string): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log(`[${tableName}] Renovando token do Bling...`);
  
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const tokenResponse = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
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

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

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

  console.log(`[${tableName}] Token renovado com sucesso!`);
  return tokenData.access_token;
}

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

// Helper para extrair DANFE URL
function extractDanfeUrl(nfeDetail: any): string | null {
  if (!nfeDetail) return null;
  
  // Preferir link doc.view.php (DANFE real)
  if (nfeDetail.link && nfeDetail.link.includes('doc.view.php')) {
    return nfeDetail.link;
  }
  if (nfeDetail.linkDanfe && nfeDetail.linkDanfe.includes('doc.view.php')) {
    return nfeDetail.linkDanfe;
  }
  
  return nfeDetail.linkDanfe || nfeDetail.link || nfeDetail.linkPdf || null;
}

// ========== FUNÇÃO PARA BUSCAR ÚLTIMO NÚMERO NF-e POR SÉRIE (ESCUDO DE AUTO-NUMERAÇÃO) ==========
// VERSÃO MELHORADA: Varre até 50 páginas (5000 NF-es) para garantir encontrar o maior número
async function getLastNfeNumber(
  accessToken: string, 
  serie: number,
  apenasAutorizadas: boolean = false
): Promise<number | null> {
  console.log(`[BLING-NFE] ========== BUSCANDO ÚLTIMO NÚMERO SÉRIE ${serie} ==========`);
  console.log(`[BLING-NFE] Filtro: ${apenasAutorizadas ? 'APENAS AUTORIZADAS (situação 6)' : 'TODAS AS SITUAÇÕES'}`);
  
  try {
    let maxNumber = 0;
    let pagina = 1;
    const maxPaginas = 50; // AUMENTADO: 50 páginas = até 5000 NF-es
    let totalNfesAnalisadas = 0;
    
    while (pagina <= maxPaginas) {
      let searchUrl = `https://api.bling.com.br/Api/v3/nfe?serie=${serie}&pagina=${pagina}&limite=100`;
      if (apenasAutorizadas) {
        searchUrl += '&situacao=6';
      }
      
      // Log apenas a cada 10 páginas para não poluir
      if (pagina === 1 || pagina % 10 === 0) {
        console.log(`[BLING-NFE] Consultando página ${pagina}...`);
      }
      
      const resp = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      if (!resp.ok) {
        console.log(`[BLING-NFE] ⚠️ Erro ao buscar página ${pagina} (status: ${resp.status})`);
        break;
      }
      
      const data = await resp.json();
      const nfes = Array.isArray(data?.data) ? data.data : [];
      
      if (nfes.length === 0) {
        break;
      }
      
      for (const nfe of nfes) {
        const num = Number(nfe.numero) || 0;
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
      
      totalNfesAnalisadas += nfes.length;
      
      if (nfes.length < 100) {
        break;
      }
      
      pagina++;
    }
    
    console.log(`[BLING-NFE] ========== RESULTADO SÉRIE ${serie} ==========`);
    console.log(`[BLING-NFE] NF-es analisadas: ${totalNfesAnalisadas} | Páginas: ${pagina}`);
    console.log(`[BLING-NFE] MAIOR NÚMERO ENCONTRADO: ${maxNumber > 0 ? maxNumber : 'NENHUM'}`);
    console.log(`[BLING-NFE] ================================================`);
    
    return maxNumber > 0 ? maxNumber : null;
  } catch (error) {
    console.error(`[BLING-NFE] Erro ao buscar última NF-e da série ${serie}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bling_order_id } = await req.json();

    if (!bling_order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'bling_order_id é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ GARANTIR QUE idPedidoVenda É NÚMERO INTEIRO (API V3 exige)
    const orderId = typeof bling_order_id === 'string' 
      ? parseInt(bling_order_id, 10) 
      : bling_order_id;

    if (isNaN(orderId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'bling_order_id deve ser um número válido' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BLING-NFE] ===== INICIANDO GERAÇÃO DE NF-e para pedido: ${orderId} (tipo: ${typeof orderId}) =====`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // =======================================================================
    // PASSO 0A: BUSCAR PEDIDO PRIMEIRO (com config RJ) PARA DETECTAR LOJA
    // =======================================================================
    console.log(`[BLING-NFE] PASSO 0A: Buscando config inicial RJ para detectar loja do pedido...`);
    
    // Buscar config RJ para leitura inicial
    const { data: blingConfigRJ, error: configErrorRJ } = await supabase
      .from('bling_config')
      .select('*')
      .maybeSingle();

    if (configErrorRJ || !blingConfigRJ) {
      console.error('[BLING-NFE] Erro ao buscar config RJ:', configErrorRJ);
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do Bling RJ não encontrada', stage: 'config' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessTokenRJ = blingConfigRJ.access_token;

    // Verificar se token RJ expirou
    if (isTokenExpired(blingConfigRJ.token_expires_at)) {
      accessTokenRJ = await refreshBlingToken(
        supabase, 
        blingConfigRJ, 
        'bling_config',
        blingConfigRJ.client_id!,
        blingConfigRJ.client_secret!
      );
    }

    // Buscar pedido para detectar loja
    console.log(`[BLING-NFE] PASSO 0A: Verificando pedido ${orderId} para detectar loja...`);

    const checkPedidoUrlDetect = `https://api.bling.com.br/Api/v3/pedidos/vendas/${orderId}`;
    const checkPedidoRespDetect = await fetch(checkPedidoUrlDetect, {
      headers: {
        'Authorization': `Bearer ${accessTokenRJ}`,
        'Accept': 'application/json',
      },
    });

    if (!checkPedidoRespDetect.ok) {
      const checkError = await checkPedidoRespDetect.json().catch(() => ({}));
      const errorMsg = extractFiscalError(checkError) || 'Pedido não encontrado';
      console.log(`[BLING-NFE] ✗ Pedido não encontrado (${checkPedidoRespDetect.status}): ${errorMsg}`);

      return new Response(
        JSON.stringify({
          success: false,
          stage: 'check_order',
          bling_status: checkPedidoRespDetect.status,
          fiscal_error: `Pedido #${orderId} não encontrado no Bling. Aguarde alguns segundos e tente novamente.`,
          raw: checkError,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pedidoDataDetect = await checkPedidoRespDetect.json();
    const pedidoDetect = pedidoDataDetect?.data;
    
    // Detectar se pedido é da Loja Penha
    const isLojaPenha = pedidoDetect?.loja?.id === LOJA_PENHA_ID || 
                        pedidoDetect?.loja?.descricao?.toLowerCase().includes('penha');
    
    console.log(`[BLING-NFE] ╔══════════════════════════════════════════════════════════════╗`);
    console.log(`[BLING-NFE] ║   DETECÇÃO DE LOJA PARA GERAÇÃO DE NF-e                      ║`);
    console.log(`[BLING-NFE] ╠══════════════════════════════════════════════════════════════╣`);
    console.log(`[BLING-NFE] ║ Loja ID: ${pedidoDetect?.loja?.id}`);
    console.log(`[BLING-NFE] ║ Loja Descrição: ${pedidoDetect?.loja?.descricao}`);
    console.log(`[BLING-NFE] ║ É Loja Penha: ${isLojaPenha ? '✓ SIM' : '✗ NÃO'}`);
    console.log(`[BLING-NFE] ╚══════════════════════════════════════════════════════════════╝`);

    // =======================================================================
    // PASSO 0B: USAR TOKEN UNIFICADO (MESMA CONTA BLING PARA TODAS AS FILIAIS)
    // =======================================================================
    // CORRIGIDO: O Bling usa uma única conta OAuth para todas as filiais.
    // O que diferencia é: loja.id no payload, série da NF-e e natureza de operação.
    // Não existe bling_config_penha separado - usar sempre bling_config (RJ).
    const tableName = 'bling_config';
    const blingConfig = blingConfigRJ;
    const accessToken = accessTokenRJ;
    
    console.log(`[BLING-NFE] ✓ Usando TOKEN UNIFICADO (mesma conta Bling para todas as filiais)`);
    console.log(`[BLING-NFE] ║ Pedido da Loja: ${isLojaPenha ? 'PENHA' : 'MATRIZ RJ'}`);
    console.log(`[BLING-NFE] ║ Config usada: ${tableName} (token único)`);
    console.log(`[BLING-NFE] ║ Série/Natureza serão configuradas por filial no payload`);

    // =======================================================================
    // REUSAR DADOS DO PEDIDO JÁ BUSCADOS NO PASSO 0A (OTIMIZAÇÃO)
    // =======================================================================
    // CORRIGIDO: Não precisa buscar novamente - já temos os dados do pedido
    let pedido = pedidoDetect;
    
    console.log(`[BLING-NFE] ✓ Pedido #${pedido?.numero} pronto para gerar NF-e`, {
      contatoId: pedido?.contato?.id,
      contatoNome: pedido?.contato?.nome,
      contatoDoc: pedido?.contato?.numeroDocumento,
      totalItens: pedido?.itens?.length,
      naturezaId: pedido?.naturezaOperacao?.id,
      lojaId: pedido?.loja?.id,
      lojaDescricao: pedido?.loja?.descricao,
      unidadeNegocioId: pedido?.loja?.unidadeNegocio?.id,
      isLojaPenha: isLojaPenha,
      configUsada: tableName,
    });

    // =======================================================================
    // PASSO 1: CRIAR NF-e via POST /nfe COM PAYLOAD COMPLETO
    // Como a herança automática falha em pedidos "Atendido", montamos 
    // a NF-e manualmente com os dados do pedido.
    // =======================================================================
    console.log(`[BLING-NFE] PASSO 1: Criando NF-e com payload completo...`);

    const hoje = new Date().toISOString().split('T')[0]; // AAAA-MM-DD

    // Mapear itens do pedido para itens da NF-e
    // Inclui NCM e CFOP obrigatórios para transmissão SEFAZ
    const itensNfe = (pedido.itens || []).map((item: any, idx: number) => {
      const codigo = item.codigo || item.produto?.codigo || `ITEM-${idx + 1}`;
      const descricao = item.descricao || item.produto?.descricao || item.produto?.nome || 'Produto';
      
      // NCM: usar do produto ou padrão para livros/revistas
      const ncm = item.produto?.ncm || item.ncm || '49019900'; // 49019900 = Livros, brochuras, impressos
      
      // CFOP: usar do produto ou padrão para venda dentro do estado
      const cfop = item.produto?.cfop || item.cfop || '5102'; // 5102 = Venda mercadoria adquirida
      
      console.log(`[BLING-NFE] Item ${idx + 1}: ${codigo} - ${descricao} (qtd: ${item.quantidade}, valor: ${item.valor}, NCM: ${ncm}, CFOP: ${cfop})`);
      
      return {
        codigo: codigo,
        descricao: descricao,
        unidade: item.unidade || 'UN',
        quantidade: Number(item.quantidade) || 1,
        valor: Number(item.valor) || 0,
        tipo: 'P', // Produto
        origem: 0, // Nacional
        ncm: ncm,  // Código NCM obrigatório para SEFAZ
        cfop: cfop, // CFOP obrigatório para SEFAZ
      };
    });

    if (itensNfe.length === 0) {
      console.log(`[BLING-NFE] ✗ Pedido não possui itens!`);
      return new Response(
        JSON.stringify({
          success: false,
          stage: 'create',
          fiscal_error: 'Pedido não possui itens. Verifique o pedido no Bling.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar dados do contato
    const contato = pedido.contato;
    if (!contato?.id && !contato?.numeroDocumento) {
      console.log(`[BLING-NFE] ✗ Contato do pedido sem ID ou documento!`);
      return new Response(
        JSON.stringify({
          success: false,
          stage: 'create',
          fiscal_error: 'Cliente do pedido não possui documento (CPF/CNPJ). Atualize o cadastro no Bling.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar tipo de pessoa baseado no documento
    const numeroDoc = contato.numeroDocumento?.replace(/\D/g, '') || '';
    const tipoPessoa = numeroDoc.length > 11 ? 'J' : 'F';

    // Buscar detalhes completos do contato (o pedido pode vir sem endereço)
    let contatoDetalhe: any = contato;
    if (contato?.id) {
      try {
        const contatoUrl = `https://api.bling.com.br/Api/v3/contatos/${contato.id}`;
        const contatoResp = await fetch(contatoUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (contatoResp.ok) {
          const contatoJson = await contatoResp.json();
          contatoDetalhe = contatoJson?.data || contato;
          // API V3 do Bling: endereço está em endereco.geral
          const endGeral = contatoDetalhe?.endereco?.geral || contatoDetalhe?.endereco || {};
          console.log('[BLING-NFE] ✓ Contato detalhado carregado', {
            id: contatoDetalhe?.id,
            nome: contatoDetalhe?.nome,
            hasEndereco: !!contatoDetalhe?.endereco,
            hasEnderecoGeral: !!contatoDetalhe?.endereco?.geral,
            cep: endGeral?.cep,
            uf: endGeral?.uf,
            municipio: endGeral?.municipio,
          });
        } else {
          const contatoErr = await contatoResp.json().catch(() => ({}));
          console.log('[BLING-NFE] Aviso: não foi possível buscar contato detalhado', {
            status: contatoResp.status,
            error: extractFiscalError(contatoErr),
          });
        }
      } catch (e) {
        console.log('[BLING-NFE] Aviso: erro ao buscar contato detalhado', e);
      }
    }

    // Montar payload completo da NF-e com dados fiscais obrigatórios
    // Incluir endereço completo do contato para transmissão SEFAZ
    // API V3 do Bling: endereço está aninhado em endereco.geral
    const enderecoContato = contatoDetalhe?.endereco?.geral || contatoDetalhe?.endereco || {};

    // Validar endereço obrigatório (SEFAZ rejeita sem destinatário completo)
    const enderecoLinha = enderecoContato.endereco || enderecoContato.logradouro;
    const cep = enderecoContato.cep?.replace(/\D/g, '');
    const municipio = enderecoContato.municipio || enderecoContato.cidade;
    const uf = enderecoContato.uf || enderecoContato.estado;

    const missingAddress = !enderecoLinha || !municipio || !uf || !cep;
    if (missingAddress) {
      console.log('[BLING-NFE] ✗ Endereço do destinatário incompleto', {
        endereco: enderecoLinha,
        municipio,
        uf,
        cep,
      });

      return new Response(
        JSON.stringify({
          success: false,
          stage: 'create',
          fiscal_error: 'Endereço do destinatário incompleto (CEP/UF/Município/Endereço). Atualize o cadastro do cliente no Bling e tente novamente.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nfePayload: any = {
      tipo: 1, // 1 = Saída (venda)
      dataOperacao: hoje,
      dataEmissao: hoje,
      contato: {
        id: contatoDetalhe.id,
        nome: contatoDetalhe.nome,
        numeroDocumento: contatoDetalhe.numeroDocumento || contato.numeroDocumento,
        tipoPessoa: tipoPessoa, // 'F' = Física, 'J' = Jurídica
        // Endereço completo (obrigatório para SEFAZ)
        endereco: {
          endereco: enderecoLinha,
          numero: enderecoContato.numero || 'S/N',
          bairro: enderecoContato.bairro,
          cep: cep,
          municipio: municipio,
          uf: uf,
        },
      },
      itens: itensNfe,
      // Vincular ao pedido de venda original
      idPedidoVenda: orderId,
    };

    console.log(`[BLING-NFE] Contato completo:`, JSON.stringify(nfePayload.contato, null, 2));

    // ========== CONFIGURAÇÃO FISCAL ESPECÍFICA PARA PENHA ==========
    if (isLojaPenha) {
      // SÉRIE: Depende do tipo de pessoa
      // PJ (CNPJ) = Série 1, PF (CPF) = Série 15
      const seriePenha = tipoPessoa === 'J' ? SERIE_PENHA_PJ : SERIE_PENHA_PF;
      nfePayload.serie = seriePenha;
      
      // NATUREZA DE OPERAÇÃO: Usar natureza específica da Penha
      const naturezaIdPenha = tipoPessoa === 'J' ? NATUREZA_PENHA_PJ_ID : NATUREZA_PENHA_PF_ID;
      nfePayload.naturezaOperacao = { id: naturezaIdPenha };
      
      console.log(`[BLING-NFE] ✓ PENHA DETECTADA: Serie=${seriePenha}, Natureza=${naturezaIdPenha} (${tipoPessoa === 'J' ? 'PJ' : 'PF'})`);
    } else {
      // Para outras lojas, usar natureza do pedido se disponível
      if (pedido.naturezaOperacao?.id) {
        nfePayload.naturezaOperacao = { id: pedido.naturezaOperacao.id };
        console.log(`[BLING-NFE] Usando natureza do pedido: ${pedido.naturezaOperacao.id}`);
      }
    }
    // ================================================================

    // Adicionar loja e unidade de negócio (herdar do pedido para filtrar corretamente)
    if (pedido.loja?.id) {
      nfePayload.loja = { 
        id: pedido.loja.id 
      };
      
      // Adicionar unidade de negócio se existir
      if (pedido.loja?.unidadeNegocio?.id) {
        nfePayload.loja.unidadeNegocio = {
          id: pedido.loja.unidadeNegocio.id
        };
      }
      
      console.log(`[BLING-NFE] Loja/Unidade definidas:`, {
        lojaId: pedido.loja.id,
        lojaDescricao: pedido.loja.descricao,
        unidadeNegocioId: pedido.loja?.unidadeNegocio?.id,
        isLojaPenha: isLojaPenha,
        serieUsada: isLojaPenha ? (tipoPessoa === 'J' ? SERIE_PENHA_PJ : SERIE_PENHA_PF) : 'padrão',
      });
    }

    // ========== ESCUDO DE AUTO-NUMERAÇÃO (CONSULTA AUTORIZADAS) ==========
    // Antes de cada emissão, consulta o Bling para ver o último número AUTORIZADO.
    // Isso impede erros de "Nota com este número já existe" mesmo com emissões manuais.
    const serieParaUsar = nfePayload.serie || 15;
    console.log(`[BLING-NFE] ╔══════════════════════════════════════════════════════════════╗`);
    console.log(`[BLING-NFE] ║          ESCUDO DE AUTO-NUMERAÇÃO ATIVADO                    ║`);
    console.log(`[BLING-NFE] ╠══════════════════════════════════════════════════════════════╣`);
    console.log(`[BLING-NFE] ║ Série a usar: ${serieParaUsar}`);
    
    // PASSO 1: Buscar último número AUTORIZADO (situação 6) - prioridade
    console.log(`[BLING-NFE] ║ 🔍 Buscando última NF-e AUTORIZADA na série ${serieParaUsar}...`);
    let lastNumberPreCalc = await getLastNfeNumber(accessToken, serieParaUsar, true); // true = apenas autorizadas
    
    // PASSO 2: Se não encontrar autorizadas, buscar TODAS (pode ter em digitação, rejeitadas, etc.)
    if (!lastNumberPreCalc) {
      console.log(`[BLING-NFE] ║ ⚠️ Nenhuma NF-e autorizada encontrada. Buscando em TODOS os status...`);
      lastNumberPreCalc = await getLastNfeNumber(accessToken, serieParaUsar, false); // false = todas
    }
    
    // PASSO 3: Calcular próximo número com margem de segurança (+2)
    if (lastNumberPreCalc) {
      const nextNumberPreCalc = lastNumberPreCalc + 2; // +2 para margem de segurança
      console.log(`[BLING-NFE] ║ ✓ ÚLTIMO NÚMERO ENCONTRADO: ${lastNumberPreCalc}`);
      console.log(`[BLING-NFE] ║ ✓ PRÓXIMO NÚMERO (margem +2): ${nextNumberPreCalc}`);
      nfePayload.numero = nextNumberPreCalc;
    } else {
      console.log(`[BLING-NFE] ║ ⚠️ Nenhuma NF-e encontrada na série. Iniciando em 1.`);
      nfePayload.numero = 1;
    }
    console.log(`[BLING-NFE] ╚══════════════════════════════════════════════════════════════╝`);

    // ========== VERIFICAR SE É PJ NÃO CONTRIBUINTE (SEM IE) ==========
    // SEFAZ Rejeição 696: "Operacao com nao contribuinte deve indicar operacao com consumidor final"
    // Se for PJ (CNPJ) e não tiver Inscrição Estadual válida, deve marcar como consumidor final
    const inscricaoEstadual = contatoDetalhe?.inscricaoEstadual || contatoDetalhe?.ie || '';
    const ieValida = inscricaoEstadual && 
                     inscricaoEstadual.trim() !== '' && 
                     inscricaoEstadual.toUpperCase() !== 'ISENTO' &&
                     inscricaoEstadual.toUpperCase() !== 'ISENTA';
    
    console.log(`[BLING-NFE] ===== VERIFICAÇÃO CONSUMIDOR FINAL =====`);
    console.log(`[BLING-NFE] tipoPessoa=${tipoPessoa}, inscricaoEstadual="${inscricaoEstadual}", ieValida=${ieValida}`);
    console.log(`[BLING-NFE] isLojaPenha=${isLojaPenha}`);
    
    if (tipoPessoa === 'J' && !ieValida) {
      // ========== CORREÇÃO ERRO 696: PJ NÃO CONTRIBUINTE ==========
      // Forçar TODOS os campos necessários para SEFAZ aceitar como consumidor final
      nfePayload.indFinal = 1;       // 1 = Consumidor Final
      nfePayload.indIEDest = 9;      // 9 = Não Contribuinte (campo crítico para SEFAZ!)
      
      if (nfePayload.contato) {
        nfePayload.contato.indicadorie = 9;       // Indicador IE para Bling
        nfePayload.contato.indicadorIE = 9;       // Nome alternativo
        nfePayload.contato.indIEDest = 9;         // Nome direto do campo SEFAZ
        nfePayload.contato.inscricaoEstadual = ''; // Limpar IE
      }
      
      // ========== TRUQUE FISCAL: FORÇAR NATUREZA DE OPERAÇÃO PF ==========
      // Se for Loja Penha, usar a Natureza de PF que já funciona (ex: Bruna)
      // A Natureza PJ pode estar configurada internamente para contribuinte
      if (isLojaPenha) {
        nfePayload.naturezaOperacao = { id: NATUREZA_PENHA_PF_ID };
        console.log(`[BLING-NFE] ✓ TRUQUE FISCAL PENHA: PJ sem IE usando Natureza PF (ID ${NATUREZA_PENHA_PF_ID})`);
      }
      
      console.log(`[BLING-NFE] ✓ PJ NÃO CONTRIBUINTE - indFinal=1, indIEDest=9, indicadorie=9`);
    } else if (tipoPessoa === 'F') {
      // Pessoa física sempre é consumidor final e não contribuinte
      nfePayload.indFinal = 1;
      nfePayload.indIEDest = 9;       // 9 = Não Contribuinte
      
      if (nfePayload.contato) {
        nfePayload.contato.indicadorie = 9;
        nfePayload.contato.indicadorIE = 9;
        nfePayload.contato.indIEDest = 9;
        nfePayload.contato.inscricaoEstadual = '';
      }
      console.log(`[BLING-NFE] ✓ Pessoa Física - indFinal=1, indIEDest=9`);
    } else {
      // PJ Contribuinte com IE válida
      nfePayload.indIEDest = 1;       // 1 = Contribuinte ICMS
      if (nfePayload.contato) {
        nfePayload.contato.indicadorie = 1;
      }
      console.log(`[BLING-NFE] PJ Contribuinte com IE válida - indIEDest=1`);
    }
    console.log(`[BLING-NFE] ==========================================`);

    console.log(`[BLING-NFE] Payload NF-e FINAL:`, JSON.stringify(nfePayload, null, 2));

    const createNfeUrl = 'https://api.bling.com.br/Api/v3/nfe';
    let createNfeResp = await fetch(createNfeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nfePayload),
    });

    let createNfeData = await createNfeResp.json();
    console.log(`[BLING-NFE] Status criação (payload completo): ${createNfeResp.status}`);
    console.log(`[BLING-NFE] Resposta criação:`, JSON.stringify(createNfeData, null, 2));

    // Se payload completo falhar com erro de validação
    if (!createNfeResp.ok && createNfeResp.status === 400) {
      const fiscalError = extractFiscalError(createNfeData);
      console.log(`[BLING-NFE] Payload completo falhou. Erro extraído: "${fiscalError}"`);
      
      // ========== PRIMEIRO: Verificar se é conflito de numeração ==========
      const normalizedError = fiscalError?.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
      
      console.log(`[BLING-NFE] Erro normalizado para checagem: "${normalizedError}"`);
      
      const isNumberConflict = normalizedError.includes('ja existe uma nota com este numero') ||
                               normalizedError.includes('numero ja existe') ||
                               normalizedError.includes('ja existe nota') ||
                               normalizedError.includes('numero duplicado');
      
      if (isNumberConflict) {
        console.log(`[BLING-NFE] ╔══════════════════════════════════════════════════════════════╗`);
        console.log(`[BLING-NFE] ║   ⚠️ CONFLITO DE NUMERAÇÃO - INCREMENTO LOCAL ATIVADO        ║`);
        console.log(`[BLING-NFE] ╚══════════════════════════════════════════════════════════════╝`);
        
        const serieAtual = nfePayload.serie || 15;
        const MAX_RETRIES = 50;
        let retrySuccess = false;
        let lastRetryError = '';
        
        // ESTRATÉGIA: Incremento Local - buscar UMA vez, depois só incrementar
        console.log(`[BLING-NFE] 🔍 Buscando maior número em TODAS as situações (busca única)...`);
        let baseNumber: number = await getLastNfeNumber(accessToken, serieAtual, false) || 0;
        
        if (baseNumber === 0) {
          baseNumber = (nfePayload.numero || 1) - 1;
          console.log(`[BLING-NFE] ⚠️ Nenhum número encontrado, usando base: ${baseNumber}`);
        }
        
        const failedNumber = nfePayload.numero || 0;
        if (failedNumber > baseNumber) {
          console.log(`[BLING-NFE] 📊 Número que falhou (${failedNumber}) > GET (${baseNumber}), usando falhou como base`);
          baseNumber = failedNumber;
        }
        
        let candidateNumber = baseNumber + 1;
        console.log(`[BLING-NFE] 🎯 Base: ${baseNumber} | Candidato inicial: ${candidateNumber}`);
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (attempt % 10 === 1 || attempt <= 3) {
            console.log(`[BLING-NFE] 🔄 Tentativa ${attempt}/${MAX_RETRIES} com número #${candidateNumber}`);
          }
          
          nfePayload.numero = candidateNumber;
          
          const retryResp = await fetch(createNfeUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(nfePayload),
          });
          
          const retryData = await retryResp.json();
          
          if (retryResp.ok || retryData?.data?.id) {
            createNfeResp = retryResp;
            createNfeData = retryData;
            console.log(`[BLING-NFE] ✅ SUCESSO na tentativa ${attempt} com número #${candidateNumber}!`);
            retrySuccess = true;
            break;
          }
          
          const retryError = extractFiscalError(retryData);
          lastRetryError = retryError || 'Erro desconhecido';
          
          const normalizedRetryError = retryError?.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
          
          const stillNumberConflict = normalizedRetryError.includes('ja existe uma nota com este numero') ||
                                      normalizedRetryError.includes('numero ja existe') ||
                                      normalizedRetryError.includes('ja existe nota');
          
          if (!stillNumberConflict) {
            console.log(`[BLING-NFE] ⚠️ Erro diferente de conflito: ${retryError}`);
            break;
          }
          
          // INCREMENTO LOCAL: simplesmente +1 e tentar novamente
          candidateNumber++;
          
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        if (!retrySuccess) {
          console.log(`[BLING-NFE] ❌ TODAS AS ${MAX_RETRIES} TENTATIVAS FALHARAM`);
          console.log(`[BLING-NFE] Último número tentado: #${candidateNumber - 1}`);
          return new Response(
            JSON.stringify({
              success: false,
              stage: 'create_retry',
              fiscal_error: `Conflito de numeração na Série ${serieAtual} após ${MAX_RETRIES} tentativas. Último número tentado: #${candidateNumber - 1}. Erro: ${lastRetryError}`,
              lastAttemptedNumber: candidateNumber - 1,
              serie: serieAtual,
              attempts: MAX_RETRIES,
              raw: createNfeData,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // NÃO é conflito de numeração - tentar herança simples como fallback
        console.log(`[BLING-NFE] Não é conflito de numeração, tentando herança simples como fallback...`);
        
        const fallbackResp = await fetch(createNfeUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idPedidoVenda: orderId }),
        });
        
        const fallbackData = await fallbackResp.json();
        console.log(`[BLING-NFE] Status criação (fallback): ${fallbackResp.status}`);
        console.log(`[BLING-NFE] Resposta fallback:`, JSON.stringify(fallbackData, null, 2));
        
        // Usar resposta do fallback se funcionou OU se tem mensagem de erro diferente
        if (fallbackResp.ok || fallbackData?.data?.id) {
          createNfeResp = fallbackResp;
          createNfeData = fallbackData;
        } else {
          // Ambos falharam - retornar erro mais detalhado combinando os dois
          const fallbackError = extractFiscalError(fallbackData);
          const combinedError = fiscalError || fallbackError || 'Erro ao criar NF-e. Verifique dados do pedido no Bling.';
          
          // Extrair erros de campos específicos se existirem
          let fieldsError = '';
          const fields = createNfeData?.error?.fields || fallbackData?.error?.fields;
          if (fields) {
            if (Array.isArray(fields)) {
              fieldsError = fields.map((f: any) => f?.msg || f?.message).filter(Boolean).join(' | ');
            } else if (typeof fields === 'object') {
              fieldsError = Object.values(fields).map((f: any) => typeof f === 'string' ? f : f?.msg || f?.message).filter(Boolean).join(' | ');
            }
          }
          
          return new Response(
            JSON.stringify({
              success: false,
              stage: 'create',
              bling_status: createNfeResp.status,
              fiscal_error: fieldsError || combinedError,
              raw: { payload_error: createNfeData, fallback_error: fallbackData },
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // createNfeData já foi definido acima - usar diretamente
    console.log(`[BLING-NFE] Analisando resposta da criação de NF-e...`);

    let nfeId: number | null = null;

    // Analisar resposta da criação
    if (createNfeResp.ok && createNfeData?.data?.id) {
      // SUCESSO: NF-e criada!
      nfeId = createNfeData.data.id;
      console.log(`[BLING-NFE] ✓ NF-e criada com sucesso! ID: ${nfeId}`);
      
    } else if (createNfeResp.status === 409 || createNfeResp.status === 422) {
      // Possível duplicidade - NF-e já existe para este pedido
      const fiscalError = extractFiscalError(createNfeData);
      console.log(`[BLING-NFE] Status ${createNfeResp.status}: ${fiscalError}`);
      
      // Verificar se é erro de duplicidade
      const isDuplicate = fiscalError?.toLowerCase().includes('já existe') ||
                          fiscalError?.toLowerCase().includes('duplicad') ||
                          fiscalError?.toLowerCase().includes('already exists') ||
                          createNfeData?.data?.id; // Às vezes retorna 422 mas com o ID
      
      if (isDuplicate || createNfeData?.data?.id) {
        nfeId = createNfeData?.data?.id;
        console.log(`[BLING-NFE] NF-e já existe para este pedido. ID: ${nfeId || 'buscando...'}`);
        
        // Se não veio o ID, buscar a NF-e existente
        if (!nfeId) {
          console.log(`[BLING-NFE] Buscando NF-e existente para pedido ${bling_order_id}...`);
          const searchUrl = `https://api.bling.com.br/Api/v3/nfe?idPedidoVenda=${bling_order_id}`;
          const searchResp = await fetch(searchUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });
          
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const nfes = Array.isArray(searchData?.data) ? searchData.data : [];
            if (nfes.length > 0) {
              nfeId = nfes[0].id;
              console.log(`[BLING-NFE] NF-e encontrada: ${nfeId}`);
            }
          }
        }
        
        if (!nfeId) {
          return new Response(
            JSON.stringify({
              success: false,
              stage: 'create',
              fiscal_error: fiscalError || 'NF-e pode já existir mas não foi possível localizá-la. Verifique no Bling.',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Erro fiscal real (não é duplicidade)
        console.log(`[BLING-NFE] ✗ Erro fiscal na criação: ${fiscalError}`);
        return new Response(
          JSON.stringify({
            success: false,
            stage: 'create',
            bling_status: createNfeResp.status,
            fiscal_error: fiscalError || 'Erro ao criar NF-e. Verifique os dados do pedido no Bling.',
            raw: createNfeData,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
    } else if (createNfeResp.status === 400) {
      // Erro de validação - mostrar erro fiscal detalhado
      const fiscalError = extractFiscalError(createNfeData);
      console.log(`[BLING-NFE] ✗ Erro 400 na criação: ${fiscalError}`);
      
      return new Response(
        JSON.stringify({
          success: false,
          stage: 'create',
          bling_status: 400,
          fiscal_error: fiscalError || 'Dados do pedido incompletos ou inválidos. Verifique cliente, endereço e natureza de operação no Bling.',
          raw: createNfeData,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } else {
      // Outro erro
      const fiscalError = extractFiscalError(createNfeData);
      console.log(`[BLING-NFE] ✗ Erro ${createNfeResp.status} na criação: ${fiscalError}`);
      
      return new Response(
        JSON.stringify({
          success: false,
          stage: 'create',
          bling_status: createNfeResp.status,
          fiscal_error: fiscalError || `Erro inesperado ao criar NF-e (código ${createNfeResp.status}).`,
          raw: createNfeData,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =======================================================================
    // PASSO 2: ENVIAR NF-e para SEFAZ via POST /nfe/{id}/enviar
    // =======================================================================
    console.log(`[BLING-NFE] PASSO 2: Enviando NF-e ${nfeId} para SEFAZ...`);
    
    const sendNfeUrl = `https://api.bling.com.br/Api/v3/nfe/${nfeId}/enviar`;
    const sendNfeResp = await fetch(sendNfeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const sendNfeData = await sendNfeResp.json();
    console.log(`[BLING-NFE] Status envio: ${sendNfeResp.status}`);
    console.log(`[BLING-NFE] Resposta envio:`, JSON.stringify(sendNfeData, null, 2));

    // Se o Bling retornar XML da SEFAZ, extrair motivo (ex.: Rejeição 726)
    const sefazXml: string | undefined = sendNfeData?.data?.xml;
    const xmlInfProtMotivo = typeof sefazXml === 'string'
      ? (sefazXml.match(/<infProt[\s\S]*?<xMotivo>([^<]+)<\/xMotivo>/)?.[1] || null)
      : null;
    const xmlInfProtCStat = typeof sefazXml === 'string'
      ? (sefazXml.match(/<infProt[\s\S]*?<cStat>(\d+)<\/cStat>/)?.[1] || null)
      : null;
    
    // ====== DIAGNÓSTICO: Extrair campos fiscais do XML para debug do erro 696 ======
    if (typeof sefazXml === 'string') {
      const xmlIndFinal = sefazXml.match(/<indFinal>(\d)<\/indFinal>/)?.[1];
      const xmlIndIEDest = sefazXml.match(/<indIEDest>(\d)<\/indIEDest>/)?.[1];
      const xmlIdDest = sefazXml.match(/<idDest>(\d)<\/idDest>/)?.[1];
      const xmlIndPres = sefazXml.match(/<indPres>(\d)<\/indPres>/)?.[1];
      const xmlCNPJ = sefazXml.match(/<dest>[\s\S]*?<CNPJ>([^<]+)<\/CNPJ>/)?.[1];
      const xmlCPF = sefazXml.match(/<dest>[\s\S]*?<CPF>([^<]+)<\/CPF>/)?.[1];
      const xmlIE = sefazXml.match(/<dest>[\s\S]*?<IE>([^<]*)<\/IE>/)?.[1];
      
      console.log('[BLING-NFE] ╔═══════════════════════════════════════════════════════════════╗');
      console.log('[BLING-NFE] ║            DIAGNÓSTICO XML ENVIADO À SEFAZ                    ║');
      console.log('[BLING-NFE] ╠═══════════════════════════════════════════════════════════════╣');
      console.log(`[BLING-NFE] ║ indFinal no XML:  ${xmlIndFinal || 'NÃO ENCONTRADO'} (esperado: 1 para consumidor final)`);
      console.log(`[BLING-NFE] ║ indIEDest no XML: ${xmlIndIEDest || 'NÃO ENCONTRADO'} (esperado: 9 para não contribuinte)`);
      console.log(`[BLING-NFE] ║ idDest no XML:    ${xmlIdDest || 'NÃO ENCONTRADO'} (1=interna, 2=interestadual, 3=exterior)`);
      console.log(`[BLING-NFE] ║ indPres no XML:   ${xmlIndPres || 'NÃO ENCONTRADO'} (0=N/A, 1=presencial, 2=internet...)`);
      console.log(`[BLING-NFE] ║ Destinatário:     ${xmlCNPJ ? `CNPJ ${xmlCNPJ}` : (xmlCPF ? `CPF ${xmlCPF}` : 'NÃO ENCONTRADO')}`);
      console.log(`[BLING-NFE] ║ IE Destinatário:  ${xmlIE !== undefined ? (xmlIE || 'VAZIA') : 'NÃO ENCONTRADO'}`);
      console.log('[BLING-NFE] ╚═══════════════════════════════════════════════════════════════╝');
      
      // ALERTA ESPECÍFICO para erro 696
      if (xmlIndFinal !== '1' || xmlIndIEDest !== '9') {
        console.warn('[BLING-NFE] ⚠️ PROBLEMA DETECTADO! Para não-contribuinte precisa: indFinal=1 e indIEDest=9');
        console.warn(`[BLING-NFE] ⚠️ Valores atuais: indFinal=${xmlIndFinal}, indIEDest=${xmlIndIEDest}`);
      }
    }
    
    // Guardar erro SEFAZ do envio para uso posterior em rejeição
    let sefazErrorFromSend = '';
    if (xmlInfProtCStat && xmlInfProtMotivo) {
      sefazErrorFromSend = `SEFAZ cStat ${xmlInfProtCStat}: ${xmlInfProtMotivo}`;
      console.log('[BLING-NFE] Retorno SEFAZ do envio:', sefazErrorFromSend);
    }

    if (!sendNfeResp.ok) {
      const fiscalError = extractFiscalError(sendNfeData);
      
      // Verificar se é erro de "já enviada"
      const alreadySent = fiscalError?.toLowerCase().includes('já enviada') ||
                          fiscalError?.toLowerCase().includes('already sent') ||
                          fiscalError?.toLowerCase().includes('autorizada');
      
      if (!alreadySent) {
        console.log(`[BLING-NFE] ✗ Erro ao enviar para SEFAZ: ${fiscalError}`);
        return new Response(
          JSON.stringify({
            success: false,
            stage: 'send',
            bling_status: sendNfeResp.status,
            fiscal_error: fiscalError || 'Erro ao enviar NF-e para SEFAZ. Verifique os dados fiscais no Bling.',
            nfe_id: nfeId,
            raw: sendNfeData,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[BLING-NFE] NF-e já foi enviada anteriormente, verificando status...`);
    } else {
      console.log(`[BLING-NFE] ✓ NF-e enviada para SEFAZ com sucesso!`);
    }

    // =======================================================================
    // PASSO 3: POLLING DE AUTORIZAÇÃO (4 tentativas, intervalo 1.5s)
    // =======================================================================
    const MAX_POLLING_ATTEMPTS = 4;
    const POLLING_INTERVAL_MS = 1500;

    for (let attempt = 1; attempt <= MAX_POLLING_ATTEMPTS; attempt++) {
      console.log(`[BLING-NFE] PASSO 3: Verificando autorização (tentativa ${attempt}/${MAX_POLLING_ATTEMPTS})...`);
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));

      const checkNfeUrl = `https://api.bling.com.br/Api/v3/nfe/${nfeId}`;
      const checkNfeResp = await fetch(checkNfeUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!checkNfeResp.ok) {
        console.log(`[BLING-NFE] Erro ao verificar NF-e na tentativa ${attempt}: ${checkNfeResp.status}`);
        continue;
      }

      const checkNfeData = await checkNfeResp.json();
      const nfeDetail = checkNfeData?.data;
      const situacao = Number(nfeDetail?.situacao);
      
      console.log(`[BLING-NFE] Tentativa ${attempt}: Situação NF-e: ${situacao} (6=Autorizada, 4/5=Rejeitada)`);
      
      // ========== DIAGNÓSTICO: CAPTURA DO XML FINAL DA NF-e ==========
      // Tentar extrair o XML real que foi enviado à SEFAZ para verificar indFinal/indIEDest
      const xmlFinal = nfeDetail?.xml || nfeDetail?.xmlNfe || nfeDetail?.xmlEnvio;
      if (typeof xmlFinal === 'string' && xmlFinal.length > 0) {
        // Decodificar se estiver escapado (HTML entities)
        let xmlDecoded = xmlFinal;
        if (xmlFinal.includes('&lt;') || xmlFinal.includes('&gt;')) {
          xmlDecoded = xmlFinal
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"');
        }
        
        // Extrair campos do bloco <ide> (identificação da NF-e) - suporta namespace
        const xmlIndFinalFinal = xmlDecoded.match(/<(?:\w+:)?indFinal>(\d)<\/(?:\w+:)?indFinal>/)?.[1];
        const xmlIndIEDestFinal = xmlDecoded.match(/<(?:\w+:)?indIEDest>(\d)<\/(?:\w+:)?indIEDest>/)?.[1];
        const xmlIdDestFinal = xmlDecoded.match(/<(?:\w+:)?idDest>(\d)<\/(?:\w+:)?idDest>/)?.[1];
        const xmlIndPresFinal = xmlDecoded.match(/<(?:\w+:)?indPres>(\d)<\/(?:\w+:)?indPres>/)?.[1];
        
        console.log('[BLING-NFE] ╔══════════════════════════════════════════════════════════════╗');
        console.log('[BLING-NFE] ║          XML FINAL DA NF-e (do GET /nfe/{id})               ║');
        console.log('[BLING-NFE] ╠══════════════════════════════════════════════════════════════╣');
        console.log(`[BLING-NFE] ║ indFinal:  ${xmlIndFinalFinal ?? 'NÃO ENCONTRADO'} (esperado: 1)`);
        console.log(`[BLING-NFE] ║ indIEDest: ${xmlIndIEDestFinal ?? 'NÃO ENCONTRADO'} (esperado: 9)`);
        console.log(`[BLING-NFE] ║ idDest:    ${xmlIdDestFinal ?? 'NÃO ENCONTRADO'}`);
        console.log(`[BLING-NFE] ║ indPres:   ${xmlIndPresFinal ?? 'NÃO ENCONTRADO'}`);
        console.log('[BLING-NFE] ╚══════════════════════════════════════════════════════════════╝');
        
        // ALERTA se valores incorretos
        if ((xmlIndFinalFinal && xmlIndFinalFinal !== '1') || (xmlIndIEDestFinal && xmlIndIEDestFinal !== '9')) {
          console.error('[BLING-NFE] ⚠️⚠️⚠️ XML FINAL INCORRETO! Bling ignorou nossos campos!');
          console.error(`[BLING-NFE] ⚠️ Payload enviou indFinal=1, indIEDest=9 mas XML tem: indFinal=${xmlIndFinalFinal}, indIEDest=${xmlIndIEDestFinal}`);
        }
      } else {
        console.log(`[BLING-NFE] Tentativa ${attempt}: XML não disponível no detalhe da NF-e (chaves: ${Object.keys(nfeDetail || {}).filter(k => k.toLowerCase().includes('xml')).join(', ') || 'nenhuma com xml'})`);
      }

      if (situacao === 6) {
        // AUTORIZADA!
        const danfeUrl = extractDanfeUrl(nfeDetail);
        const nfeNumero = nfeDetail?.numero;
        const nfeChave = nfeDetail?.chaveAcesso || null;
        
        console.log(`[BLING-NFE] ✓ NF-e AUTORIZADA na tentativa ${attempt}!`, {
          nfeId,
          numero: nfeNumero,
          chave: nfeChave,
          url: danfeUrl,
        });
        
        // SALVAR NO BANCO DE DADOS - vendas_balcao (venda de balcão/loja)
        const updatePayload: any = {
          nfe_id: nfeId,
          status_nfe: 'AUTORIZADA',
          nota_fiscal_numero: String(nfeNumero),
          nota_fiscal_chave: nfeChave,
          nota_fiscal_url: danfeUrl,
        };
        
        // Primeiro tentar atualizar em vendas_balcao (fluxo principal para Pagar na Loja)
        const { data: vendaBalcao, error: vendaBalcaoError } = await supabase
          .from('vendas_balcao')
          .update(updatePayload)
          .eq('bling_order_id', orderId)
          .select('id')
          .maybeSingle();
        
        if (vendaBalcao) {
          console.log('[BLING-NFE] ✓ Dados da NF-e salvos em vendas_balcao com sucesso!');
        } else {
          // Fallback: tentar atualizar em ebd_shopify_pedidos (pedidos online)
          const { error: updateError } = await supabase
            .from('ebd_shopify_pedidos')
            .update(updatePayload)
            .eq('bling_order_id', orderId);
          
          if (updateError) {
            console.error('[BLING-NFE] Erro ao salvar NF-e no banco:', updateError);
          } else {
            console.log('[BLING-NFE] ✓ Dados da NF-e salvos em ebd_shopify_pedidos com sucesso!');
          }
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            nfe_id: nfeId,
            nfe_numero: nfeNumero,
            nfe_chave: nfeChave,
            nfe_url: danfeUrl,
            nfe_pendente: false,
            stage: 'authorized',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Situação 4 = Rejeitada definitivamente
      if (situacao === 4) {
        // PRIORIDADE 1: Tentar extrair motivo do XML da NF-e detalhada
        let rejectReason = '';
        
        try {
          const nfeXml = nfeDetail?.xml;
          if (typeof nfeXml === 'string') {
            const sefazMotivo = nfeXml.match(/<infProt[\s\S]*?<xMotivo>([^<]+)<\/xMotivo>/)?.[1];
            const sefazCstat = nfeXml.match(/<infProt[\s\S]*?<cStat>(\d+)<\/cStat>/)?.[1];
            if (sefazCstat && sefazMotivo) {
              rejectReason = `SEFAZ cStat ${sefazCstat}: ${sefazMotivo}`;
            }
          }
        } catch (e) {
          console.log('[BLING-NFE] Erro ao extrair motivo do XML do detalhe:', e);
        }
        
        // PRIORIDADE 2: Usar erro do envio inicial (capturado antes do polling)
        if (!rejectReason && sefazErrorFromSend) {
          rejectReason = sefazErrorFromSend;
        }
        
        // PRIORIDADE 3: Campos padrão do Bling
        if (!rejectReason) {
          rejectReason = nfeDetail?.motivoRejeicao || nfeDetail?.erroEnvio || '';
        }
        
        // PRIORIDADE 4: Fallback genérico
        if (!rejectReason) {
          rejectReason = 'Motivo não retornado pelo Bling. Verifique os logs para detalhes.';
        }
        
        console.log(`[BLING-NFE] NF-e REJEITADA na tentativa ${attempt}: ${rejectReason}`);
        
        // Atualizar status no banco - tentar vendas_balcao primeiro
        const { data: rejeitadaBalcao } = await supabase
          .from('vendas_balcao')
          .update({ status_nfe: 'REJEITADA', nfe_id: nfeId })
          .eq('bling_order_id', orderId)
          .select('id')
          .maybeSingle();
        
        if (!rejeitadaBalcao) {
          await supabase
            .from('ebd_shopify_pedidos')
            .update({ status_nfe: 'REJEITADA', nfe_id: nfeId })
            .eq('bling_order_id', orderId);
        }
        
        return new Response(
          JSON.stringify({
            success: false,
            stage: 'authorization',
            nfe_id: nfeId,
            fiscal_error: `NF-e rejeitada pela SEFAZ: ${rejectReason}`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Situação 5 = Estado intermediário (aguardando/processando) - NÃO É REJEIÇÃO!
      if (situacao === 5) {
        console.log(`[BLING-NFE] NF-e em estado intermediário (situação 5) na tentativa ${attempt} - aguardando...`);
        // Atualizar status no banco como processando - tentar vendas_balcao primeiro
        const { data: processandoBalcao } = await supabase
          .from('vendas_balcao')
          .update({ status_nfe: 'PROCESSANDO', nfe_id: nfeId })
          .eq('bling_order_id', orderId)
          .select('id')
          .maybeSingle();
        
        if (!processandoBalcao) {
          await supabase
            .from('ebd_shopify_pedidos')
            .update({ status_nfe: 'PROCESSANDO', nfe_id: nfeId })
            .eq('bling_order_id', orderId);
        }
        // Continua o polling, não retorna erro
      }
    }

    // Após 4 tentativas, retornar pendente (não é erro!)
    console.log(`[BLING-NFE] NF-e ainda pendente após ${MAX_POLLING_ATTEMPTS} tentativas - retornando sucesso com pendente`);
    
    // Atualizar status como processando - tentar vendas_balcao primeiro
    const { data: pendingBalcao } = await supabase
      .from('vendas_balcao')
      .update({ status_nfe: 'PROCESSANDO', nfe_id: nfeId })
      .eq('bling_order_id', orderId)
      .select('id')
      .maybeSingle();
    
    if (!pendingBalcao) {
      await supabase
        .from('ebd_shopify_pedidos')
        .update({ status_nfe: 'PROCESSANDO', nfe_id: nfeId })
        .eq('bling_order_id', orderId);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        nfe_id: nfeId,
        nfe_pendente: true,
        polling_attempts: MAX_POLLING_ATTEMPTS,
        stage: 'polling',
        message: 'Nota em processamento. Verifique o menu Notas Emitidas.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BLING-NFE] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stage: 'unknown',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
