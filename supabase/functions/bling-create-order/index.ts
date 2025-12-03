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
    const { cliente, itens, pedido_id } = await req.json();

    if (!cliente || !itens || itens.length === 0) {
      throw new Error('Cliente e itens são obrigatórios');
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

    // Primeiro, criar ou buscar o contato no Bling
    const contatoData = {
      nome: cliente.nome,
      tipo: cliente.cpf?.length === 11 ? 'F' : 'J',
      numeroDocumento: cliente.cpf || cliente.cnpj || '',
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      endereco: {
        endereco: cliente.endereco?.rua || '',
        numero: cliente.endereco?.numero || 'S/N',
        complemento: cliente.endereco?.complemento || '',
        bairro: cliente.endereco?.bairro || '',
        cep: cliente.endereco?.cep?.replace(/\D/g, '') || '',
        municipio: cliente.endereco?.cidade || '',
        uf: cliente.endereco?.estado || '',
      },
    };

    console.log('Criando contato no Bling:', JSON.stringify(contatoData, null, 2));

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
      
      const searchResponse = await fetch(
        `https://www.bling.com.br/Api/v3/contatos?numeroDocumento=${cliente.cpf || cliente.cnpj || ''}`,
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

    // Se não conseguiu criar ou encontrar contato, criar um genérico
    if (!contatoId) {
      console.log('Não foi possível criar/encontrar contato, criando consumidor genérico...');
      
      const genericContatoData = {
        nome: cliente.nome || 'Consumidor Final',
        tipo: 'F',
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

    // Aplicar desconto de 30% nos itens
    const itensComDesconto = itens.map((item: any) => ({
      codigo: item.codigo,
      descricao: item.descricao,
      unidade: item.unidade || 'UN',
      quantidade: item.quantidade,
      valor: Number((item.valor * 0.7).toFixed(2)), // 30% de desconto
      tipo: 'P', // Produto
    }));

    // Gerar número único para o pedido
    const numeroPedido = `EBD-${pedido_id?.substring(0, 8).toUpperCase() || ''}-${Date.now()}`;

    // Criar pedido no Bling
    const pedidoData = {
      numero: numeroPedido,
      data: new Date().toISOString().split('T')[0],
      loja: {
        id: config.loja_id || 205797806,
      },
      contato: {
        id: contatoId,
      },
      itens: itensComDesconto,
      situacao: {
        id: 15, // Em Aberto
      },
      observacoes: `Pedido do módulo EBD - ${pedido_id}`,
    };

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
      throw new Error(responseData.error?.message || 'Erro ao criar pedido no Bling');
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
