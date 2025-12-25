import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function classifyAtacadoOrder(customerName: string | null | undefined): string {
  if (!customerName) return 'ATACADO';
  
  const upperName = customerName.toUpperCase();
  
  if (upperName.includes('ADVEC') || 
      upperName.includes('ASSEMBLEIA DE DEUS VITORIA EM CRISTO') ||
      upperName.includes('ASSEMBLEIA DE DEUS VITÓRIA EM CRISTO') ||
      upperName.includes('AD VITORIA EM CRISTO') ||
      upperName.includes('AD VITÓRIA EM CRISTO')) {
    return 'ADVECS';
  }
  
  return 'ATACADO';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: "Nenhum arquivo enviado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const text = await file.text();
    const lines = text.split("\n").filter(line => line.trim());
    
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "Arquivo CSV vazio ou inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detectar delimitador
    const firstLine = lines[0];
    const delimiter = firstLine.includes(";") ? ";" : ",";
    
    // Parse header
    const headers = firstLine.split(delimiter).map(h => h.replace(/"/g, "").trim().toLowerCase());
    console.log("Headers encontrados:", headers);

    // Mapear colunas - adaptar conforme estrutura do CSV de atacado
    const colMap = {
      numero: headers.findIndex(h => h.includes("nº") || h.includes("numero") || h.includes("pedido") || h.includes("order")),
      data: headers.findIndex(h => h.includes("data") || h.includes("date") || h.includes("emissao") || h.includes("emissão")),
      cliente: headers.findIndex(h => h.includes("cliente") || h.includes("customer") || h.includes("comprador") || h.includes("nome")),
      email: headers.findIndex(h => h.includes("email") || h.includes("e-mail")),
      total: headers.findIndex(h => h.includes("total") || h.includes("valor") || h.includes("value")),
      frete: headers.findIndex(h => h.includes("frete") || h.includes("shipping") || h.includes("envio")),
      status: headers.findIndex(h => h.includes("status") || h.includes("situação") || h.includes("situacao")),
      rastreio: headers.findIndex(h => h.includes("rastreio") || h.includes("tracking") || h.includes("rastreamento")),
    };

    console.log("Mapeamento de colunas:", colMap);

    if (colMap.numero === -1) {
      return new Response(
        JSON.stringify({ 
          error: "Coluna de número do pedido não encontrada. Headers: " + headers.join(", ")
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ordersMap = new Map<string, any>();
    let processedLines = 0;
    let skippedLines = 0;
    let advecs = 0;
    let atacado = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line considerando aspas
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const orderNumber = values[colMap.numero]?.replace(/"/g, "").trim();
      if (!orderNumber) {
        skippedLines++;
        continue;
      }

      // Parse data
      let orderDate: string | null = null;
      if (colMap.data !== -1 && values[colMap.data]) {
        const rawDate = values[colMap.data].replace(/"/g, "").trim();
        // Tentar diferentes formatos de data
        if (rawDate.includes("/")) {
          const parts = rawDate.split("/");
          if (parts.length === 3) {
            // DD/MM/YYYY ou MM/DD/YYYY
            if (parseInt(parts[0]) > 12) {
              // DD/MM/YYYY
              orderDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            } else {
              // Assumir DD/MM/YYYY
              orderDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            }
          }
        } else if (rawDate.includes("-")) {
          orderDate = rawDate.split(" ")[0]; // YYYY-MM-DD
        }
      }

      // Parse valores monetários
      const parseNumber = (val: string | undefined): number => {
        if (!val) return 0;
        const cleaned = val.replace(/"/g, "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
        return parseFloat(cleaned) || 0;
      };

      const valorTotal = colMap.total !== -1 ? parseNumber(values[colMap.total]) : 0;
      const valorFrete = colMap.frete !== -1 ? parseNumber(values[colMap.frete]) : 0;
      const customerName = colMap.cliente !== -1 ? values[colMap.cliente]?.replace(/"/g, "").trim() : null;
      const customerEmail = colMap.email !== -1 ? values[colMap.email]?.replace(/"/g, "").trim() : null;
      const status = colMap.status !== -1 ? values[colMap.status]?.replace(/"/g, "").trim() || "paid" : "paid";
      const rastreio = colMap.rastreio !== -1 ? values[colMap.rastreio]?.replace(/"/g, "").trim() : null;

      // Classificar como ADVECS ou ATACADO
      const marketplace = classifyAtacadoOrder(customerName);

      // Gerar bling_order_id seguro - pegar apenas os primeiros 15 dígitos para não estourar bigint
      const numericPart = orderNumber.replace(/\D/g, "").slice(0, 15);
      const blingOrderId = numericPart ? parseInt(numericPart) : Math.floor(Math.random() * 1000000000);

      // Usar Map para agrupar por order_number (evitar duplicatas do mesmo pedido com múltiplos itens)
      const existingOrder = ordersMap.get(orderNumber);
      if (existingOrder) {
        // Somar valores se já existe
        existingOrder.valor_total += valorTotal;
        existingOrder.valor_frete = Math.max(existingOrder.valor_frete, valorFrete); // Frete só conta uma vez
      } else {
        ordersMap.set(orderNumber, {
          bling_order_id: blingOrderId,
          order_number: orderNumber,
          customer_name: customerName,
          customer_email: customerEmail,
          valor_total: valorTotal,
          valor_frete: valorFrete,
          order_date: orderDate ? `${orderDate}T12:00:00Z` : new Date().toISOString(),
          marketplace: marketplace,
          status_pagamento: status.toLowerCase().includes("pago") || status.toLowerCase().includes("paid") ? "paid" : status,
          codigo_rastreio: rastreio || null,
        });
        
        if (marketplace === 'ADVECS') {
          advecs++;
        } else {
          atacado++;
        }
      }
      processedLines++;
    }

    // Converter Map para array
    const ordersToInsert = Array.from(ordersMap.values());

    console.log(`Linhas processadas: ${processedLines}, Pedidos únicos: ${ordersToInsert.length}, ADVECS: ${advecs}, ATACADO: ${atacado}`);

    if (ordersToInsert.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum pedido válido encontrado no CSV" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inserir em lotes de 500 para evitar estouro de memória
    const BATCH_SIZE = 500;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < ordersToInsert.length; i += BATCH_SIZE) {
      const batch = ordersToInsert.slice(i, i + BATCH_SIZE);
      
      const { error: insertError } = await supabase
        .from("bling_marketplace_pedidos")
        .upsert(batch, { 
          onConflict: "bling_order_id",
          ignoreDuplicates: false 
        });

      if (insertError) {
        console.error(`Erro no lote ${Math.floor(i/BATCH_SIZE) + 1}:`, insertError.message);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
      
      console.log(`Lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(ordersToInsert.length/BATCH_SIZE)} processado`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Importados ${inserted} pedidos com sucesso!`,
        total: inserted,
        advecs: advecs,
        atacado: atacado,
        skipped: skippedLines,
        errors: errors
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro na importação:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
