import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * EDGE FUNCTION: sync-comissoes-faturado
 * 
 * Função de BACKUP para corrigir propostas FATURADAS sem parcelas de comissão.
 * 
 * Identifica propostas com:
 * - status = 'FATURADO'
 * - bling_order_id IS NOT NULL
 * - Sem registros correspondentes em vendedor_propostas_parcelas
 * 
 * Para cada proposta órfã, gera as parcelas baseado no prazo_faturamento_selecionado.
 * 
 * Pode ser executada:
 * - Manualmente pelo admin quando detectar problemas
 * - Via cron job diário para garantir consistência
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[SYNC-COMISSOES-FAT] ========== INICIANDO VARREDURA ==========`);
    console.log(`[SYNC-COMISSOES-FAT] Buscando propostas FATURADAS sem parcelas...`);

    // Buscar propostas FATURADAS com bling_order_id mas sem parcelas
    const { data: propostas, error: propostasError } = await supabase
      .from('vendedor_propostas')
      .select(`
        id, vendedor_id, cliente_id, cliente_nome, valor_total, valor_frete,
        prazo_faturamento_selecionado, bling_order_id, bling_order_number,
        vendedor_nome, created_at
      `)
      .eq('status', 'FATURADO')
      .not('bling_order_id', 'is', null);

    if (propostasError) {
      console.error(`[SYNC-COMISSOES-FAT] ❌ Erro ao buscar propostas:`, propostasError);
      throw propostasError;
    }

    console.log(`[SYNC-COMISSOES-FAT] Propostas FATURADAS com bling_order_id: ${propostas?.length || 0}`);

    // Filtrar propostas que não têm parcelas
    const propostasOrfas: typeof propostas = [];

    for (const proposta of propostas || []) {
      const { data: parcelas, error: parcelasError } = await supabase
        .from('vendedor_propostas_parcelas')
        .select('id')
        .eq('proposta_id', proposta.id)
        .limit(1);

      if (parcelasError) {
        console.warn(`[SYNC-COMISSOES-FAT] ⚠️ Erro ao verificar parcelas da proposta ${proposta.id}:`, parcelasError);
        continue;
      }

      if (!parcelas || parcelas.length === 0) {
        propostasOrfas.push(proposta);
      }
    }

    console.log(`[SYNC-COMISSOES-FAT] Propostas ÓRFÃS (sem parcelas): ${propostasOrfas.length}`);

    if (propostasOrfas.length === 0) {
      console.log(`[SYNC-COMISSOES-FAT] ✅ Nenhuma proposta órfã encontrada. Sistema consistente.`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhuma proposta órfã encontrada',
        propostas_verificadas: propostas?.length || 0,
        propostas_corrigidas: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Processar cada proposta órfã
    let corrigidas = 0;
    let erros = 0;
    const detalhes: any[] = [];

    for (const proposta of propostasOrfas) {
      try {
        console.log(`[SYNC-COMISSOES-FAT] Processando proposta ${proposta.id}...`);

        // Buscar email do vendedor
        let vendedorEmail: string | null = null;
        let comissaoPercentual = 1.5;

        if (proposta.vendedor_id) {
          const { data: vendedor } = await supabase
            .from('vendedores')
            .select('email, comissao_percentual')
            .eq('id', proposta.vendedor_id)
            .single();

          if (vendedor) {
            vendedorEmail = vendedor.email;
            comissaoPercentual = vendedor.comissao_percentual || 1.5;
          }
        }

        // Configuração de parcelas
        const prazo = proposta.prazo_faturamento_selecionado || '30';
        const parcelasConfig: { [key: string]: { dias: number[]; metodos: string[] } } = {
          '30': { dias: [30], metodos: ['boleto_30'] },
          '60_direto': { dias: [60], metodos: ['boleto_60'] },
          '60': { dias: [30, 60], metodos: ['boleto_30', 'boleto_60'] },
          '60_90': { dias: [60, 90], metodos: ['boleto_60', 'boleto_90'] },
          '90': { dias: [30, 60, 90], metodos: ['boleto_30', 'boleto_60', 'boleto_90'] },
          '60_75_90': { dias: [60, 75, 90], metodos: ['boleto_60', 'boleto_75', 'boleto_90'] },
          '60_90_120': { dias: [60, 90, 120], metodos: ['boleto_60', 'boleto_90', 'boleto_120'] },
        };

        const config = parcelasConfig[prazo] || { dias: [30], metodos: ['boleto_30'] };
        const diasParcelas = config.dias;
        const metodosParcelas = config.metodos;

        // Calcular valores
        const valorTotal = proposta.valor_total || 0;
        const totalCentavos = Math.round(valorTotal * 100);
        const parcelaCentavos = Math.floor(totalCentavos / diasParcelas.length);
        const restoCentavos = totalCentavos - (parcelaCentavos * diasParcelas.length);

        // Usar data de criação da proposta como base para vencimentos
        const dataBase = new Date(proposta.created_at);

        const parcelasToInsert = diasParcelas.map((dias, index) => {
          const valorParcela = index === diasParcelas.length - 1
            ? (parcelaCentavos + restoCentavos) / 100
            : parcelaCentavos / 100;

          const valorComissao = Math.round(valorParcela * (comissaoPercentual / 100) * 100) / 100;

          const dataVencimento = new Date(dataBase);
          dataVencimento.setDate(dataVencimento.getDate() + dias);

          return {
            proposta_id: proposta.id,
            vendedor_id: proposta.vendedor_id,
            cliente_id: proposta.cliente_id,
            numero_parcela: index + 1,
            total_parcelas: diasParcelas.length,
            valor: valorParcela,
            valor_comissao: valorComissao,
            data_vencimento: dataVencimento.toISOString().split('T')[0],
            status: 'aguardando',
            origem: 'faturado',
            metodo_pagamento: metodosParcelas[index],
            bling_order_id: proposta.bling_order_id,
            bling_order_number: proposta.bling_order_number,
            vendedor_email: vendedorEmail,
          };
        });

        const { error: insertError } = await supabase
          .from('vendedor_propostas_parcelas')
          .insert(parcelasToInsert);

        if (insertError) {
          console.error(`[SYNC-COMISSOES-FAT] ❌ Erro ao inserir parcelas da proposta ${proposta.id}:`, insertError);
          erros++;
          detalhes.push({
            proposta_id: proposta.id,
            cliente: proposta.cliente_nome,
            status: 'erro',
            erro: insertError.message,
          });
        } else {
          console.log(`[SYNC-COMISSOES-FAT] ✅ Proposta ${proposta.id} corrigida: ${parcelasToInsert.length} parcela(s)`);
          corrigidas++;
          detalhes.push({
            proposta_id: proposta.id,
            cliente: proposta.cliente_nome,
            status: 'corrigida',
            parcelas: parcelasToInsert.length,
            vendedor_email: vendedorEmail,
          });
        }

        // Verificar também se existe registro em ebd_shopify_pedidos
        const { data: metaExiste } = await supabase
          .from('ebd_shopify_pedidos')
          .select('id')
          .eq('bling_order_id', proposta.bling_order_id)
          .limit(1);

        if (!metaExiste || metaExiste.length === 0) {
          console.log(`[SYNC-COMISSOES-FAT] Criando registro de meta para proposta ${proposta.id}...`);
          
          const valorProdutos = valorTotal - (proposta.valor_frete || 0);
          
          await supabase.from('ebd_shopify_pedidos').insert({
            shopify_order_id: proposta.bling_order_id,
            order_number: `BLING-${proposta.bling_order_number || proposta.bling_order_id}`,
            vendedor_id: proposta.vendedor_id,
            cliente_id: proposta.cliente_id,
            valor_total: valorTotal,
            valor_frete: proposta.valor_frete || 0,
            valor_para_meta: valorProdutos,
            status_pagamento: 'Faturado',
            customer_name: proposta.cliente_nome,
            order_date: proposta.created_at,
            bling_order_id: proposta.bling_order_id,
          });
        }

      } catch (err) {
        console.error(`[SYNC-COMISSOES-FAT] ❌ Erro ao processar proposta ${proposta.id}:`, err);
        erros++;
        detalhes.push({
          proposta_id: proposta.id,
          cliente: proposta.cliente_nome,
          status: 'erro',
          erro: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    console.log(`[SYNC-COMISSOES-FAT] ========== VARREDURA CONCLUÍDA ==========`);
    console.log(`[SYNC-COMISSOES-FAT] Propostas verificadas: ${propostas?.length || 0}`);
    console.log(`[SYNC-COMISSOES-FAT] Propostas órfãs: ${propostasOrfas.length}`);
    console.log(`[SYNC-COMISSOES-FAT] Corrigidas: ${corrigidas}`);
    console.log(`[SYNC-COMISSOES-FAT] Erros: ${erros}`);

    return new Response(JSON.stringify({
      success: true,
      propostas_verificadas: propostas?.length || 0,
      propostas_orfas: propostasOrfas.length,
      propostas_corrigidas: corrigidas,
      erros: erros,
      detalhes: detalhes,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[SYNC-COMISSOES-FAT] ❌ ERRO GERAL:`, error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
