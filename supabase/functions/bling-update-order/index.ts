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
    const { bling_order_id, status } = await req.json();

    if (!bling_order_id) {
      throw new Error('ID do pedido no Bling é obrigatório');
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
      throw new Error('Configuração do Bling não encontrada');
    }

    if (!config.access_token) {
      throw new Error('Token de acesso do Bling não configurado');
    }

    // Mapeamento de status
    // Status Bling comuns: 15=Em Aberto, 9=Atendido, 12=Cancelado
    let situacaoId: number;
    switch (status) {
      case 'cancelled':
        situacaoId = 12; // Cancelado
        break;
      case 'approved':
      case 'paid':
        situacaoId = 9; // Atendido
        break;
      case 'pending':
      default:
        situacaoId = 15; // Em Aberto
        break;
    }

    console.log(`Atualizando pedido ${bling_order_id} para situação ${situacaoId}`);

    // Atualizar status do pedido no Bling
    const updateResponse = await fetch(`https://www.bling.com.br/Api/v3/pedidos/vendas/${bling_order_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        situacao: {
          id: situacaoId,
        },
      }),
    });

    const responseData = await updateResponse.json();

    if (!updateResponse.ok) {
      console.error('Erro ao atualizar pedido no Bling:', responseData);
      throw new Error(responseData.error?.message || 'Erro ao atualizar pedido no Bling');
    }

    console.log('Pedido atualizado com sucesso:', responseData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Status do pedido atualizado no Bling',
        bling_order_id,
        new_status: status,
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
