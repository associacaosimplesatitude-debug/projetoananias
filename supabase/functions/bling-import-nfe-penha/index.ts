import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Glorinha vendedor_id
const GLORINHA_VENDEDOR_ID = "7b9cc0eb-66ed-4396-a314-a5d3701a4591";

interface NfeFromBling {
  id: number;
  numero: string;
  chaveAcesso?: string;
  situacao?: number;
  dataEmissao?: string;
  valorNota?: number;
  contato?: {
    id?: number;
    nome?: string;
    numeroDocumento?: string;
    telefone?: string;
  };
  vendedor?: {
    id?: number;
  };
  linkDanfe?: string;
  linkPDF?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for date range
    let dataInicial: string;
    let dataFinal: string;
    
    try {
      const body = await req.json();
      dataInicial = body.dataInicial;
      dataFinal = body.dataFinal;
    } catch {
      // Default: today
      const today = new Date().toISOString().split("T")[0];
      dataInicial = today;
      dataFinal = today;
    }

    console.log(`[bling-import-nfe-penha] Importando NF-es de ${dataInicial} até ${dataFinal}`);

    // 1. Get Bling Penha tokens
    const { data: blingConfig, error: configError } = await supabase
      .from("bling_config_penha")
      .select("*")
      .limit(1)
      .single();

    if (configError || !blingConfig) {
      throw new Error("Configuração Bling Penha não encontrada");
    }

    let accessToken = blingConfig.access_token;

    // Check if token expired
    if (blingConfig.token_expires_at) {
      const expiresAt = new Date(blingConfig.token_expires_at);
      if (expiresAt < new Date()) {
        console.log("[bling-import-nfe-penha] Token expirado, renovando...");
        
        const clientId = blingConfig.client_id || Deno.env.get("BLING_CLIENT_ID_PENHA");
        const clientSecret = blingConfig.client_secret || Deno.env.get("BLING_CLIENT_SECRET_PENHA");
        
        if (!clientId || !clientSecret || !blingConfig.refresh_token) {
          throw new Error("Credenciais Bling Penha incompletas");
        }
        
        const credentials = btoa(`${clientId}:${clientSecret}`);
        const refreshResponse = await fetch("https://bling.com.br/Api/v3/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${credentials}`,
          },
          body: `grant_type=refresh_token&refresh_token=${blingConfig.refresh_token}`,
        });

        if (!refreshResponse.ok) {
          throw new Error("Falha ao renovar token Bling Penha");
        }

        const tokenData = await refreshResponse.json();
        accessToken = tokenData.access_token;

