import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FixRequest {
  bling_order_ids: number[];
}

interface FixResult {
  bling_order_id: number;
  success: boolean;
  message: string;
  shopify_order_id?: string;
  customer_name?: string;
  nota_fiscal_url?: string;
  parcela_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { bling_order_ids }: FixRequest = await req.json();

    if (!bling_order_ids || !Array.isArray(bling_order_ids) || bling_order_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "bling_order_ids é obrigatório e deve ser um array não vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fix-comissoes] Processando ${bling_order_ids.length} Bling Order IDs`);

    const results: FixResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const blingOrderId of bling_order_ids) {
      try {
        console.log(`[fix-comissoes] Processando Bling Order ID: ${blingOrderId}`);

        // 1. Buscar o pedido Shopify REAL com esse bling_order_id
        const { data: shopifyOrders, error: shopifyError } = await supabase
          .from("ebd_shopify_pedidos")
          .select("id, order_number, cliente_id, customer_name, valor_total, nota_fiscal_url, nota_fiscal_numero, bling_order_id")
          .eq("bling_order_id", blingOrderId);

        if (shopifyError) {
          console.error(`[fix-comissoes] Erro ao buscar pedido Shopify: ${shopifyError.message}`);
          results.push({
            bling_order_id: blingOrderId,
            success: false,
            message: `Erro ao buscar pedido: ${shopifyError.message}`,
          });
          errorCount++;
          continue;
        }

        if (!shopifyOrders || shopifyOrders.length === 0) {
          console.log(`[fix-comissoes] Nenhum pedido Shopify encontrado com bling_order_id: ${blingOrderId}`);
          results.push({
            bling_order_id: blingOrderId,
            success: false,
            message: "Nenhum pedido Shopify encontrado com este Bling Order ID",
          });
          errorCount++;
          continue;
        }

        // Se houver múltiplos pedidos, pegar o primeiro
        const shopifyOrder = shopifyOrders[0];

        console.log(`[fix-comissoes] Pedido Shopify encontrado: ${shopifyOrder.order_number} (${shopifyOrder.customer_name})`);

        // 2. Buscar parcelas de comissão que devem ser vinculadas a este pedido
        // Estratégia: Buscar parcelas do mesmo cliente que ainda não têm link_danfe
        
        const { data: parcelas, error: parcelasError } = await supabase
          .from("vendedor_propostas_parcelas")
          .select(`
            id,
            proposta_id,
            valor,
            status,
            link_danfe,
            shopify_pedido_id,
            vendedor_propostas!inner(
              id,
              cliente_id,
              cliente_nome
            )
          `)
          .eq("vendedor_propostas.cliente_id", shopifyOrder.cliente_id)
          .is("link_danfe", null);

        if (parcelasError) {
          console.error(`[fix-comissoes] Erro ao buscar parcelas: ${parcelasError.message}`);
          results.push({
            bling_order_id: blingOrderId,
            success: false,
            message: `Erro ao buscar parcelas: ${parcelasError.message}`,
            shopify_order_id: shopifyOrder.id,
            customer_name: shopifyOrder.customer_name,
          });
          errorCount++;
          continue;
        }

        if (!parcelas || parcelas.length === 0) {
          console.log(`[fix-comissoes] Nenhuma parcela sem link_danfe encontrada para cliente: ${shopifyOrder.customer_name}`);
          
          // Verificar se já existe parcela vinculada com link_danfe
          const { data: existingParcela } = await supabase
            .from("vendedor_propostas_parcelas")
            .select("id, link_danfe")
            .eq("shopify_pedido_id", shopifyOrder.id)
            .not("link_danfe", "is", null)
            .maybeSingle();

          if (existingParcela) {
            results.push({
              bling_order_id: blingOrderId,
              success: true,
              message: "Parcela já vinculada com link_danfe",
              shopify_order_id: shopifyOrder.id,
              customer_name: shopifyOrder.customer_name,
              nota_fiscal_url: existingParcela.link_danfe,
              parcela_id: existingParcela.id,
            });
            successCount++;
          } else {
            results.push({
              bling_order_id: blingOrderId,
              success: false,
              message: "Nenhuma parcela encontrada para vincular",
              shopify_order_id: shopifyOrder.id,
              customer_name: shopifyOrder.customer_name,
            });
            errorCount++;
          }
          continue;
        }

        // 3. Encontrar a parcela mais adequada (valor mais próximo)
        const valorPedido = shopifyOrder.valor_total || 0;
        
        // Ordenar por valor mais próximo do pedido
        const parcelasOrdenadas = parcelas.sort((a: any, b: any) => {
          const diffA = Math.abs((a.valor || 0) - valorPedido);
          const diffB = Math.abs((b.valor || 0) - valorPedido);
          return diffA - diffB;
        });

        const parcelaSelecionada = parcelasOrdenadas[0];

        if (!parcelaSelecionada) {
          results.push({
            bling_order_id: blingOrderId,
            success: false,
            message: "Não foi possível encontrar parcela adequada",
            shopify_order_id: shopifyOrder.id,
            customer_name: shopifyOrder.customer_name,
          });
          errorCount++;
          continue;
        }

        console.log(`[fix-comissoes] Parcela selecionada: ${parcelaSelecionada.id}`);

        // 4. Atualizar a parcela com o shopify_pedido_id correto e link_danfe
        const updateData: any = {
          shopify_pedido_id: shopifyOrder.id,
        };

        if (shopifyOrder.nota_fiscal_url) {
          updateData.link_danfe = shopifyOrder.nota_fiscal_url;
        }

        const { error: updateError } = await supabase
          .from("vendedor_propostas_parcelas")
          .update(updateData)
          .eq("id", parcelaSelecionada.id);

        if (updateError) {
          console.error(`[fix-comissoes] Erro ao atualizar parcela: ${updateError.message}`);
          results.push({
            bling_order_id: blingOrderId,
            success: false,
            message: `Erro ao atualizar parcela: ${updateError.message}`,
            shopify_order_id: shopifyOrder.id,
            customer_name: shopifyOrder.customer_name,
            parcela_id: parcelaSelecionada.id,
          });
          errorCount++;
          continue;
        }

        console.log(`[fix-comissoes] Parcela ${parcelaSelecionada.id} atualizada com sucesso`);

        results.push({
          bling_order_id: blingOrderId,
          success: true,
          message: "Parcela vinculada e link_danfe atualizado",
          shopify_order_id: shopifyOrder.id,
          customer_name: shopifyOrder.customer_name,
          nota_fiscal_url: shopifyOrder.nota_fiscal_url,
          parcela_id: parcelaSelecionada.id,
        });
        successCount++;

      } catch (err) {
        console.error(`[fix-comissoes] Erro ao processar ${blingOrderId}:`, err);
        results.push({
          bling_order_id: blingOrderId,
          success: false,
          message: `Erro interno: ${err instanceof Error ? err.message : String(err)}`,
        });
        errorCount++;
      }
    }

    console.log(`[fix-comissoes] Concluído: ${successCount} sucesso, ${errorCount} erros`);

    return new Response(
      JSON.stringify({
        summary: {
          total: bling_order_ids.length,
          success: successCount,
          errors: errorCount,
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[fix-comissoes] Erro geral:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
