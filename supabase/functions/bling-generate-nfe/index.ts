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
function extractFiscalError(data: any): string | null {
  if (!data) return null;
  
  // Tentar diferentes formatos de erro do Bling
  if (data.error?.message) return data.error.message;
  if (data.error?.description) return data.error.description;
  if (data.message) return data.message;
  if (data.mensagem) return data.mensagem;
  
  // Array de erros
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.map((e: any) => e.message || e.mensagem || JSON.stringify(e)).join('; ');
  }
  if (Array.isArray(data.erros) && data.erros.length > 0) {
    return data.erros.map((e: any) => e.message || e.mensagem || JSON.stringify(e)).join('; ');
  }
  
  // Estrutura data.error com campos específicos
  if (data.error?.fields) {
    const fieldErrors = Object.entries(data.error.fields)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join('; ');
    if (fieldErrors) return fieldErrors;
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

// ========== FUNÇÃO PARA BUSCAR ÚLTIMO NÚMERO NF-e POR SÉRIE (MELHORADA) ==========
async function getLastNfeNumber(
  accessToken: string, 
  serie: number
): Promise<number | null> {
  console.log(`[BLING-NFE] ========== BUSCANDO ÚLTIMO NÚMERO SÉRIE ${serie} ==========`);
  
  try {
    let maxNumber = 0;
    let pagina = 1;
    const maxPaginas = 5; // Buscar até 5 páginas para garantir encontrar o maior número
    let totalNfesAnalisadas = 0;
    
    while (pagina <= maxPaginas) {
      // Buscar NF-es autorizadas (situacao=6) nesta série
      const searchUrl = `https://api.bling.com.br/Api/v3/nfe?serie=${serie}&situacao=6&pagina=${pagina}&limite=100`;
      
      console.log(`[BLING-NFE] Consultando página ${pagina}: ${searchUrl}`);
      
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
      
      console.log(`[BLING-NFE] Página ${pagina}: ${nfes.length} NF-es retornadas`);
      
      if (nfes.length === 0) {
        console.log(`[BLING-NFE] Página ${pagina} vazia, parando busca.`);
        break;
      }
      
      // Encontrar o maior número nesta página
      for (const nfe of nfes) {
        const num = Number(nfe.numero) || 0;
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
      
      totalNfesAnalisadas += nfes.length;
      console.log(`[BLING-NFE] Página ${pagina}: maior até agora = ${maxNumber}`);
      
      // Se retornou menos de 100, é a última página
      if (nfes.length < 100) {
        console.log(`[BLING-NFE] Página ${pagina} com menos de 100 itens, fim da busca.`);
        break;
      }
      
      pagina++;
    }
    
    console.log(`[BLING-NFE] ========== RESULTADO SÉRIE ${serie} ==========`);
    console.log(`[BLING-NFE] Total de NF-es analisadas: ${totalNfesAnalisadas}`);
    console.log(`[BLING-NFE] Páginas consultadas: ${pagina}`);
    console.log(`[BLING-NFE] ÚLTIMO NÚMERO ENCONTRADO: ${maxNumber > 0 ? maxNumber : 'NENHUM'}`);
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

    // Usar integração RJ (todas as vendas presenciais usam bling_config RJ)
    const tableName = 'bling_config';
    console.log(`[BLING-NFE] Usando configuração: ${tableName}`);
    
    const { data: blingConfig, error: configError } = await supabase
      .from(tableName)
      .select('*')
      .single();

    if (configError || !blingConfig) {
      console.error('[BLING-NFE] Erro ao buscar config:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do Bling não encontrada', stage: 'config' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = blingConfig.access_token;

    // Verificar se token expirou
    if (isTokenExpired(blingConfig.token_expires_at)) {
      accessToken = await refreshBlingToken(
        supabase, 
        blingConfig, 
        tableName,
        blingConfig.client_id!,
        blingConfig.client_secret!
      );
    }

    // =======================================================================
    // PASSO 0: VERIFICAR SE O PEDIDO EXISTE NO BLING
    // =======================================================================
    console.log(`[BLING-NFE] PASSO 0: Verificando pedido ${orderId}...`);

    const checkPedidoUrl = `https://api.bling.com.br/Api/v3/pedidos/vendas/${orderId}`;
    const checkPedidoResp = await fetch(checkPedidoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!checkPedidoResp.ok) {
      const checkError = await checkPedidoResp.json().catch(() => ({}));
      const errorMsg = extractFiscalError(checkError) || 'Pedido não encontrado';
      console.log(`[BLING-NFE] ✗ Pedido não encontrado (${checkPedidoResp.status}): ${errorMsg}`);

      return new Response(
        JSON.stringify({
          success: false,
          stage: 'check_order',
          bling_status: checkPedidoResp.status,
          fiscal_error: `Pedido #${orderId} não encontrado no Bling. Aguarde alguns segundos e tente novamente.`,
          raw: checkError,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pedidoData = await checkPedidoResp.json();
    let pedido = pedidoData?.data;
    // Detectar se pedido é da Loja Penha
    const isLojaPenha = pedido?.loja?.id === LOJA_PENHA_ID || 
                        pedido?.loja?.descricao?.toLowerCase().includes('penha');
    
    console.log(`[BLING-NFE] ✓ Pedido encontrado: #${pedido?.numero}`, {
      contatoId: pedido?.contato?.id,
      contatoNome: pedido?.contato?.nome,
      contatoDoc: pedido?.contato?.numeroDocumento,
      totalItens: pedido?.itens?.length,
      naturezaId: pedido?.naturezaOperacao?.id,
      lojaId: pedido?.loja?.id,
      lojaDescricao: pedido?.loja?.descricao,
      unidadeNegocioId: pedido?.loja?.unidadeNegocio?.id,
      isLojaPenha: isLojaPenha,
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

    // ========== PRÉ-CALCULAR PRÓXIMO NÚMERO (EVITAR CONFLITO) ==========
    // Como o Bling pode ter a config "Próximo número" desatualizada,
    // vamos descobrir o número real antes de criar a NF-e
    const serieParaUsar = nfePayload.serie || 15;
    console.log(`[BLING-NFE] ===== PRÉ-CÁLCULO DE NUMERAÇÃO =====`);
    console.log(`[BLING-NFE] Série a usar: ${serieParaUsar}`);
    console.log(`[BLING-NFE] Buscando último número emitido na série ${serieParaUsar}...`);
    
    const lastNumberPreCalc = await getLastNfeNumber(accessToken, serieParaUsar);
    
    if (lastNumberPreCalc) {
      const nextNumberPreCalc = lastNumberPreCalc + 1;
      console.log(`[BLING-NFE] ✓ ÚLTIMO NÚMERO: ${lastNumberPreCalc}`);
      console.log(`[BLING-NFE] ✓ PRÓXIMO NÚMERO CALCULADO: ${nextNumberPreCalc}`);
      console.log(`[BLING-NFE] Forçando numero=${nextNumberPreCalc} no payload para evitar conflito`);
      nfePayload.numero = nextNumberPreCalc;
    } else {
      console.log(`[BLING-NFE] ⚠️ Não foi possível obter último número. Deixando Bling escolher (pode dar conflito).`);
    }
    console.log(`[BLING-NFE] =====================================`);

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
    
    if (tipoPessoa === 'J' && !ieValida) {
      // PJ não contribuinte = consumidor final
      nfePayload.indFinal = 1;
      console.log(`[BLING-NFE] ✓ PJ NÃO CONTRIBUINTE DETECTADO - Definindo indFinal=1 (consumidor final)`);
    } else if (tipoPessoa === 'F') {
      // Pessoa física sempre é consumidor final
      nfePayload.indFinal = 1;
      console.log(`[BLING-NFE] ✓ Pessoa Física - indFinal=1 (consumidor final)`);
    } else {
      console.log(`[BLING-NFE] PJ Contribuinte com IE válida - indFinal não necessário`);
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

    // Se payload completo falhar com erro de validação, tentar herança simples como fallback
    if (!createNfeResp.ok && createNfeResp.status === 400) {
      const fiscalError = extractFiscalError(createNfeData);
      console.log(`[BLING-NFE] Payload completo falhou (${fiscalError}), tentando herança simples...`);
      
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

    // ========== AUTO-RETRY: Detectar conflito de numeração e tentar com próximo número ==========
    const fiscalErrorCheck = extractFiscalError(createNfeData);
    console.log(`[BLING-NFE] Verificando conflito de numeração. fiscalError="${fiscalErrorCheck}"`);
    
    // Normalizar para comparação (remover acentos e lowercase)
    const normalizedError = fiscalErrorCheck?.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
    
    const isNumberConflict = normalizedError.includes('ja existe uma nota com este numero') ||
                             normalizedError.includes('numero ja existe');

    if (isNumberConflict && !createNfeData?.data?.id) {
      console.log(`[BLING-NFE] ⚠️ Conflito de numeração detectado, buscando próximo número disponível...`);
      
      // Identificar qual série está sendo usada
      const serieAtual = nfePayload.serie || 15;
      
      // Buscar último número autorizado
      const lastNumber = await getLastNfeNumber(accessToken, serieAtual);
      
      if (lastNumber) {
        const nextNumber = lastNumber + 1;
        console.log(`[BLING-NFE] 🔄 Tentando novamente com número ${nextNumber} (série ${serieAtual})...`);
        
        // Forçar o próximo número no payload
        nfePayload.numero = nextNumber;
        
        // Segunda tentativa com número forçado
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
        console.log(`[BLING-NFE] Status retry: ${retryResp.status}`);
        console.log(`[BLING-NFE] Resposta retry:`, JSON.stringify(retryData, null, 2));
        
        // Substituir resposta original pela retry
        if (retryResp.ok || retryData?.data?.id) {
          createNfeResp = retryResp;
          createNfeData = retryData;
          console.log(`[BLING-NFE] ✓ Retry com número ${nextNumber} funcionou!`);
        } else {
          // Retry também falhou - retornar erro detalhado
          const retryError = extractFiscalError(retryData);
          console.log(`[BLING-NFE] ✗ Retry falhou: ${retryError}`);
          
          return new Response(
            JSON.stringify({
              success: false,
              stage: 'create_retry',
              fiscal_error: `Conflito de numeração na Série ${serieAtual}. Última NF-e: #${lastNumber}. Tentativa com #${nextNumber} falhou: ${retryError}`,
              lastNumber: lastNumber,
              attemptedNumber: nextNumber,
              serie: serieAtual,
              raw: retryData,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.log(`[BLING-NFE] ⚠️ Não foi possível obter último número da série, retornando erro original`);
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

    if (xmlInfProtCStat && xmlInfProtMotivo) {
      // Log informativo apenas - NÃO retornar erro aqui
      // A situação 6 do Bling é a fonte de verdade para autorização
      console.log('[BLING-NFE] Retorno SEFAZ (info only)', { cStat: xmlInfProtCStat, xMotivo: xmlInfProtMotivo });
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
        const rejectReason = nfeDetail?.motivoRejeicao || nfeDetail?.erroEnvio || 'Motivo não informado';
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
