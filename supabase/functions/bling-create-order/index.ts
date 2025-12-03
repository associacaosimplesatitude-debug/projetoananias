import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
const { 
      cliente,          // Dados do cliente do formulário (nome, sobrenome, cpf_cnpj, email)
      endereco_entrega, // Endereço de entrega do checkout
      itens,            // Itens com preço já com desconto
      pedido_id,
      valor_frete,
      metodo_frete,     // PAC, SEDEX, FREE
      forma_pagamento,  // PIX, CARTAO, BOLETO
      valor_produtos,
      valor_total
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

    // Determinar se é CPF ou CNPJ
    const documento = cliente.cpf_cnpj?.replace(/\D/g, '') || '';
    const tipoDocumento = documento.length > 11 ? 'J' : 'F';
    
    // Nome completo do cliente
    const nomeCompleto = cliente.sobrenome 
      ? `${cliente.nome} ${cliente.sobrenome}` 
      : cliente.nome;

    // Criar ou buscar o contato do Cliente no Bling
    const contatoData = {
      nome: nomeCompleto,
      tipo: tipoDocumento,
      numeroDocumento: documento,
      email: cliente.email || '',
      telefone: cliente.telefone?.replace(/\D/g, '') || '',
      situacao: 'A', // A = Ativo (obrigatório para Bling API v3)
    };

    console.log('Criando contato do Cliente no Bling:', JSON.stringify(contatoData, null, 2));

    const contatoResponse = await fetch('https://www.bling.com.br/Api/v3/contatos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
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
      // Se o contato já existe, tentar buscar pelo documento
      console.log('Contato pode já existir, buscando...');
      
      if (documento) {
        const searchResponse = await fetch(
          `https://www.bling.com.br/Api/v3/contatos?numeroDocumento=${documento}`,
          {
            headers: {
              'Authorization': `Bearer ${config.access_token}`,
              'Accept': 'application/json',
            },
          }
        );

        const searchResult = await searchResponse.json();
        if (searchResult.data && searchResult.data.length > 0) {
          contatoId = searchResult.data[0].id;
          console.log('Contato encontrado, ID:', contatoId);
        }
      }
    }

    // Se não conseguiu criar ou encontrar contato, criar um genérico
    if (!contatoId) {
      console.log('Não foi possível criar/encontrar contato, criando consumidor genérico...');
      
      const genericContatoData = {
        nome: nomeCompleto || 'Consumidor Final',
        tipo: 'F',
        situacao: 'A', // A = Ativo (obrigatório para Bling API v3)
      };

      const genericResponse = await fetch('https://www.bling.com.br/Api/v3/contatos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
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
    
    // Preparar itens (já vêm com preço com desconto)
    const itensBling = itens.map((item: any) => ({
      codigo: item.codigo,
      descricao: item.descricao,
      unidade: item.unidade || 'UN',
      quantidade: item.quantidade,
      valor: Number(item.valor.toFixed(2)), // Preço já com desconto
      tipo: 'P',
    }));

    // Gerar número único para o pedido
    const numeroPedido = `${timestamp}-${randomSuffix}`;

    // Mapear tipo de frete
    const tipoFreteMap: { [key: string]: string } = {
      'pac': 'PAC',
      'sedex': 'SEDEX',
      'free': 'Frete Grátis',
    };
    const tipoFreteDescricao = tipoFreteMap[metodo_frete?.toLowerCase()] || metodo_frete || 'A Combinar';

    // Mapear forma de pagamento
    const formaPagamentoMap: { [key: string]: string } = {
      'pix': 'PIX',
      'card': 'Cartão de Crédito',
      'boleto': 'Boleto Bancário',
    };
    const formaPagamentoDescricao = formaPagamentoMap[forma_pagamento?.toLowerCase()] || forma_pagamento || 'Outros';

    // Montar observações detalhadas
    const observacoes = [
      `Pedido EBD #${pedido_id}`,
      `Forma de Pagamento: ${formaPagamentoDescricao}`,
      `Tipo de Frete: ${tipoFreteDescricao}`,
      `Valor Produtos: R$ ${(valor_produtos || 0).toFixed(2)}`,
      `Valor Frete: R$ ${(valor_frete || 0).toFixed(2)}`,
      `Valor Total: R$ ${(valor_total || 0).toFixed(2)}`,
      `Gerado em: ${new Date().toISOString()}`,
    ].join(' | ');

    // Criar pedido no Bling com dados de transporte
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
    };

    // Adicionar transporte/endereço de entrega se disponível
    if (endereco_entrega) {
      pedidoData.transporte = {
        frete: valor_frete || 0,
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
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(pedidoData),
    });

    const responseData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error('Erro ao criar pedido:', JSON.stringify(responseData, null, 2));
      
      let errorMsg = responseData.error?.message || 'Erro ao criar pedido no Bling';
      
      if (responseData.error?.fields) {
        const fieldErrors = Object.values(responseData.error.fields) as any[];
        const errorMessages = fieldErrors.map((f: any) => f.msg).filter(Boolean);
        if (errorMessages.length > 0) {
          errorMsg = errorMessages.map((m: string) => m.replace(/<[^>]*>/g, ' ').trim()).join('; ');
        }
      }
      
      throw new Error(errorMsg);
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
