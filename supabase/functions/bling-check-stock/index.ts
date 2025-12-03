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
    const { produto_id } = await req.json();

    if (!produto_id) {
      throw new Error('produto_id é obrigatório');
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

    // Buscar estoque do produto
    const stockResponse = await fetch(
      `https://www.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${produto_id}`,
      {
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!stockResponse.ok) {
      const errorText = await stockResponse.text();
      console.error('Erro na API Bling:', stockResponse.status, errorText);
      throw new Error(`Erro ao verificar estoque: ${stockResponse.status}`);
    }

    const data = await stockResponse.json();
    const stockData = data.data?.[0] || null;

    // Calcular estoque geral (soma de todos os depósitos)
    let estoqueGeral = 0;
    if (stockData?.saldos) {
      estoqueGeral = stockData.saldos.reduce((acc: number, saldo: any) => {
        return acc + (saldo.saldoFisicoTotal || 0);
      }, 0);
    }

    console.log(`Estoque do produto ${produto_id}: ${estoqueGeral}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        produto_id,
        estoque: estoqueGeral,
        detalhes: stockData 
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
