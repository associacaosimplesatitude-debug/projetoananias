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

    // 1. Vendas online (mercadopago): agendada → liberada após dia 05
    if (diaDoMes >= 5) {
      const { data: agendadas, error: errAgendadas } = await supabase
        .from('vendedor_propostas_parcelas')
        .update({ 
          comissao_status: 'liberada',
          data_liberacao: hoje.toISOString().split('T')[0]
        })
        .eq('comissao_status', 'agendada')
        .eq('origem', 'mercadopago')
        .select('id');

      if (errAgendadas) {
        console.error('Erro ao liberar agendadas:', errAgendadas);
        erros++;
      } else {
        atualizadas += agendadas?.length || 0;
        console.log(`Liberadas ${agendadas?.length || 0} comissões agendadas (dia 05)`);
      }
    }

    // 2. Faturado: parcela paga → comissão liberada
    const { data: parcelasPagas, error: errPagas } = await supabase
      .from('vendedor_propostas_parcelas')
      .update({ 
        comissao_status: 'liberada',
        data_liberacao: hoje.toISOString().split('T')[0]
      })
      .eq('comissao_status', 'pendente')
      .eq('origem', 'faturado')
      .eq('status', 'paga')
      .select('id');

    if (errPagas) {
      console.error('Erro ao liberar pagas:', errPagas);
      erros++;
    } else {
      atualizadas += parcelasPagas?.length || 0;
      console.log(`Liberadas ${parcelasPagas?.length || 0} comissões de parcelas pagas`);
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
