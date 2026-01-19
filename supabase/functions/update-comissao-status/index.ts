import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const hoje = new Date();
    const diaDoMes = hoje.getDate();
    
    let atualizadas = 0;
    let erros = 0;

    // 1. Vendas online (mercadopago e online/shopify): agendada → liberada após dia 05
    if (diaDoMes >= 5) {
      // Mercado Pago
      const { data: agendadasMP, error: errAgendadasMP } = await supabase
        .from('vendedor_propostas_parcelas')
        .update({ 
          comissao_status: 'liberada',
          data_liberacao: hoje.toISOString().split('T')[0]
        })
        .eq('comissao_status', 'agendada')
        .eq('origem', 'mercadopago')
        .select('id');

      if (errAgendadasMP) {
        console.error('Erro ao liberar agendadas MP:', errAgendadasMP);
        erros++;
      } else {
        atualizadas += agendadasMP?.length || 0;
        console.log(`Liberadas ${agendadasMP?.length || 0} comissões agendadas Mercado Pago (dia 05)`);
      }

      // Shopify Online
      const { data: agendadasOnline, error: errAgendadasOnline } = await supabase
        .from('vendedor_propostas_parcelas')
        .update({ 
          comissao_status: 'liberada',
          data_liberacao: hoje.toISOString().split('T')[0]
        })
        .eq('comissao_status', 'agendada')
        .eq('origem', 'online')
        .select('id');

      if (errAgendadasOnline) {
        console.error('Erro ao liberar agendadas Online:', errAgendadasOnline);
        erros++;
      } else {
        atualizadas += agendadasOnline?.length || 0;
        console.log(`Liberadas ${agendadasOnline?.length || 0} comissões agendadas Shopify Online (dia 05)`);
      }
    }

    // 2. Faturado: parcela paga → comissão liberada
    // Primeiro, buscar parcelas faturadas pendentes com status paga
    const { data: parcelasFaturadoPendentes, error: errBuscaFaturado } = await supabase
      .from('vendedor_propostas_parcelas')
      .select('id, proposta_id, vendedor_id, cliente_id, numero_parcela, valor_comissao, data_vencimento')
      .eq('comissao_status', 'pendente')
      .eq('origem', 'faturado')
      .eq('status', 'paga');

    if (errBuscaFaturado) {
      console.error('Erro ao buscar parcelas faturadas:', errBuscaFaturado);
      erros++;
    } else if (parcelasFaturadoPendentes && parcelasFaturadoPendentes.length > 0) {
      // Para cada parcela faturada, verificar se já existe uma parcela online com mesmos valores
      const idsParaLiberar: string[] = [];
      
      for (const parcela of parcelasFaturadoPendentes) {
        // Verificar se existe parcela online duplicada por cliente_id + vendedor_id + numero_parcela
        const { data: parcelaOnlineExistente } = await supabase
          .from('vendedor_propostas_parcelas')
          .select('id')
          .eq('vendedor_id', parcela.vendedor_id)
          .eq('cliente_id', parcela.cliente_id)
          .eq('numero_parcela', parcela.numero_parcela)
          .eq('origem', 'online')
          .limit(1);
        
        if (parcelaOnlineExistente && parcelaOnlineExistente.length > 0) {
          // Existe parcela online duplicada - excluir esta faturada em vez de liberar
          console.log(`Parcela faturada ${parcela.id} é duplicada de online - será excluída`);
          const { error: errDelete } = await supabase
            .from('vendedor_propostas_parcelas')
            .delete()
            .eq('id', parcela.id);
          
          if (errDelete) {
            console.error(`Erro ao excluir parcela duplicada ${parcela.id}:`, errDelete);
            erros++;
          } else {
            console.log(`Parcela duplicada ${parcela.id} excluída com sucesso`);
          }
        } else {
          // Não é duplicada - adicionar para liberação
          idsParaLiberar.push(parcela.id);
        }
      }
      
      // Liberar as parcelas que não são duplicadas
      if (idsParaLiberar.length > 0) {
        const { data: parcelasPagas, error: errPagas } = await supabase
          .from('vendedor_propostas_parcelas')
          .update({ 
            comissao_status: 'liberada',
            data_liberacao: hoje.toISOString().split('T')[0]
          })
          .in('id', idsParaLiberar)
          .select('id');

        if (errPagas) {
          console.error('Erro ao liberar pagas:', errPagas);
          erros++;
        } else {
          atualizadas += parcelasPagas?.length || 0;
          console.log(`Liberadas ${parcelasPagas?.length || 0} comissões de parcelas pagas`);
        }
      }
    }

    // 3. Faturado: parcela vencida → comissão atrasada
    const { data: atrasadas, error: errAtrasadas } = await supabase
      .from('vendedor_propostas_parcelas')
      .update({ comissao_status: 'atrasada' })
      .eq('comissao_status', 'pendente')
      .eq('origem', 'faturado')
      .lt('data_vencimento', hoje.toISOString().split('T')[0])
      .neq('status', 'paga')
      .select('id');

    if (errAtrasadas) {
      console.error('Erro ao marcar atrasadas:', errAtrasadas);
      erros++;
    } else {
      atualizadas += atrasadas?.length || 0;
      console.log(`Marcadas ${atrasadas?.length || 0} comissões como atrasadas`);
    }

    return new Response(JSON.stringify({
      success: true,
      atualizadas,
      erros,
      message: `Processamento concluído: ${atualizadas} comissões atualizadas`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