        const newExpiresAt = new Date();
        newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in - 300);

        await supabase
          .from("bling_config_penha")
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: newExpiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", blingConfig.id);
      }
    }

    // 2. Fetch NF-es from Bling
    // API endpoint: GET /nfe?dataEmissaoInicial=YYYY-MM-DD&dataEmissaoFinal=YYYY-MM-DD&situacao=4 (autorizada)
    const nfeUrl = `https://bling.com.br/Api/v3/nfe?dataEmissaoInicial=${dataInicial}&dataEmissaoFinal=${dataFinal}&situacao=4&limite=100`;
    
    console.log(`[bling-import-nfe-penha] Chamando API: ${nfeUrl}`);

    const nfeResponse = await fetch(nfeUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!nfeResponse.ok) {
      const errorText = await nfeResponse.text();
      console.error("[bling-import-nfe-penha] Erro API Bling:", errorText);
      throw new Error(`Erro ao buscar NF-es: ${nfeResponse.status}`);
    }

    const nfeData = await nfeResponse.json();
    const nfes: NfeFromBling[] = nfeData.data || [];

    console.log(`[bling-import-nfe-penha] Encontradas ${nfes.length} NF-es autorizadas`);

    if (nfes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imported: 0, message: "Nenhuma NF-e encontrada no período" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let importedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // 3. Process each NF-e
    for (const nfe of nfes) {
      try {
        // Get full NF-e details to get DANFE link
        const detailResponse = await fetch(`https://bling.com.br/Api/v3/nfe/${nfe.id}`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/json",
          },
        });

        let danfeUrl = nfe.linkDanfe || nfe.linkPDF;
        let chaveAcesso = nfe.chaveAcesso;
        let contato = nfe.contato;
        let valorNota = nfe.valorNota;
        let vendaPedidoId: number | null = null;

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          const nfeDetail = detailData.data;
          
          danfeUrl = nfeDetail?.linkDanfe || nfeDetail?.linkPDF || danfeUrl;
          chaveAcesso = nfeDetail?.chaveAcesso || chaveAcesso;
          contato = nfeDetail?.contato || contato;
          valorNota = nfeDetail?.valorNota || valorNota;
          vendaPedidoId = nfeDetail?.vendedor?.id || null;
        }

        // Check if already exists in vendas_balcao by nfe_id or nota_fiscal_numero
        const { data: existingVenda } = await supabase
          .from("vendas_balcao")
          .select("id")
          .or(`nfe_id.eq.${nfe.id},nota_fiscal_numero.eq.${nfe.numero}`)
          .limit(1)
          .single();

        if (existingVenda) {
          // Update existing record
          await supabase
            .from("vendas_balcao")
            .update({
              nfe_id: nfe.id,
              nota_fiscal_numero: nfe.numero,
              nota_fiscal_chave: chaveAcesso,
              nota_fiscal_url: danfeUrl,
              status_nfe: "AUTORIZADA",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingVenda.id);
          
          updatedCount++;
          console.log(`[bling-import-nfe-penha] Atualizada venda existente: ${nfe.numero}`);
          continue;
        }

        // Check if exists in vendas_balcao by bling_order_id (if we have vendedor/pedido id)
        if (vendaPedidoId) {
          const { data: vendaByBling } = await supabase
            .from("vendas_balcao")
            .select("id")
            .eq("bling_order_id", vendaPedidoId)
            .limit(1)
            .single();

          if (vendaByBling) {
            await supabase
              .from("vendas_balcao")
              .update({
                nfe_id: nfe.id,
                nota_fiscal_numero: nfe.numero,
                nota_fiscal_chave: chaveAcesso,
                nota_fiscal_url: danfeUrl,
                status_nfe: "AUTORIZADA",
                updated_at: new Date().toISOString(),
              })
              .eq("id", vendaByBling.id);

            updatedCount++;
            console.log(`[bling-import-nfe-penha] Atualizada venda por bling_order_id: ${nfe.numero}`);
            continue;
          }
        }

        // Create new record in vendas_balcao
        const { error: insertError } = await supabase
          .from("vendas_balcao")
          .insert({
            vendedor_id: GLORINHA_VENDEDOR_ID,
            polo: "penha",
            cliente_nome: contato?.nome || "Cliente Balcão",
            cliente_cpf: contato?.numeroDocumento || null,
            cliente_telefone: contato?.telefone || null,
            itens: [],
            valor_subtotal: valorNota || 0,
            valor_desconto: 0,
            valor_total: valorNota || 0,
            forma_pagamento: "nao_informado",
            status: "concluido",
            nfe_id: nfe.id,
            nota_fiscal_numero: nfe.numero,
            nota_fiscal_chave: chaveAcesso,
            nota_fiscal_url: danfeUrl,
            status_nfe: "AUTORIZADA",
            created_at: nfe.dataEmissao ? new Date(nfe.dataEmissao).toISOString() : new Date().toISOString(),
          });

        if (insertError) {
          console.error(`[bling-import-nfe-penha] Erro inserindo NF-e ${nfe.numero}:`, insertError);
          errors.push(`NF-e ${nfe.numero}: ${insertError.message}`);
        } else {
          importedCount++;
          console.log(`[bling-import-nfe-penha] Importada nova NF-e: ${nfe.numero}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (nfeError: unknown) {
        const errMsg = nfeError instanceof Error ? nfeError.message : String(nfeError);
        console.error(`[bling-import-nfe-penha] Erro processando NF-e ${nfe.numero}:`, nfeError);
        errors.push(`NF-e ${nfe.numero}: ${errMsg}`);
      }
    }

    const result = {
      success: true,
      total: nfes.length,
      imported: importedCount,
      updated: updatedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `${importedCount} novas importadas, ${updatedCount} atualizadas`,
    };

    console.log("[bling-import-nfe-penha] Resultado:", result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[bling-import-nfe-penha] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
