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
    console.log('🕐 Iniciando verificação de parcelas atrasadas...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const hoje = new Date().toISOString().split('T')[0];
    console.log(`📅 Data de referência: ${hoje}`);

    // Buscar parcelas que devem ser marcadas como atrasadas
    const { data: parcelasParaAtualizar, error: fetchError } = await supabase
      .from('vendedor_propostas_parcelas')
      .select('id, cliente_id, proposta_id, data_vencimento, valor, numero_parcela')
      .eq('status', 'aguardando')
      .lt('data_vencimento', hoje);

    if (fetchError) {
      console.error('❌ Erro ao buscar parcelas:', fetchError);
      throw fetchError;
    }

    const totalParaAtualizar = parcelasParaAtualizar?.length || 0;
    console.log(`📊 Encontradas ${totalParaAtualizar} parcelas para marcar como atrasadas`);

    if (totalParaAtualizar === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma parcela atrasada encontrada',
          parcelas_atualizadas: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log detalhado das parcelas
    parcelasParaAtualizar?.forEach((p) => {
      console.log(`  → Parcela ${p.numero_parcela} | Vencimento: ${p.data_vencimento} | Valor: R$ ${p.valor}`);
    });

    // Atualizar status para atrasada
    const ids = parcelasParaAtualizar?.map(p => p.id) || [];
    
    const { error: updateError } = await supabase
      .from('vendedor_propostas_parcelas')
      .update({ status: 'atrasada' })
      .in('id', ids);

    if (updateError) {
      console.error('❌ Erro ao atualizar parcelas:', updateError);
      throw updateError;
    }

    console.log(`✅ ${totalParaAtualizar} parcelas marcadas como atrasadas com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${totalParaAtualizar} parcelas marcadas como atrasadas`,
        parcelas_atualizadas: totalParaAtualizar,
        data_referencia: hoje
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro na execução:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
