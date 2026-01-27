import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge Function: mp-sync-orphan-order
 * 
 * Recupera pedidos Mercado Pago que foram pagos mas não têm pedido no Bling
 * (geralmente porque a proposta original foi deletada antes do pagamento)
 * 
 * Aceita:
 *   - pedido_id: UUID do pedido em ebd_shopify_pedidos_mercadopago
 * 
 * Fluxo:
 *   1. Busca o pedido MP com todos os dados
 *   2. Busca o cliente em ebd_clientes para dados completos (CPF/CNPJ)
 *   3. Chama bling-create-order com os itens do pedido
 *   4. Atualiza o pedido com bling_order_id
 *   5. Cria a comissão para a vendedora (se ainda não existir)
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { pedido_id } = await req.json();

    if (!pedido_id) {
      throw new Error('pedido_id é obrigatório');
    }

    console.log('=== MP-SYNC-ORPHAN-ORDER ===');
    console.log('Processando pedido:', pedido_id);

    // 1. Buscar o pedido MP
    const { data: pedido, error: pedidoError } = await supabase
      .from('ebd_shopify_pedidos_mercadopago')
      .select('*')
      .eq('id', pedido_id)
      .single();

    if (pedidoError || !pedido) {
      throw new Error(`Pedido não encontrado: ${pedido_id}`);
    }

    console.log('Pedido encontrado:', {
      id: pedido.id,
      status: pedido.status,
      cliente_nome: pedido.cliente_nome,
      valor_total: pedido.valor_total,
      vendedor_email: pedido.vendedor_email,
      bling_order_id: pedido.bling_order_id,
    });

    // Verificar se já tem Bling Order
    if (pedido.bling_order_id) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Pedido já possui bling_order_id',
          bling_order_id: pedido.bling_order_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Verificar se está pago
    if (pedido.status !== 'PAGO') {
      throw new Error(`Pedido não está com status PAGO (atual: ${pedido.status})`);
    }

    // 2. Buscar dados completos do cliente
    let clienteCompleto = {
      nome: pedido.cliente_nome?.split(' ')[0] || 'Cliente',
      sobrenome: pedido.cliente_nome?.split(' ').slice(1).join(' ') || '',
      cpf_cnpj: pedido.cliente_cpf_cnpj || '',
      email: pedido.cliente_email || '',
      telefone: pedido.cliente_telefone || '',
    };

    if (pedido.cliente_id) {
      const { data: clienteDB } = await supabase
        .from('ebd_clientes')
        .select('*')
        .eq('id', pedido.cliente_id)
        .single();

      if (clienteDB) {
        console.log('Cliente encontrado no banco:', clienteDB.nome_fantasia);
        clienteCompleto = {
          nome: clienteDB.nome_fantasia?.split(' ')[0] || clienteDB.razao_social?.split(' ')[0] || 'Cliente',
          sobrenome: clienteDB.nome_fantasia?.split(' ').slice(1).join(' ') || clienteDB.razao_social?.split(' ').slice(1).join(' ') || '',
          cpf_cnpj: clienteDB.cnpj || clienteDB.cpf || pedido.cliente_cpf_cnpj || '',
          email: clienteDB.email || pedido.cliente_email || '',
          telefone: clienteDB.telefone || pedido.cliente_telefone || '',
        };
      }
    }

    console.log('Cliente para Bling:', clienteCompleto);

    // 3. Montar endereço de entrega
    const endereco_entrega = {
      rua: pedido.endereco_rua || '',
      numero: pedido.endereco_numero || '',
      complemento: pedido.endereco_complemento || '',
      bairro: pedido.endereco_bairro || '',
      cep: pedido.endereco_cep || '',
      cidade: pedido.endereco_cidade || '',
      estado: pedido.endereco_estado || '',
    };

    // 4. Converter itens do JSON para formato Bling (com desconto aplicado)
    const items = pedido.items || [];
    const itensBling = items.map((item: any) => {
      const precoCheio = Number(parseFloat(item.price || '0').toFixed(2));
      const descontoPercentual = Number(item.descontoItem || 0);
      
      // Calcular preço líquido com desconto
      const precoLiquido = descontoPercentual > 0 
        ? Math.round(precoCheio * (1 - descontoPercentual / 100) * 100) / 100
        : precoCheio;

      console.log(`Item ${item.sku}: preço cheio=${precoCheio}, desconto=${descontoPercentual}%, líquido=${precoLiquido}`);

      return {
        codigo: item.sku || item.variantId || '0',
        descricao: item.title || 'Produto Shopify',
        unidade: 'UN',
        quantidade: item.quantity || 1,
        preco_cheio: precoCheio,
        valor: precoLiquido,
      };
    });

    console.log('Itens para Bling:', itensBling.length, 'itens');

    // 5. Normalizar método de frete
    let metodoFreteNormalizado = pedido.metodo_frete || 'pac';
    if (metodoFreteNormalizado === 'manual') {
      if (pedido.valor_frete === 0 || pedido.valor_frete === null) {
        metodoFreteNormalizado = 'retirada';
      }
    }

    // 6. Chamar bling-create-order
    console.log('Chamando bling-create-order...');
    
    const blingResponse = await fetch(`${supabaseUrl}/functions/v1/bling-create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        cliente: clienteCompleto,
        cliente_id: pedido.cliente_id,
        endereco_entrega,
        itens: itensBling,
        pedido_id: pedido.id.slice(0, 8).toUpperCase(),
        valor_frete: pedido.valor_frete || 0,
        metodo_frete: metodoFreteNormalizado,
        forma_pagamento: pedido.payment_method || 'pix',
        valor_produtos: pedido.valor_produtos || 0,
        valor_total: pedido.valor_total || 0,
        vendedor_email: pedido.vendedor_email,
        vendedor_nome: pedido.vendedor_nome,
        vendedor_id: pedido.vendedor_id,
        origem: 'shopify_mercadopago_orphan_recovery',
      }),
    });

    let blingOrderId = null;

    if (blingResponse.ok) {
      const blingData = await blingResponse.json();
      console.log('Resposta do Bling:', blingData);
      
      if (blingData.bling_order_id) {
        blingOrderId = blingData.bling_order_id;
        console.log('✅ Pedido criado no Bling com ID:', blingOrderId);
      } else {
        console.warn('⚠️ Bling não retornou order_id:', blingData);
      }
    } else {
      const errorText = await blingResponse.text();
      console.error('❌ Erro ao criar pedido no Bling:', errorText);
      throw new Error(`Erro ao criar pedido no Bling: ${errorText}`);
    }

    // 7. Atualizar o pedido MP com o bling_order_id
    if (blingOrderId) {
      const { error: updateError } = await supabase
        .from('ebd_shopify_pedidos_mercadopago')
        .update({
          bling_order_id: blingOrderId,
          bling_created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', pedido.id);

      if (updateError) {
        console.error('Erro ao atualizar pedido MP:', updateError);
      } else {
        console.log('✅ Pedido MP atualizado com bling_order_id');
      }
    }

    // 8. Criar comissão se ainda não existe
    let comissaoCriada = false;
    let valorComissao = 0;

    if (pedido.vendedor_id) {
      // Verificar se já existe comissão para este pedido
      const { data: existingParcela } = await supabase
        .from('vendedor_propostas_parcelas')
        .select('id')
        .eq('mp_pedido_id', pedido.id)
        .maybeSingle();

      if (existingParcela) {
        console.log('⚠️ Comissão já existe para este pedido');
      } else {
        // Buscar percentual de comissão do vendedor
        const { data: vendedorData } = await supabase
          .from('vendedores')
          .select('comissao_percentual, email')
          .eq('id', pedido.vendedor_id)
          .single();

        const comissaoPercentual = vendedorData?.comissao_percentual || 1.5;
        const valorTotal = pedido.valor_total || 0;
        valorComissao = Math.round((valorTotal * (comissaoPercentual / 100)) * 100) / 100;
        const hoje = new Date().toISOString().split('T')[0];

        const vendedorEmail = pedido.vendedor_email || vendedorData?.email || null;

        const { error: parcelaError } = await supabase
          .from('vendedor_propostas_parcelas')
          .insert({
            proposta_id: pedido.proposta_id || null,
            vendedor_id: pedido.vendedor_id,
            vendedor_email: vendedorEmail,
            cliente_id: pedido.cliente_id,
            numero_parcela: 1,
            total_parcelas: 1,
            valor: valorTotal,
            valor_comissao: valorComissao,
            data_vencimento: hoje,
            data_pagamento: hoje,
            status: 'paga',
            origem: 'mercadopago',
            comissao_status: 'liberada',
            data_liberacao: hoje,
            bling_order_id: blingOrderId,
            mp_pedido_id: pedido.id,
            metodo_pagamento: pedido.payment_method || 'pix',
          });

        if (parcelaError) {
          console.error('❌ Erro ao criar comissão:', parcelaError);
        } else {
          comissaoCriada = true;
          console.log(`✅ Comissão criada: vendedor=${vendedorEmail}, valor=R$${valorComissao}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pedido_id: pedido.id,
        cliente_nome: pedido.cliente_nome,
        valor_total: pedido.valor_total,
        bling_order_id: blingOrderId,
        comissao_criada: comissaoCriada,
        valor_comissao: valorComissao,
        vendedor_email: pedido.vendedor_email,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Erro na sincronização:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
