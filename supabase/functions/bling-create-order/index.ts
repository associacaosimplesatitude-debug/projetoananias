import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para renovar o token do Bling
async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log('Renovando token do Bling...');
  
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  
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
    console.error('Erro ao renovar token:', tokenData);
    throw new Error(tokenData.error_description || 'Erro ao renovar token do Bling');
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  const { error: updateError } = await supabase
    .from('bling_config')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', config.id);

  if (updateError) {
    console.error('Erro ao salvar tokens:', updateError);
    throw new Error('Erro ao salvar tokens renovados');
  }

  console.log('Token renovado com sucesso!');
  return tokenData.access_token;
}

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  return now.getTime() >= expiresAt.getTime() - 5 * 60 * 1000;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      // Dados do CONTATO (para NF) - DO FORMULÁRIO
      contato,          // { nome, tipoPessoa, cpf_cnpj, email, telefone, endereco, numero, complemento, bairro, cep, cidade, uf }
      // Endereço de ENTREGA - DO FORMULÁRIO
      endereco_entrega, // { nome, rua, numero, complemento, bairro, cep, cidade, estado }
      // Itens
      itens,            // [{ codigo, descricao, unidade, quantidade, preco_cheio, valor }]
      // Dados do pedido
      pedido_id,
      valor_frete,
      metodo_frete,
      forma_pagamento,
      valor_produtos,
      valor_total,
    } = await req.json();

    if (!itens || itens.length === 0) {
      throw new Error('Itens são obrigatórios');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar configuração do Bling
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config) {
      throw new Error('Configuração Bling não encontrada');
    }

    if (!config.access_token) {
      throw new Error('Token de acesso não configurado');
    }

    // Verificar e renovar token se necessário
    let accessToken = config.access_token;
    if (isTokenExpired(config.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, config);
    }

    // =========================================
    // 1. CRIAR/BUSCAR CONTATO NO BLING
    // =========================================
    const cnpjCpf = (contato?.cpf_cnpj || '').replace(/\D/g, '');
    const tipoPessoa = cnpjCpf.length > 11 ? 'J' : 'F';
    const nomeContato = contato?.nome || 'Consumidor Final';

    const contatoData: any = {
      nome: nomeContato,
      tipo: tipoPessoa,
      numeroDocumento: cnpjCpf,
      email: contato?.email || '',
      telefone: (contato?.telefone || '').replace(/\D/g, ''),
      situacao: 'A',
    };

    // Endereço do CONTATO (do formulário) para NF
    if (contato?.endereco || contato?.rua) {
      contatoData.endereco = {
        endereco: contato.endereco || contato.rua || '',
        numero: contato.numero || 'S/N',
        complemento: contato.complemento || '',
        bairro: contato.bairro || '',
        cep: (contato.cep || '').replace(/\D/g, ''),
        municipio: contato.cidade || '',
        uf: contato.uf || contato.estado || '',
        pais: 'Brasil',
      };
    }

    console.log('=== CONTATO (NF) - DO FORMULÁRIO ===');
    console.log(JSON.stringify(contatoData, null, 2));

    // Criar ou buscar contato no Bling
    let contatoId: number | null = null;

    const contatoResponse = await fetch('https://www.bling.com.br/Api/v3/contatos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(contatoData),
    });

    const contatoResult = await contatoResponse.json();

    if (contatoResponse.ok && contatoResult.data?.id) {
      contatoId = contatoResult.data.id;
      console.log('Contato criado, ID:', contatoId);
    } else if (cnpjCpf) {
      // Buscar contato existente
      console.log('Buscando contato existente...');
      const searchResponse = await fetch(
        `https://www.bling.com.br/Api/v3/contatos?numeroDocumento=${cnpjCpf}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        }
      );
      const searchResult = await searchResponse.json();
      if (searchResult.data?.length > 0) {
        contatoId = searchResult.data[0].id;
        console.log('Contato encontrado, ID:', contatoId);
        
        // Atualizar contato com dados do formulário
        await fetch(`https://www.bling.com.br/Api/v3/contatos/${contatoId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(contatoData),
        });
      }
    }

    // Criar contato genérico se necessário
    if (!contatoId) {
      console.log('Criando contato genérico...');
      const genericResponse = await fetch('https://www.bling.com.br/Api/v3/contatos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          nome: nomeContato || 'Consumidor Final',
          tipo: 'F',
          situacao: 'A',
        }),
      });
      const genericResult = await genericResponse.json();
      if (genericResponse.ok && genericResult.data?.id) {
        contatoId = genericResult.data.id;
        console.log('Contato genérico criado, ID:', contatoId);
      } else {
        throw new Error('Não foi possível criar contato no Bling');
      }
    }

    // =========================================
    // 2. PREPARAR ITENS
    // =========================================
    let descontoTotalVenda = 0;

    const itensBling = itens.map((item: any) => {
      const codigoProduto = String(item.codigo || '');
      const precoLista = Number(item.preco_cheio || item.valor);
      const precoComDesconto = Number(item.valor);
      const quantidade = Number(item.quantidade || 1);
      const descontoUnidade = precoLista > precoComDesconto 
        ? Number((precoLista - precoComDesconto).toFixed(2)) 
        : 0;
      
      descontoTotalVenda += descontoUnidade * quantidade;
      
      console.log(`Item: ${item.descricao}`);
      console.log(`  - Código: ${codigoProduto}`);
      console.log(`  - Preço Lista: R$ ${precoLista.toFixed(2)}`);
      console.log(`  - Desconto/Un: R$ ${descontoUnidade.toFixed(2)}`);

      const itemBling: any = {
        codigo: codigoProduto,
        descricao: item.descricao || '',
        unidade: item.unidade || 'UN',
        quantidade: quantidade,
        valor: precoLista,
      };

      if (descontoUnidade > 0) {
        itemBling.desconto = {
          valor: descontoUnidade,
          unidade: 'REAL',
        };
      }

      return itemBling;
    });

    console.log(`Desconto Total: R$ ${descontoTotalVenda.toFixed(2)}`);

    // =========================================
    // 3. TRANSPORTE - DO FORMULÁRIO
    // =========================================
    const valorFreteNum = Number(valor_frete || 0);
    
    // Calcular total correto para o Bling:
    // Total = soma(precoLista * qtd) - descontoTotal + frete
    let totalItensLista = 0;
    itens.forEach((item: any) => {
      const precoLista = Number(item.preco_cheio || item.valor);
      const quantidade = Number(item.quantidade || 1);
      totalItensLista += precoLista * quantidade;
    });
    
    // Total da venda = itens com preço de lista - desconto + frete
    const valorTotalVenda = Number((totalItensLista - descontoTotalVenda + valorFreteNum).toFixed(2));
    
    console.log('=== CÁLCULO DO TOTAL ===');
    console.log(`Total Itens (Lista): R$ ${totalItensLista.toFixed(2)}`);
    console.log(`Desconto Total: R$ ${descontoTotalVenda.toFixed(2)}`);
    console.log(`Frete: R$ ${valorFreteNum.toFixed(2)}`);
    console.log(`TOTAL VENDA: R$ ${valorTotalVenda.toFixed(2)}`);

    const tipoFreteMap: { [key: string]: string } = {
      'pac': 'PAC',
      'sedex': 'SEDEX',
      'free': 'FRETE GRATIS',
    };
    const servicoFrete = tipoFreteMap[metodo_frete?.toLowerCase()] || metodo_frete || 'PAC';

    // Nome do destinatário (do formulário)
    const nomeDestinatario = endereco_entrega?.nome || nomeContato;

    const transporteData: any = {
      volumes: [
        {
          servico: servicoFrete,
          codigoRastreamento: '',
          valorFrete: valorFreteNum,
        }
      ],
      transportadora: {
        nome: 'Correios',
      },
    };

    // ENDEREÇO DE ENTREGA - DO FORMULÁRIO
    if (endereco_entrega) {
      transporteData.enderecoEntrega = {
        nome: nomeDestinatario,
        endereco: endereco_entrega.rua || '',
        numero: endereco_entrega.numero || 'S/N',
        complemento: endereco_entrega.complemento || '',
        bairro: endereco_entrega.bairro || '',
        cep: (endereco_entrega.cep || '').replace(/\D/g, ''),
        cidade: endereco_entrega.cidade || '',
        uf: endereco_entrega.estado || '',
      };
    }

    console.log('=== ENDEREÇO ENTREGA - DO FORMULÁRIO ===');
    console.log(JSON.stringify(transporteData.enderecoEntrega, null, 2));

    // =========================================
    // 4. PAGAMENTO (descrição apenas - formaPagamento é opcional no Bling)
    // =========================================
    const pagamentoDescMap: { [key: string]: string } = {
      'pix': 'PIX',
      'card': 'Cartão',
      'boleto': 'Boleto',
    };
    const pagamentoDescricao = pagamentoDescMap[forma_pagamento?.toLowerCase()] || 'PIX';

    // =========================================
    // 5. MONTAR PEDIDO
    // =========================================
    const dataAtual = new Date().toISOString().split('T')[0];
    const dataPrevista = new Date();
    dataPrevista.setDate(dataPrevista.getDate() + 7);
    
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const numeroPedido = `${pedido_id || timestamp}-${randomSuffix}`;

    const pedidoData: any = {
      numero: numeroPedido,
      data: dataAtual,
      dataPrevista: dataPrevista.toISOString().split('T')[0],
      situacao: { id: 15 },
      loja: { id: config.loja_id || 205797806 },
      contato: { id: contatoId },
      itens: itensBling,
      transporte: transporteData,
      parcelas: [
        {
          dataVencimento: dataAtual,
          valor: valorTotalVenda,
          observacoes: `Pagamento via ${pagamentoDescricao}`,
        }
      ],
      observacoes: `Pedido EBD #${pedido_id} | Desconto 30% | ${pagamentoDescricao}`,
    };

    console.log('=== PEDIDO BLING COMPLETO ===');
    console.log(JSON.stringify(pedidoData, null, 2));

    // =========================================
    // 6. ENVIAR PARA BLING
    // =========================================
    const orderResponse = await fetch('https://www.bling.com.br/Api/v3/pedidos/vendas', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(pedidoData),
    });

    const responseData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error('Erro ao criar pedido:', JSON.stringify(responseData, null, 2));
      
      let errorMsg = responseData.error?.message || 'Erro ao criar pedido no Bling';
      let errorType = 'UNKNOWN_ERROR';
      
      if (responseData.error?.fields) {
        const fieldErrors = Object.values(responseData.error.fields) as any[];
        const errorMessages = fieldErrors.map((f: any) => f.msg).filter(Boolean);
        if (errorMessages.length > 0) {
          errorMsg = errorMessages.map((m: string) => m.replace(/<[^>]*>/g, ' ').trim()).join('; ');
          if (errorMsg.toLowerCase().includes('estoque') && errorMsg.toLowerCase().includes('insuficiente')) {
            errorType = 'INSUFFICIENT_STOCK';
          }
        }
      }
      
      return new Response(
        JSON.stringify({ error: errorMsg, errorType }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Pedido criado com sucesso:', responseData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        bling_order_id: responseData.data?.id,
        bling_order_number: responseData.data?.numero,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
