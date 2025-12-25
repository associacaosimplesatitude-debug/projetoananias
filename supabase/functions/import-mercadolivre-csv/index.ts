import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvContent } = await req.json();

    if (!csvContent) {
      return new Response(
        JSON.stringify({ error: 'CSV content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting Mercado Livre CSV import...');
    console.log('CSV content length:', csvContent.length);

    // Parse CSV - handle BOM and semicolon delimiter
    const lines = csvContent.replace(/^\uFEFF/, '').split('\n');
    const headers = lines[0].split(';').map((h: string) => h.replace(/"/g, '').trim());
    
    console.log('Headers found:', headers);
    console.log('Total lines:', lines.length);

    // Map header names to indices
    const headerMap: Record<string, number> = {};
    headers.forEach((header: string, index: number) => {
      headerMap[header] = index;
    });

    console.log('Header map:', headerMap);

    // Group by order number to consolidate items
    const ordersMap = new Map<string, {
      bling_order_id: number;
      order_number: string;
      customer_name: string;
      customer_email: string | null;
      customer_document: string | null;
      valor_total: number;
      valor_frete: number;
      order_date: string;
      marketplace: string;
      status_pagamento: string;
    }>();

    let processedLines = 0;
    let skippedLines = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        skippedLines++;
        continue;
      }

      // Parse CSV line handling quoted values with semicolons inside
      const values: string[] = [];
      let currentValue = '';
      let insideQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ';' && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Push last value

      const orderNumber = values[headerMap['Número pedido']]?.replace(/"/g, '');
      if (!orderNumber) {
        skippedLines++;
        continue;
      }

      // Parse date from DD/MM/YYYY to YYYY-MM-DD
      const dateStr = values[headerMap['Data']]?.replace(/"/g, '');
      let orderDate = '';
      if (dateStr) {
        const [day, month, year] = dateStr.split('/');
        orderDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // Parse numeric values (Brazilian format: comma as decimal)
      const parseNumber = (val: string | undefined) => {
        if (!val) return 0;
        const cleaned = val.replace(/"/g, '').replace(/\./g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
      };

      const totalPedido = parseNumber(values[headerMap['Total Pedido']]);
      const valorFrete = parseNumber(values[headerMap['Valor Frete Pedido']]);

      // If order already exists in map, we already have the totals (they're per-order, not per-item)
      if (!ordersMap.has(orderNumber)) {
        ordersMap.set(orderNumber, {
          bling_order_id: parseInt(orderNumber) || 0,
          order_number: orderNumber,
          customer_name: values[headerMap['Nome Comprador']]?.replace(/"/g, '') || 'N/A',
          customer_email: values[headerMap['E-mail Comprador']]?.replace(/"/g, '') || null,
          customer_document: values[headerMap['CPF/CNPJ Comprador']]?.replace(/"/g, '') || null,
          valor_total: totalPedido,
          valor_frete: valorFrete,
          order_date: orderDate ? `${orderDate}T12:00:00Z` : new Date().toISOString(),
          marketplace: 'MERCADO_LIVRE',
          status_pagamento: 'paid'
        });
        processedLines++;
      }
    }

    console.log('Unique orders found:', ordersMap.size);
    console.log('Processed lines:', processedLines);
    console.log('Skipped lines:', skippedLines);

    // Convert map to array
    const orders = Array.from(ordersMap.values());

    if (orders.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No orders found in CSV',
          stats: { total: 0, inserted: 0, skipped: skippedLines }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert in batches of 100
    const batchSize = 100;
    let totalInserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('bling_marketplace_pedidos')
        .upsert(batch, { 
          onConflict: 'bling_order_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error('Batch insert error:', error);
        errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
      } else {
        totalInserted += batch.length;
        console.log(`Batch ${Math.floor(i/batchSize) + 1} inserted: ${batch.length} orders`);
      }
    }

    console.log('Import completed. Total inserted:', totalInserted);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Importação concluída`,
        stats: {
          total_orders: orders.length,
          inserted: totalInserted,
          skipped_lines: skippedLines,
          errors: errors.length > 0 ? errors : undefined
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Import failed', 
        details: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
