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

  console.log('Token renovado com sucesso! Expira em:', expiresAt.toISOString());
  return tokenData.access_token;
}

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      // Dados do Cliente (Igreja - para Nota Fiscal)
      igreja,           // { nome, cnpj, ie, endereco, numero, complemento, bairro, cep, cidade, uf, email, telefone }
      // Dados do Endereço de Entrega (Superintendente)
      endereco_entrega, // { nome, rua, numero, complemento, bairro, cep, cidade, estado }
      // Itens do pedido
      itens,            // [{ codigo (Bling), descricao, unidade, quantidade, preco_cheio, valor }]
      // Dados do pedido
      pedido_id,
      valor_frete,
      metodo_frete,     // PAC, SEDEX, FREE
      forma_pagamento,  // PIX, CARTAO, BOLETO
      valor_produtos,   // Total dos produtos com desconto
      valor_total,      // Total final (produtos + frete)
      // Fallback: dados do cliente do checkout (se igreja não vier)
      cliente,
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
      console.log('Token expirado, renovando...');
      accessToken = await refreshBlingToken(supabase, config);
    }

    // =========================================
    // 1. DADOS DO CLIENTE (IGREJA - Para NF)
    // =========================================
    // Usar dados da igreja se disponível, senão usar dados do cliente do checkout
    const dadosContato = igreja || cliente || {};
    
    const cnpjCpf = (dadosContato.cnpj || dadosContato.cpf_cnpj || '').replace(/\D/g, '');
    const tipoPessoa = cnpjCpf.length > 11 ? 'J' : 'F';
    const nomeContato = dadosContato.nome || (cliente?.nome ? `${cliente.nome} ${cliente.sobrenome || ''}`.trim() : 'Consumidor Final');

    // Construir dados do contato para Bling
    const contatoData: any = {
      nome: nomeContato,
      tipo: tipoPessoa,
      numeroDocumento: cnpjCpf,
      email: dadosContato.email || cliente?.email || '',
      telefone: (dadosContato.telefone || cliente?.telefone || '').replace(/\D/g, ''),
      situacao: 'A',
    };

    // Adicionar endereço da Igreja (para NF)
    if (dadosContato.endereco || dadosContato.rua) {
      contatoData.endereco = {
        endereco: dadosContato.endereco || dadosContato.rua || '',
        numero: dadosContato.numero || 'S/N',
        complemento: dadosContato.complemento || '',
        bairro: dadosContato.bairro || '',
        cep: (dadosContato.cep || '').replace(/\D/g, ''),
        municipio: dadosContato.cidade || dadosContato.municipio || '',
        uf: dadosContato.uf || dadosContato.estado || '',
        pais: 'Brasil',
      };
    } else if (endereco_entrega) {
      // Fallback: usar endereço de entrega se não tiver endereço da igreja
      contatoData.endereco = {
        endereco: endereco_entrega.rua || '',
        numero: endereco_entrega.numero || 'S/N',
        complemento: endereco_entrega.complemento || '',
        bairro: endereco_entrega.bairro || '',
        cep: (endereco_entrega.cep || '').replace(/\D/g, ''),
        municipio: endereco_entrega.cidade || '',
        uf: endereco_entrega.estado || '',
        pais: 'Brasil',
      };
    }

    console.log('=== DADOS DO CONTATO (IGREJA) ===');
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
    } else {
      // Tentar buscar contato existente
      console.log('Contato pode existir, buscando...');
      if (cnpjCpf) {
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
          
          // Atualizar contato existente
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
    // 2. ITENS DO PEDIDO
    // =========================================
    let descontoTotalVenda = 0;

    const itensBling = itens.map((item: any) => {
      // CÓDIGO do produto no Bling (não o ID interno do Lovable)
      const codigoProduto = String(item.codigo || item.bling_produto_id || '');
      
      // Preço de Lista (sem desconto)
      const precoLista = Number(item.preco_cheio || item.valor);
      // Preço com desconto
      const precoComDesconto = Number(item.valor);
      const quantidade = Number(item.quantidade || 1);
      
      // Calcular desconto por unidade
      const descontoUnidade = precoLista > precoComDesconto 
        ? Number((precoLista - precoComDesconto).toFixed(2)) 
        : 0;
      
      descontoTotalVenda += descontoUnidade * quantidade;
      
      console.log(`Item: ${item.descricao || item.titulo}`);
      console.log(`  - Código Bling: ${codigoProduto}`);
      console.log(`  - Preço Lista: R$ ${precoLista.toFixed(2)}`);
      console.log(`  - Preço Desconto: R$ ${precoComDesconto.toFixed(2)}`);
      console.log(`  - Desconto/Unidade: R$ ${descontoUnidade.toFixed(2)}`);
      console.log(`  - Quantidade: ${quantidade}`);

      const itemBling: any = {
        codigo: codigoProduto, // CÓDIGO DO PRODUTO NO BLING
        descricao: item.descricao || item.titulo || '',
        unidade: item.unidade || 'UN',
        quantidade: quantidade,
        valor: precoLista, // PREÇO DE LISTA (sem desconto)
      };

      // Adicionar desconto se houver
      if (descontoUnidade > 0) {
        itemBling.desconto = {
          valor: descontoUnidade,
          unidade: 'REAL', // REAL para valor absoluto
        };
      }

      return itemBling;
    });

    console.log(`Desconto Total da Venda: R$ ${descontoTotalVenda.toFixed(2)}`);

    // =========================================
    // 3. TRANSPORTE (Frete e Endereço de Entrega)
    // =========================================
    const valorFreteNum = Number(valor_frete || 0);
    const valorProdutosNum = Number(valor_produtos || 0);
    const valorTotalNum = valorProdutosNum + valorFreteNum;

    // Mapear tipo de frete
    const tipoFreteMap: { [key: string]: string } = {
      'pac': 'PAC',
      'sedex': 'SEDEX',
      'free': 'FRETE GRATIS',
    };
    const servicoFrete = tipoFreteMap[metodo_frete?.toLowerCase()] || metodo_frete || 'PAC';

    // Nome do destinatário (do endereço de entrega)
    const nomeDestinatario = endereco_entrega?.nome || 
      (cliente?.nome ? `${cliente.nome} ${cliente.sobrenome || ''}`.trim() : nomeContato);

    // Dados de transporte seguindo estrutura correta do Bling API v3
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

    // ENDEREÇO DE ENTREGA (Superintendente)
    if (endereco_entrega) {
      transporteData.enderecoEntrega = {
        nome: nomeDestinatario,
        endereco: endereco_entrega.rua || '',
        numero: endereco_entrega.numero || 'S/N', // NÚMERO SEPARADO
        complemento: endereco_entrega.complemento || '',
        bairro: endereco_entrega.bairro || '',
        cep: (endereco_entrega.cep || '').replace(/\D/g, ''),
        cidade: endereco_entrega.cidade || '',
        uf: endereco_entrega.estado || '',
      };
    }

    // =========================================
    // 4. PAGAMENTO
    // =========================================
    const formaPagamentoMap: { [key: string]: { id: number; descricao: string } } = {
      'pix': { id: 1, descricao: 'PIX' },
      'card': { id: 2, descricao: 'Cartão de Crédito' },
      'boleto': { id: 3, descricao: 'Boleto Bancário' },
    };
    const pagamentoInfo = formaPagamentoMap[forma_pagamento?.toLowerCase()] || { id: 1, descricao: 'PIX' };

    // =========================================
    // 5. MONTAR PEDIDO COMPLETO
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
      situacao: {
        id: 15, // Em Aberto
      },
      loja: {
        id: config.loja_id || 205797806,
      },
      contato: {
        id: contatoId,
      },
      itens: itensBling,
      transporte: transporteData,
      parcelas: [
        {
          dataVencimento: dataAtual,
          valor: valorTotalNum,
          observacoes: `Pagamento via ${pagamentoInfo.descricao}`,
          formaPagamento: {
            id: pagamentoInfo.id,
          },
        }
      ],
      observacoes: `Pedido EBD #${pedido_id} | Desconto Parceiro 30% | Pagamento: ${pagamentoInfo.descricao}`,
    };

    // Adicionar desconto total se houver
    if (descontoTotalVenda > 0) {
      pedidoData.desconto = {
        valor: Number(descontoTotalVenda.toFixed(2)),
        unidade: 'REAL',
      };
    }

    console.log('=== PEDIDO BLING COMPLETO ===');
    console.log(JSON.stringify(pedidoData, null, 2));

    // =========================================
    // 6. ENVIAR PEDIDO PARA BLING
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
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
