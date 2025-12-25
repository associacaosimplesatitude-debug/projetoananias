import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse CSV properly handling multi-line fields within quotes
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ';' && !insideQuotes) {
      // Field separator
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
      // Row separator
      if (char === '\r') i++; // Skip \n in \r\n
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  // Add last field and row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field !== '')) {
      rows.push(currentRow);
    }
  }
  
  return rows;
}

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

    // Remove BOM and parse CSV
    const cleanContent = csvContent.replace(/^\uFEFF/, '');
    const rows = parseCSV(cleanContent);
    
    console.log('Total rows parsed:', rows.length);
    
    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ error: 'CSV has no data rows' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First row is headers
    const headers = rows[0].map(h => h.replace(/"/g, ''));
    console.log('Headers found:', headers);

    // Map header names to indices
    const headerMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      headerMap[header] = index;
    });

    console.log('Header map:', headerMap);

    // Group by order number to consolidate items - use bling_order_id as key
    const ordersMap = new Map<number, {
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

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      
      const orderNumber = values[headerMap['Número pedido']]?.replace(/"/g, '');
      if (!orderNumber) {
        skippedLines++;
        continue;
      }

      // Use the order number directly as the bling_order_id
      const blingOrderId = parseInt(orderNumber) || 0;
      if (blingOrderId === 0) {
        skippedLines++;
        continue;
      }

      // Parse date from DD/MM/YYYY to YYYY-MM-DD
      const dateStr = values[headerMap['Data']]?.replace(/"/g, '');
      let orderDate = '';
      if (dateStr) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts;
          orderDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      // Parse numeric values (Brazilian format: comma as decimal)
      const parseNumber = (val: string | undefined) => {
        if (!val) return 0;
        const cleaned = val.replace(/"/g, '').replace(/\./g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
      };

      const totalPedido = parseNumber(values[headerMap['Total Pedido']]);
      const valorFrete = parseNumber(values[headerMap['Valor Frete Pedido']]);

      // If order already exists in map, skip (same order with different items)
      if (!ordersMap.has(blingOrderId)) {
        ordersMap.set(blingOrderId, {
          bling_order_id: blingOrderId,
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

    // Insert in batches of 50 to avoid issues
    const batchSize = 50;
    let totalInserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('bling_marketplace_pedidos')
        .upsert(batch, { 
          onConflict: 'bling_order_id',
          ignoreDuplicates: true 
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
