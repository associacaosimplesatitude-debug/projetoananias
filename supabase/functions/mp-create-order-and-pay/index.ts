import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentRequest {
  proposta_id?: string;
  proposta_token?: string;
  payment_method: 'pix' | 'card' | 'boleto';
  payer: {
    nome: string;
    sobrenome: string;
    email: string;
    telefone: string;
    cpf_cnpj: string;
  };
  endereco: {
    cep: string;
    rua: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
  frete: {
    metodo: 'pac' | 'sedex' | 'manual';
    valor: number;
    prazo_dias: number;
  };
  card?: {
    card_number: string;
    cardholder_name: string;
    expiration_month: string;
    expiration_year: string;
    security_code: string;
  };
  installments?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] mp-create-order-and-pay iniciado`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    
    if (!accessToken) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: PaymentRequest = await req.json();

    console.log(`[${requestId}] Request:`, {
      proposta_id: body.proposta_id,
      proposta_token: body.proposta_token,
      payment_method: body.payment_method,
      payer_email: body.payer.email,
      frete_metodo: body.frete.metodo,
    });

    // 1. Buscar proposta
    if (!body.proposta_id && !body.proposta_token) {
      throw new Error('proposta_id ou proposta_token é obrigatório');
    }

    let query = supabase
      .from('vendedor_propostas')
      .select('id, cliente_id, cliente_nome, valor_produtos, valor_frete, metodo_frete, itens, desconto_percentual, vendedor_id, vendedor_email, vendedor_nome, token');

    if (body.proposta_id) {
      query = query.eq('id', body.proposta_id);
    } else {
      query = query.eq('token', body.proposta_token);
    }

    const { data: proposta, error: propostaError } = await query.single();

    if (propostaError || !proposta) {
      console.error(`[${requestId}] Proposta não encontrada:`, propostaError);
      throw new Error('Proposta não encontrada');
    }

    console.log(`[${requestId}] Proposta encontrada:`, proposta.id);

    // 2. Recalcular valores (segurança)
    const itens = typeof proposta.itens === 'string' ? JSON.parse(proposta.itens) : proposta.itens || [];
    
    // Calcular subtotal com desconto
    let subtotalCalculado = 0;
    const itensParaSalvar = itens.map((item: any) => {
      const precoUnitario = parseFloat(item.price);
      const quantidade = item.quantity;
      const descontoItem = item.descontoItem ?? proposta.desconto_percentual ?? 0;
      const precoComDesconto = precoUnitario * (1 - descontoItem / 100);
      subtotalCalculado += precoComDesconto * quantidade;
      
      return {
        variantId: item.variantId,
        productId: item.variantId?.split('/').pop() || '',
        title: item.title,
        variantTitle: item.title,
        quantity: quantidade,
        price: precoUnitario.toString(),
        image: item.imageUrl || null,
        sku: item.sku || null,
        descontoItem,
      };
    });

    const valorFrete = body.frete.valor || proposta.valor_frete || 0;
    const valorTotal = Math.round((subtotalCalculado + valorFrete) * 100) / 100;

    console.log(`[${requestId}] Valores calculados:`, { subtotal: subtotalCalculado, frete: valorFrete, total: valorTotal });

    // 3. Criar pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('ebd_shopify_pedidos_mercadopago')
      .insert({
        vendedor_id: proposta.vendedor_id,
        vendedor_email: proposta.vendedor_email || '',
        vendedor_nome: proposta.vendedor_nome || '',
        cliente_id: proposta.cliente_id || null,
        proposta_id: proposta.id,
        proposta_token: proposta.token,
        cliente_nome: `${body.payer.nome} ${body.payer.sobrenome}`.trim(),
        cliente_cpf_cnpj: body.payer.cpf_cnpj.replace(/\D/g, ''),
        cliente_email: body.payer.email,
        cliente_telefone: body.payer.telefone,
        valor_produtos: subtotalCalculado,
        valor_frete: valorFrete,
        valor_total: valorTotal,
        metodo_frete: body.frete.metodo,
        prazo_entrega_dias: body.frete.prazo_dias || 10,
        endereco_cep: body.endereco.cep.replace(/\D/g, ''),
        endereco_rua: body.endereco.rua,
        endereco_numero: body.endereco.numero,
        endereco_complemento: body.endereco.complemento || null,
        endereco_bairro: body.endereco.bairro,
        endereco_cidade: body.endereco.cidade,
        endereco_estado: body.endereco.estado,
        items: itensParaSalvar,
        payment_method: body.payment_method,
        status: 'AGUARDANDO_PAGAMENTO',
      })
      .select()
      .single();

    if (pedidoError) {
      console.error(`[${requestId}] Erro ao criar pedido:`, pedidoError);
      throw new Error(`Erro ao criar pedido: ${pedidoError.message}`);
    }

    console.log(`[${requestId}] Pedido criado:`, pedido.id);

    // 4. Processar pagamento com Mercado Pago
    const cpfCnpjLimpo = body.payer.cpf_cnpj.replace(/\D/g, '');
    const tipoDocumento = cpfCnpjLimpo.length > 11 ? 'CNPJ' : 'CPF';

    const paymentData: any = {
      transaction_amount: valorTotal,
      description: `Pedido #${pedido.id.slice(0, 8).toUpperCase()}`,
      payer: {
        email: body.payer.email,
        first_name: body.payer.nome,
        last_name: body.payer.sobrenome,
        identification: {
          type: tipoDocumento,
          number: cpfCnpjLimpo,
        },
      },
      external_reference: pedido.id,
    };

    let paymentResult: any = {};

    if (body.payment_method === 'pix') {
      paymentData.payment_method_id = 'pix';

      console.log(`[${requestId}] Criando pagamento PIX...`);
      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${requestId}] Erro Mercado Pago PIX:`, errorText);
        throw new Error(`Erro ao criar pagamento PIX: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[${requestId}] Pagamento PIX criado:`, data.id, 'status:', data.status);

      paymentResult = {
        payment_id: data.id,
        status: data.status,
        qr_code: data.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
        ticket_url: data.point_of_interaction?.transaction_data?.ticket_url,
      };
    } else if (body.payment_method === 'boleto') {
      paymentData.payment_method_id = 'bolbradesco';
      paymentData.payer.address = {
        street_name: body.endereco.rua,
        street_number: body.endereco.numero,
        zip_code: body.endereco.cep.replace(/\D/g, ''),
      };

      console.log(`[${requestId}] Criando boleto...`);
      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${requestId}] Erro Mercado Pago Boleto:`, errorText);
        throw new Error(`Erro ao criar boleto: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[${requestId}] Boleto criado:`, data.id);

      paymentResult = {
        payment_id: data.id,
        status: data.status,
        external_resource_url: data.transaction_details?.external_resource_url,
        barcode: data.barcode?.content,
      };
    } else if (body.payment_method === 'card') {
      if (!body.card) {
        throw new Error('Dados do cartao nao fornecidos');
      }

      // 1. Detectar ambiente (producao vs sandbox)
      const ambiente = accessToken.startsWith('TEST-') ? 'sandbox' : 'production';
      
      // 2. Sanitizar numero do cartao (remover espacos e caracteres nao numericos)
      const cleanCardNumber = body.card.card_number.replace(/\D/g, '');
      const bin = cleanCardNumber.substring(0, 6);
      
      // Log detalhado do cartao (sem dados sensiveis)
      console.log(`[${requestId}] Cartao info:`, { 
        ambiente, 
        bin,
        card_length: cleanCardNumber.length,
        expiration_month: body.card.expiration_month,
        expiration_year: body.card.expiration_year,
      });

      // 3. Criar token do cartao PRIMEIRO (para obter payment_method_id correto)
      console.log(`[${requestId}] Criando token do cartao...`);
      const cardTokenResponse = await fetch('https://api.mercadopago.com/v1/card_tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          card_number: cleanCardNumber,
          cardholder: {
            name: body.card.cardholder_name,
            identification: paymentData.payer.identification,
          },
          security_code: body.card.security_code,
          expiration_month: parseInt(body.card.expiration_month),
          expiration_year: parseInt(body.card.expiration_year),
        }),
      });

      if (!cardTokenResponse.ok) {
        const errorData = await cardTokenResponse.json().catch(() => ({}));
        console.error(`[${requestId}] Erro token cartao:`, JSON.stringify(errorData));
        
        // Mapear erros especificos
        const cause = errorData.cause || [];
        const errorCodes = cause.map((c: any) => c.code?.toString());
        
        if (errorCodes.includes('10103') || errorCodes.includes('E301')) {
          throw new Error('Cartao invalido ou incompativel. Verifique os dados.');
        }
        if (errorCodes.includes('E302') || errorData.message === 'invalid_security_code') {
          throw new Error('Codigo de seguranca (CVV) invalido.');
        }
        if (errorCodes.includes('E205') || errorData.message === 'invalid_card_number') {
          throw new Error('Numero do cartao invalido.');
        }
        if (errorCodes.includes('E206') || errorData.message === 'invalid_expiration_date') {
          throw new Error('Data de validade do cartao invalida.');
        }
        if (errorCodes.includes('325')) {
          throw new Error('Mes de validade invalido.');
        }
        if (errorCodes.includes('326')) {
          throw new Error('Ano de validade invalido.');
        }
        
        throw new Error('Erro ao processar dados do cartao. Verifique as informacoes.');
      }

      const cardTokenData = await cardTokenResponse.json();
      
      console.log(`[${requestId}] Token criado:`, {
        token_id: cardTokenData.id,
        last_four_digits: cardTokenData.last_four_digits,
        first_six_digits: cardTokenData.first_six_digits,
        payment_method_from_token: cardTokenData.payment_method_id,
      });
      
      // 4. Obter payment_method_id do token ou buscar pelo BIN do token
      let paymentMethodId = cardTokenData.payment_method_id;
      
      if (!paymentMethodId) {
        const tokenBin = cardTokenData.first_six_digits || bin;
        console.log(`[${requestId}] Buscando payment_method pelo BIN: ${tokenBin}`);
        
        const binResponse = await fetch(
          `https://api.mercadopago.com/v1/payment_methods/search?bin=${tokenBin}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const binData = await binResponse.json();
        paymentMethodId = binData.results?.[0]?.id || 'visa';
      }
      
      console.log(`[${requestId}] Payment method: ${paymentMethodId}`);
      
      paymentData.token = cardTokenData.id;
      paymentData.payment_method_id = paymentMethodId;
      paymentData.installments = body.installments || 1;

      // 5. Processar pagamento com idempotency key estavel
      const idempotencyKey = `${pedido.id}-card-${Date.now()}`;
      console.log(`[${requestId}] Processando pagamento cartao...`);
      
      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(paymentData),
      });

      const responseData = await response.json().catch(() => ({}));
      
      console.log(`[${requestId}] Resposta MP:`, {
        status: response.status,
        payment_status: responseData.status,
        status_detail: responseData.status_detail,
        payment_id: responseData.id,
      });

      // Tratar erros de resposta
      if (!response.ok || responseData.status === 'rejected') {
        console.error(`[${requestId}] Erro/Rejeicao pagamento:`, JSON.stringify(responseData));
        
        const cause = responseData.cause || [];
        const statusDetail = responseData.status_detail || '';
        
        // Mapear status_detail para mensagens amigaveis
        const errorMessages: Record<string, string> = {
          'cc_rejected_bad_filled_card_number': 'Numero do cartao incorreto.',
          'cc_rejected_bad_filled_date': 'Data de validade incorreta.',
          'cc_rejected_bad_filled_other': 'Dados do cartao incorretos.',
          'cc_rejected_bad_filled_security_code': 'Codigo de seguranca incorreto.',
          'cc_rejected_blacklist': 'Cartao nao permitido.',
          'cc_rejected_call_for_authorize': 'Ligue para a operadora para autorizar.',
          'cc_rejected_card_disabled': 'Cartao desabilitado. Contate seu banco.',
          'cc_rejected_card_error': 'Erro no cartao. Tente outro.',
          'cc_rejected_duplicated_payment': 'Pagamento duplicado.',
          'cc_rejected_high_risk': 'Pagamento recusado por seguranca.',
          'cc_rejected_insufficient_amount': 'Saldo insuficiente.',
          'cc_rejected_invalid_installments': 'Parcelamento invalido.',
          'cc_rejected_max_attempts': 'Limite de tentativas excedido.',
          'cc_rejected_other_reason': 'Pagamento recusado. Tente outro cartao.',
          'pending_contingency': 'Pagamento pendente de processamento.',
          'pending_review_manual': 'Pagamento em analise.',
        };
        
        // Verificar erro 10103 (BIN incompativel)
        if (cause.some((c: any) => c.code?.toString() === '10103')) {
          throw new Error('Cartao incompativel com o ambiente. Verifique se esta usando cartao correto.');
        }
        
        // Usar mensagem mapeada ou generica
        const friendlyMessage = errorMessages[statusDetail] || 
          (statusDetail.startsWith('cc_rejected') ? 'Pagamento recusado pela operadora.' : 
          responseData.message || 'Erro ao processar pagamento.');
        
        throw new Error(friendlyMessage);
      }

      paymentResult = {
        payment_id: responseData.id,
        status: responseData.status,
        status_detail: responseData.status_detail,
      };
    } else {
      throw new Error('Método de pagamento não suportado');
    }

    // 5. Atualizar pedido com payment_id
    await supabase
      .from('ebd_shopify_pedidos_mercadopago')
      .update({
        mercadopago_payment_id: paymentResult.payment_id?.toString(),
        mercadopago_preference_id: paymentResult.payment_id?.toString(),
      })
      .eq('id', pedido.id);

    console.log(`[${requestId}] Pedido atualizado com payment_id`);

    // 6. Retornar resultado
    return new Response(
      JSON.stringify({
        success: true,
        pedido_id: pedido.id,
        ...paymentResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    console.error(`[${requestId}] Erro:`, errorMessage);
    
    // Retornar HTTP 200 com success:false para erros esperados
    // Isso permite que o frontend exiba a mensagem de erro corretamente
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        request_id: requestId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
