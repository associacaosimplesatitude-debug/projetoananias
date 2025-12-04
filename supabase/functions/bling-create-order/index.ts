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

  // Calcular nova expiração
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  // Atualizar tokens no banco
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

// Função para verificar se o token está expirado ou próximo de expirar
function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  // Considera expirado se faltam menos de 5 minutos
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      cliente,          // Dados do cliente do formulário (nome, sobrenome, cpf_cnpj, email, telefone)
      endereco_entrega, // Endereço de entrega do checkout (rua, numero, complemento, bairro, cep, cidade, estado)
      itens,            // Itens com preço de lista (preco_cheio) e preço com desconto (valor)
      pedido_id,
      valor_frete,
      metodo_frete,     // PAC, SEDEX, FREE
      forma_pagamento,  // PIX, CARTAO, BOLETO
      valor_produtos,   // Total dos produtos com desconto
      valor_total       // Total final (produtos + frete)
    } = await req.json();

    if (!cliente || !itens || itens.length === 0) {
      throw new Error('Dados do cliente e itens são obrigatórios');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar configuração
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config) {
      throw new Error('Configuração não encontrada');
    }

    if (!config.access_token) {
      throw new Error('Token de acesso não configurado');
    }

    // Verificar se o token está expirado e renovar se necessário
    let accessToken = config.access_token;
    if (isTokenExpired(config.token_expires_at)) {
      console.log('Token expirado ou próximo de expirar, renovando...');
      accessToken = await refreshBlingToken(supabase, config);
    }

    // Determinar se é CPF ou CNPJ
    const documento = cliente.cpf_cnpj?.replace(/\D/g, '') || '';
    const tipoDocumento = documento.length > 11 ? 'J' : 'F';
    
    // Nome completo do cliente
    const nomeCompleto = cliente.sobrenome 
      ? `${cliente.nome} ${cliente.sobrenome}` 
      : cliente.nome;

    // Criar ou buscar o contato do Cliente no Bling com endereço completo para NF
    const contatoData: any = {
      nome: nomeCompleto,
      tipo: tipoDocumento,
      numeroDocumento: documento,
      email: cliente.email || '',
      telefone: cliente.telefone?.replace(/\D/g, '') || '',
      situacao: 'A', // A = Ativo (obrigatório para Bling API v3)
    };

    // Adicionar endereço ao contato (obrigatório para emissão de NF)
    if (endereco_entrega) {
      contatoData.endereco = {
        endereco: endereco_entrega.rua || '',
        numero: endereco_entrega.numero || 'S/N',
        complemento: endereco_entrega.complemento || '',
        bairro: endereco_entrega.bairro || '',
        cep: endereco_entrega.cep?.replace(/\D/g, '') || '',
        municipio: endereco_entrega.cidade || '',
        uf: endereco_entrega.estado || '',
        pais: 'Brasil',
      };
    }

    console.log('Criando contato do Cliente no Bling com endereço:', JSON.stringify(contatoData, null, 2));

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
    let contatoId: number | null = null;

    if (contatoResponse.ok && contatoResult.data?.id) {
      contatoId = contatoResult.data.id;
      console.log('Contato criado com sucesso, ID:', contatoId);
    } else if (contatoResult.error?.fields) {
      // Se o contato já existe, tentar buscar pelo documento e atualizar
      console.log('Contato pode já existir, buscando...');
      
      if (documento) {
        const searchResponse = await fetch(
          `https://www.bling.com.br/Api/v3/contatos?numeroDocumento=${documento}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          }
        );

        const searchResult = await searchResponse.json();
        if (searchResult.data && searchResult.data.length > 0) {
          contatoId = searchResult.data[0].id;
          console.log('Contato encontrado, ID:', contatoId);
          
          // Atualizar o contato existente com os dados de endereço
          console.log('Atualizando contato existente com endereço...');
          const updateResponse = await fetch(`https://www.bling.com.br/Api/v3/contatos/${contatoId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(contatoData),
          });
          
          if (updateResponse.ok) {
            console.log('Contato atualizado com sucesso');
          } else {
            console.log('Não foi possível atualizar contato, continuando...');
          }
        }
      }
    }

    // Se não conseguiu criar ou encontrar contato, criar um genérico com endereço
    if (!contatoId) {
      console.log('Não foi possível criar/encontrar contato, criando consumidor genérico com endereço...');
      
      const genericContatoData: any = {
        nome: nomeCompleto || 'Consumidor Final',
        tipo: 'F',
        situacao: 'A', // A = Ativo (obrigatório para Bling API v3)
      };

      // Adicionar endereço mesmo para contato genérico
      if (endereco_entrega) {
        genericContatoData.endereco = {
          endereco: endereco_entrega.rua || '',
          numero: endereco_entrega.numero || 'S/N',
          complemento: endereco_entrega.complemento || '',
          bairro: endereco_entrega.bairro || '',
          cep: endereco_entrega.cep?.replace(/\D/g, '') || '',
          municipio: endereco_entrega.cidade || '',
          uf: endereco_entrega.estado || '',
          pais: 'Brasil',
        };
      }

      const genericResponse = await fetch('https://www.bling.com.br/Api/v3/contatos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(genericContatoData),
      });

      const genericResult = await genericResponse.json();
      if (genericResponse.ok && genericResult.data?.id) {
        contatoId = genericResult.data.id;
        console.log('Contato genérico criado, ID:', contatoId);
      } else {
        console.error('Erro ao criar contato genérico:', genericResult);
        throw new Error('Não foi possível criar contato no Bling');
      }
    }

    // Gerar identificadores únicos
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Calcular desconto total da venda
    let descontoTotalVenda = 0;
    
    // Preparar itens com Preço de Lista e Desconto separados
    // Bling API v3: valor = preço de lista, desconto = valor do desconto por unidade
    const itensBling = itens.map((item: any) => {
      const blingProdutoId = parseInt(item.codigo, 10);
      
      // preco_cheio = preço de tabela (sem desconto)
      // valor = preço com desconto aplicado
      const precoLista = Number(item.preco_cheio || item.valor);
      const precoComDesconto = Number(item.valor);
      const quantidade = Number(item.quantidade);
      
      // Calcular desconto por unidade
      const descontoUnidade = precoLista > precoComDesconto ? Number((precoLista - precoComDesconto).toFixed(2)) : 0;
      
      // Acumular desconto total
      descontoTotalVenda += descontoUnidade * quantidade;
      
      console.log(`Item: ${item.descricao}`);
      console.log(`  - bling_produto_id: ${item.codigo} -> ${blingProdutoId}`);
      console.log(`  - Preço Lista: R$ ${precoLista.toFixed(2)}`);
      console.log(`  - Preço com Desconto: R$ ${precoComDesconto.toFixed(2)}`);
      console.log(`  - Desconto por Unidade: R$ ${descontoUnidade.toFixed(2)}`);
      console.log(`  - Quantidade: ${quantidade}`);
      
      if (!blingProdutoId || isNaN(blingProdutoId)) {
        console.error(`ERRO: bling_produto_id inválido para item: ${item.descricao}`);
      }
      
      const itemBling: any = {
        produto: {
          id: blingProdutoId, // ID interno do produto no Bling
        },
        descricao: item.descricao,
        unidade: item.unidade || 'UN',
        quantidade: quantidade,
        valor: precoLista, // Preço de Lista (sem desconto)
      };
      
      // Adicionar desconto apenas se houver
      if (descontoUnidade > 0) {
        itemBling.desconto = {
          valor: descontoUnidade, // Desconto por unidade em valor absoluto
          tipo: 'VALOR', // Tipo de desconto: VALOR ou PERCENTUAL
        };
      }
      
      return itemBling;
    });

    console.log(`Desconto Total da Venda: R$ ${descontoTotalVenda.toFixed(2)}`);

    // Gerar número único para o pedido
    const numeroPedido = `${timestamp}-${randomSuffix}`;

    // Mapear tipo de frete para nome do transportador
    const tipoFreteMap: { [key: string]: { nome: string; servico: string } } = {
      'pac': { nome: 'Correios', servico: 'PAC' },
      'sedex': { nome: 'Correios', servico: 'SEDEX' },
      'free': { nome: 'Frete Grátis', servico: 'FRETE GRATIS' },
    };
    const freteInfo = tipoFreteMap[metodo_frete?.toLowerCase()] || { nome: 'Correios', servico: metodo_frete || 'A Combinar' };

    // Mapear forma de pagamento
    const formaPagamentoMap: { [key: string]: string } = {
      'pix': 'PIX',
      'card': 'Cartão de Crédito',
      'boleto': 'Boleto Bancário',
    };
    const formaPagamentoDescricao = formaPagamentoMap[forma_pagamento?.toLowerCase()] || forma_pagamento || 'Outros';

    // Calcular valores corretos
    const valorFreteNum = Number(valor_frete || 0);
    const valorProdutosNum = Number(valor_produtos || 0);
    const valorTotalCorreto = valorProdutosNum + valorFreteNum;

    console.log('=== RESUMO DO PEDIDO ===');
    console.log(`Valor Produtos (com desconto): R$ ${valorProdutosNum.toFixed(2)}`);
    console.log(`Valor Frete: R$ ${valorFreteNum.toFixed(2)}`);
    console.log(`Valor Total: R$ ${valorTotalCorreto.toFixed(2)}`);
    console.log(`Desconto Total: R$ ${descontoTotalVenda.toFixed(2)}`);
    console.log(`Transportador: ${freteInfo.nome} - ${freteInfo.servico}`);

    // Montar observações detalhadas
    const observacoes = [
      `Pedido EBD #${pedido_id}`,
      `Forma de Pagamento: ${formaPagamentoDescricao}`,
      `Transportador: ${freteInfo.nome}`,
      `Serviço: ${freteInfo.servico}`,
      `Valor Produtos: R$ ${valorProdutosNum.toFixed(2)}`,
      `Desconto Total: R$ ${descontoTotalVenda.toFixed(2)}`,
      `Valor Frete: R$ ${valorFreteNum.toFixed(2)}`,
      `Valor Total: R$ ${valorTotalCorreto.toFixed(2)}`,
      `Gerado em: ${new Date().toISOString()}`,
    ].join(' | ');

    // Criar pedido no Bling com dados de transporte corretos
    const pedidoData: any = {
      numero: numeroPedido,
      data: new Date().toISOString().split('T')[0],
      loja: {
        id: config.loja_id || 205797806,
      },
      contato: {
        id: contatoId,
      },
      itens: itensBling,
      situacao: {
        id: 15, // Em Aberto
      },
      observacoes: observacoes,
      // Parcelas - OBRIGATÓRIO: soma deve ser igual ao total da venda (produtos + frete)
      parcelas: [
        {
          dataVencimento: new Date().toISOString().split('T')[0],
          valor: valorTotalCorreto, // Total = produtos com desconto + frete
          observacoes: `Pagamento via ${formaPagamentoDescricao}`,
        }
      ],
    };

    // Adicionar desconto total da venda se houver
    if (descontoTotalVenda > 0) {
      pedidoData.desconto = {
        valor: Number(descontoTotalVenda.toFixed(2)),
        tipo: 'VALOR',
      };
    }

    // Adicionar transporte/endereço de entrega se disponível
    // Estrutura correta para Bling API v3:
    // - transportador.nome = "Correios"
    // - transportador.servico_logistico = "PAC" / "SEDEX" / "FRETE GRATIS"
    // - volumes = array com detalhes do frete
    if (endereco_entrega) {
      pedidoData.transporte = {
        fretePorConta: 'R', // R = Remetente (CIF), D = Destinatário (FOB)
        transportador: {
          nome: 'Correios', // Nome fixo do transportador
          servico_logistico: freteInfo.servico, // PAC, SEDEX, FRETE GRATIS
        },
        volumes: [
          {
            servico: freteInfo.servico, // PAC, SEDEX, FRETE GRATIS
            codigoRastreamento: '', // Será preenchido depois
          }
        ],
        frete: valorFreteNum, // Valor do frete
        contato: {
          nome: nomeCompleto,
          telefone: cliente.telefone?.replace(/\D/g, '') || '',
        },
        endereco: {
          endereco: endereco_entrega.rua || '',
          numero: endereco_entrega.numero || 'S/N',
          complemento: endereco_entrega.complemento || '',
          bairro: endereco_entrega.bairro || '',
          cep: endereco_entrega.cep?.replace(/\D/g, '') || '',
          municipio: endereco_entrega.cidade || '',
          uf: endereco_entrega.estado || '',
        },
      };
    }

    console.log('Criando pedido no Bling:', JSON.stringify(pedidoData, null, 2));

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
          
          // Detectar erro de estoque insuficiente
          if (errorMsg.toLowerCase().includes('estoque') && errorMsg.toLowerCase().includes('insuficiente')) {
            errorType = 'INSUFFICIENT_STOCK';
          }
        }
      }
      
      // Retornar 400 para erros de validação (como estoque)
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
