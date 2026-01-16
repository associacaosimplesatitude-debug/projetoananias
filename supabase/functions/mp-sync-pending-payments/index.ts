import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Delay helper para rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] ========================================`);
  console.log(`[${requestId}] mp-sync-pending-payments INICIADO`);
  console.log(`[${requestId}] ========================================`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    
    if (!accessToken) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calcular data limite (7 dias atrás)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dataLimite = sevenDaysAgo.toISOString();

    console.log(`[${requestId}] Buscando pedidos pendentes desde: ${dataLimite}`);

    // 1. Buscar pedidos pendentes
    const { data: pedidosPendentes, error: queryError } = await supabase
      .from('ebd_shopify_pedidos_mercadopago')
      .select('id, mercadopago_payment_id, cliente_nome, valor_total, created_at')
      .eq('status', 'AGUARDANDO_PAGAMENTO')
      .is('bling_order_id', null)
      .not('mercadopago_payment_id', 'is', null)
      .gte('created_at', dataLimite)
      .order('created_at', { ascending: true })
      .limit(50); // Processar até 50 por execução

    if (queryError) {
      console.error(`[${requestId}] Erro ao buscar pedidos:`, queryError);
      throw new Error('Erro ao buscar pedidos pendentes');
    }

    const totalPendentes = pedidosPendentes?.length || 0;
    console.log(`[${requestId}] Total de pedidos pendentes encontrados: ${totalPendentes}`);

    if (totalPendentes === 0) {
      console.log(`[${requestId}] Nenhum pedido pendente para processar`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum pedido pendente',
          processed: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          duration_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Estatísticas
    let processados = 0;
    let aprovados = 0;
    let rejeitados = 0;
    let pendentes = 0;
    let erros = 0;

    // 2. Processar cada pedido
    for (const pedido of pedidosPendentes) {
      processados++;
      const paymentId = pedido.mercadopago_payment_id;
      
      console.log(`[${requestId}] [${processados}/${totalPendentes}] Processando pedido ${pedido.id.slice(0, 8)} - Payment: ${paymentId}`);

      try {
        // 2a. Consultar status no Mercado Pago
        const mpResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!mpResponse.ok) {
          const errorText = await mpResponse.text();
          console.error(`[${requestId}] Erro ao consultar MP payment ${paymentId}:`, errorText);
          erros++;
          await sleep(500);
          continue;
        }

        const payment = await mpResponse.json();
        const status = payment.status;
        
        console.log(`[${requestId}] Payment ${paymentId}: status=${status}`);

        // 2b. Processar baseado no status
        if (status === 'approved') {
          // Pagamento aprovado - chamar mp-sync-payment-status para criar no Bling
          console.log(`[${requestId}] ✅ APROVADO! Chamando mp-sync-payment-status...`);
          
          const syncResponse = await fetch(`${supabaseUrl}/functions/v1/mp-sync-payment-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              pedido_id: pedido.id,
            }),
          });

          if (syncResponse.ok) {
            const syncData = await syncResponse.json();
            console.log(`[${requestId}] ✅ Sincronizado! Bling ID: ${syncData.bling_order_id || 'N/A'}`);
            aprovados++;
          } else {
            const errorText = await syncResponse.text();
            console.error(`[${requestId}] Erro ao sincronizar:`, errorText);
            erros++;
          }
        } else if (status === 'rejected' || status === 'cancelled' || status === 'refunded') {
          // Pagamento rejeitado/cancelado - atualizar status no banco
          console.log(`[${requestId}] ❌ ${status.toUpperCase()} - Atualizando status...`);
          
          const novoStatus = status === 'refunded' ? 'REEMBOLSADO' : 'REJEITADO';
          
          await supabase
            .from('ebd_shopify_pedidos_mercadopago')
            .update({
              status: novoStatus,
              payment_status: status,
              updated_at: new Date().toISOString(),
            })
            .eq('id', pedido.id);
          
          rejeitados++;
        } else {
          // Ainda pendente
          console.log(`[${requestId}] ⏳ Ainda pendente (${status})`);
          pendentes++;
        }

      } catch (error) {
        console.error(`[${requestId}] Erro ao processar pedido ${pedido.id}:`, error);
        erros++;
      }

      // Rate limiting - esperar entre cada chamada
      await sleep(500);
    }

    const duration = Date.now() - startTime;
    
    console.log(`[${requestId}] ========================================`);
    console.log(`[${requestId}] RESUMO DA EXECUÇÃO`);
    console.log(`[${requestId}] ========================================`);
    console.log(`[${requestId}] Total processados: ${processados}`);
    console.log(`[${requestId}] Aprovados (sincronizados): ${aprovados}`);
    console.log(`[${requestId}] Rejeitados/Cancelados: ${rejeitados}`);
    console.log(`[${requestId}] Ainda pendentes: ${pendentes}`);
    console.log(`[${requestId}] Erros: ${erros}`);
    console.log(`[${requestId}] Duração: ${duration}ms`);
    console.log(`[${requestId}] ========================================`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processados ${processados} pedidos`,
        processed: processados,
        approved: aprovados,
        rejected: rejeitados,
        pending: pendentes,
        errors: erros,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error(`[${requestId}] ERRO FATAL:`, error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno',
        request_id: requestId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
