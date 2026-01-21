import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[BACKFILL-HIERARQUICAS] Iniciando backfill de comissões hierárquicas...");

    // 1. Buscar config do admin
    const { data: adminConfig } = await supabase
      .from("comissoes_config")
      .select("*")
      .eq("tipo", "admin")
      .eq("ativo", true)
      .single();

    if (!adminConfig) {
      console.log("[BACKFILL-HIERARQUICAS] Config admin não encontrada");
      return new Response(JSON.stringify({ error: "Config admin não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[BACKFILL-HIERARQUICAS] Admin config: ${adminConfig.percentual}% para ${adminConfig.email_beneficiario}`);

    // 2. Buscar todas as parcelas que ainda não têm comissões hierárquicas
    const { data: parcelasExistentes } = await supabase
      .from("comissoes_hierarquicas")
      .select("parcela_origem_id");

    const parcelasJaProcessadas = new Set(parcelasExistentes?.map(p => p.parcela_origem_id) || []);

    // 3. Buscar todas as parcelas de propostas aprovadas/faturadas/pagas
    const { data: parcelas, error: parcelasError } = await supabase
      .from("vendedor_propostas_parcelas")
      .select(`
        id,
        valor,
        data_vencimento,
        proposta_id,
        vendedor_propostas!inner (
          id,
          cliente_id,
          cliente_nome,
          vendedor_id,
          vendedor_nome,
          status
        )
      `)
      .in("vendedor_propostas.status", ["FATURADO", "PAGO", "APROVADA_FATURAMENTO"]);

    if (parcelasError) {
      console.error("[BACKFILL-HIERARQUICAS] Erro ao buscar parcelas:", parcelasError);
      throw parcelasError;
    }

    console.log(`[BACKFILL-HIERARQUICAS] Encontradas ${parcelas?.length || 0} parcelas aprovadas/faturadas`);

    // 4. Buscar vendedores com seus gerentes
    const { data: vendedores } = await supabase
      .from("vendedores")
      .select("id, nome, email, comissao_percentual, gerente_id, is_gerente");

    const vendedorMap = new Map(vendedores?.map(v => [v.id, v]) || []);

    // 5. Criar comissões hierárquicas
    const comissoesParaInserir: any[] = [];
    let parcelasProcessadas = 0;
    let parcelasPuladas = 0;

    for (const parcela of parcelas || []) {
      // Pular se já processada
      if (parcelasJaProcessadas.has(parcela.id)) {
        parcelasPuladas++;
        continue;
      }

      const proposta = parcela.vendedor_propostas as any;
      const vendedor = vendedorMap.get(proposta.vendedor_id);

      if (!vendedor) {
        console.log(`[BACKFILL-HIERARQUICAS] Vendedor não encontrado: ${proposta.vendedor_id}`);
        continue;
      }

      // Comissão do GERENTE (se vendedor tem gerente)
      if (vendedor.gerente_id) {
        const gerente = vendedorMap.get(vendedor.gerente_id);
        if (gerente) {
          const valorComissaoGerente = Math.round(parcela.valor * (gerente.comissao_percentual / 100) * 100) / 100;
          comissoesParaInserir.push({
            parcela_origem_id: parcela.id,
            tipo_beneficiario: "gerente",
            beneficiario_id: gerente.id,
            beneficiario_email: gerente.email,
            beneficiario_nome: gerente.nome,
            vendedor_origem_id: vendedor.id,
            vendedor_origem_nome: vendedor.nome,
            cliente_id: proposta.cliente_id,
            cliente_nome: proposta.cliente_nome,
            valor_venda: parcela.valor,
            percentual_comissao: gerente.comissao_percentual,
            valor_comissao: valorComissaoGerente,
            data_vencimento: parcela.data_vencimento,
            status: "pendente",
          });
        }
      }

      // Comissão do ADMIN (sempre)
      const valorComissaoAdmin = Math.round(parcela.valor * (adminConfig.percentual / 100) * 100) / 100;
      comissoesParaInserir.push({
        parcela_origem_id: parcela.id,
        tipo_beneficiario: "admin",
        beneficiario_id: null,
        beneficiario_email: adminConfig.email_beneficiario,
        beneficiario_nome: "Administrador",
        vendedor_origem_id: vendedor.id,
        vendedor_origem_nome: vendedor.nome,
        cliente_id: proposta.cliente_id,
        cliente_nome: proposta.cliente_nome,
        valor_venda: parcela.valor,
        percentual_comissao: adminConfig.percentual,
        valor_comissao: valorComissaoAdmin,
        data_vencimento: parcela.data_vencimento,
        status: "pendente",
      });

      parcelasProcessadas++;
    }

    console.log(`[BACKFILL-HIERARQUICAS] Parcelas processadas: ${parcelasProcessadas}, puladas: ${parcelasPuladas}`);
    console.log(`[BACKFILL-HIERARQUICAS] Comissões a inserir: ${comissoesParaInserir.length}`);

    // 6. Inserir em lotes de 100
    let inseridas = 0;
    const batchSize = 100;

    for (let i = 0; i < comissoesParaInserir.length; i += batchSize) {
      const batch = comissoesParaInserir.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("comissoes_hierarquicas")
        .insert(batch);

      if (insertError) {
        console.error(`[BACKFILL-HIERARQUICAS] Erro ao inserir lote ${i}:`, insertError);
      } else {
        inseridas += batch.length;
      }
    }

    console.log(`[BACKFILL-HIERARQUICAS] Backfill concluído! ${inseridas} comissões criadas.`);

    return new Response(
      JSON.stringify({
        success: true,
        parcelasProcessadas,
        parcelasPuladas,
        comissoesCriadas: inseridas,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[BACKFILL-HIERARQUICAS] Erro:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
