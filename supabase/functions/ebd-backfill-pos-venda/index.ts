import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar pedidos Shopify com vendedor_id preenchido que ainda não estão na tabela pivô
    const { data: pedidos, error: pedidosError } = await supabase
      .from("ebd_shopify_pedidos")
      .select("id, vendedor_id, cliente_id, customer_email")
      .not("vendedor_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (pedidosError) throw pedidosError;

    let created = 0;
    let skipped = 0;
    let linkedByEmail = 0;

    for (const pedido of pedidos || []) {
      // Verificar se já existe na tabela pivô
      const { data: existing } = await supabase
        .from("ebd_pos_venda_ecommerce")
        .select("id")
        .eq("pedido_id", pedido.id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      let clienteId = pedido.cliente_id;

      // Se não tem cliente_id mas tem email, tentar encontrar
      if (!clienteId && pedido.customer_email) {
        const { data: cliente } = await supabase
          .from("ebd_clientes")
          .select("id, status_ativacao_ebd")
          .ilike("email_superintendente", pedido.customer_email.toLowerCase().trim())
          .maybeSingle();

        if (cliente) {
          clienteId = cliente.id;
          linkedByEmail++;

          // Atualizar o pedido com o cliente_id
          await supabase
            .from("ebd_shopify_pedidos")
            .update({ cliente_id: cliente.id })
            .eq("id", pedido.id);

          // Atualizar o cliente para is_pos_venda_ecommerce = true
          await supabase
            .from("ebd_clientes")
            .update({ 
              is_pos_venda_ecommerce: true,
              vendedor_id: pedido.vendedor_id
            })
            .eq("id", cliente.id);
        }
      }

      // Verificar se o cliente já ativou o painel
      let ativado = false;
      if (clienteId) {
        const { data: clienteData } = await supabase
          .from("ebd_clientes")
          .select("status_ativacao_ebd")
          .eq("id", clienteId)
          .maybeSingle();
        
        ativado = clienteData?.status_ativacao_ebd || false;
      }

      // Inserir na tabela pivô
      const { error: insertError } = await supabase
        .from("ebd_pos_venda_ecommerce")
        .insert({
          pedido_id: pedido.id,
          vendedor_id: pedido.vendedor_id,
          cliente_id: clienteId,
          ativado: ativado,
        });

      if (!insertError) {
        created++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill concluído`,
        created,
        skipped,
        linkedByEmail,
        total_processed: pedidos?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro no backfill:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
