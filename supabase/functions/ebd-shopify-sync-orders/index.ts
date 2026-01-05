import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "kgg1pq-6r.myshopify.com";
const SHOPIFY_API_VERSION = "2025-07";

type ShopifyAddress = {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  province_code?: string | null;
  country?: string | null;
  country_code?: string | null;
  zip?: string | null;
  phone?: string | null;
  name?: string | null;
};

type ShopifyLineItem = {
  id: number;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  price: string;
  total_discount: string;
};

type ShopifyOrder = {
  id: number;
  name: string;
  financial_status: string;
  created_at: string;
  updated_at: string;
  email: string | null;
  phone?: string | null;
  customer: { 
    first_name: string | null; 
    last_name: string | null; 
    email: string | null;
    phone?: string | null;
    default_address?: ShopifyAddress | null;
    metafield?: { value: string } | null;
  } | null;
  tags: string | null;
  note_attributes?: Array<{ name: string; value: string }>;
  note?: string | null;
  total_price: string;
  shipping_lines?: Array<{ price: string }>;
  billing_address?: ShopifyAddress | null;
  shipping_address?: ShopifyAddress | null;
  custom_attributes?: Array<{ name: string; value: string }>;
  line_items?: ShopifyLineItem[];
};

function getNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  // Example: <https://.../orders.json?limit=250&page_info=xxxxx>; rel="next"
  const parts = linkHeader.split(",").map((p) => p.trim());
  for (const part of parts) {
    if (!part.includes('rel="next"')) continue;
    const matchUrl = part.match(/<([^>]+)>/);
    if (!matchUrl?.[1]) continue;
    try {
      const url = new URL(matchUrl[1]);
      return url.searchParams.get("page_info");
    } catch {
      return null;
    }
  }

  return null;
}

interface ExtractedData {
  vendedorId: string | null;
  clienteId: string | null;
  customerDocument: string | null;
  endereco: {
    rua: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
  };
  telefone: string | null;
}

function extractOrderData(order: ShopifyOrder): ExtractedData {
  let vendedorId: string | null = null;
  let clienteId: string | null = null;
  let customerDocument: string | null = null;

  // 1. Busca em note_attributes (mais comum para apps de checkout brasileiro)
  const allAttributes = [
    ...(order.note_attributes || []),
    ...(order.custom_attributes || []),
  ];

  for (const attr of allAttributes) {
    if (attr?.name === "vendedor_id") vendedorId = attr.value;
    if (attr?.name === "cliente_id") clienteId = attr.value;
    
    // Busca por diversos nomes possíveis para CPF/CNPJ
    const attrNameLower = (attr?.name || "").toLowerCase().replace(/[_\s]/g, "");
    const docFields = ["cpf", "cnpj", "cpfcnpj", "document", "taxid", "registroempresa", "registrodaempresa", "documento", "cpf/cnpj", "registrodaempresa"];
    if (docFields.some(f => attrNameLower.includes(f)) && attr.value) {
      customerDocument = attr.value;
    }
  }

  // 2. Busca no campo "note" do pedido (alguns apps colocam lá)
  if (!customerDocument && order.note) {
    // Tenta extrair CPF/CNPJ do note
    const cpfMatch = order.note.match(/(?:cpf|cnpj)[:\s]*([0-9.\-\/]+)/i);
    if (cpfMatch) {
      customerDocument = cpfMatch[1];
    }
  }

  // 3. Busca no campo "company" dos endereços (comum em checkouts brasileiros)
  if (!customerDocument) {
    const possibleSources = [
      order.billing_address?.company,
      order.shipping_address?.company,
      order.customer?.default_address?.company,
    ];
    
    for (const company of possibleSources) {
      if (company) {
        const digits = company.replace(/\D/g, "");
        // CPF tem 11 dígitos, CNPJ tem 14 dígitos
        if (digits.length === 11 || digits.length === 14) {
          customerDocument = company;
          break;
        }
      }
    }
  }

  if (!vendedorId && order.tags) {
    const tagMatch = order.tags.match(/vendedor_([a-f0-9-]+)/i);
    if (tagMatch) vendedorId = tagMatch[1];
  }

  // Extrai endereço de entrega (prioridade: shipping_address > billing_address > customer.default_address)
  const addr = order.shipping_address || order.billing_address || order.customer?.default_address || null;
  
  // Separa rua e número do address1 (formato comum: "Rua Nome, 123")
  let rua = addr?.address1 || null;
  let numero: string | null = null;
  
  if (rua) {
    // Tenta extrair número do final do address1
    const numeroMatch = rua.match(/,?\s*(\d+[A-Za-z]?)\s*$/);
    if (numeroMatch) {
      numero = numeroMatch[1];
      rua = rua.replace(/,?\s*\d+[A-Za-z]?\s*$/, '').trim();
    }
  }

  // Extrai telefone (prioridade: order.phone > shipping_address.phone > customer.phone)
  const telefone = order.phone || addr?.phone || order.customer?.phone || null;

  // Log detalhado para debugging
  console.log(`Order ${order.name}: document=${customerDocument}, phone=${telefone}, address=${JSON.stringify(addr)}, note_attrs=${JSON.stringify(order.note_attributes)}`);

  return {
    vendedorId,
    clienteId,
    customerDocument,
    endereco: {
      rua,
      numero,
      complemento: addr?.address2 || null,
      bairro: null, // Shopify não tem campo separado para bairro - pode vir no address2
      cidade: addr?.city || null,
      estado: addr?.province_code || addr?.province || null,
      cep: addr?.zip || null,
    },
    telefone,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SHOPIFY_ACCESS_TOKEN = Deno.env.get("SHOPIFY_ADMIN_ACCESS_TOKEN");
    if (!SHOPIFY_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "Shopify not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Defaults: sync ALL PAID orders since store start
    const body = (await req.json().catch(() => ({}))) as {
      financial_status?: string; // paid | any
      status?: string; // open | closed | any
    };

    const financialStatus = body.financial_status ?? "paid";
    const status = body.status ?? "any";

    console.log("Starting Shopify orders sync", { financialStatus, status });

    const allOrders: ShopifyOrder[] = [];
    let pageInfo: string | null = null;

    // Shopify REST pagination via Link header
    for (let i = 0; i < 100; i++) {
      const url = new URL(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json`);
      url.searchParams.set("limit", "250");
      url.searchParams.set("status", status);
      url.searchParams.set("financial_status", financialStatus);
      url.searchParams.set("order", "created_at asc");

      // IMPORTANT: ensure line_items (and other needed fields) are returned
      url.searchParams.set(
        "fields",
        [
          "id",
          "name",
          "financial_status",
          "created_at",
          "updated_at",
          "email",
          "phone",
          "customer",
          "tags",
          "note_attributes",
          "note",
          "total_price",
          "shipping_lines",
          "billing_address",
          "shipping_address",
          "line_items",
        ].join(",")
      );

      if (pageInfo) url.searchParams.set("page_info", pageInfo);

      console.log("Fetching orders page", { i, pageInfo });

      const resp = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error("Failed to fetch orders", resp.status, text);
        return new Response(JSON.stringify({ error: "Failed to fetch orders", status: resp.status, details: text }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = (await resp.json()) as { orders: ShopifyOrder[] };
      const orders = payload.orders ?? [];
      allOrders.push(...orders);

      const next = getNextPageInfo(resp.headers.get("link"));
      if (!next || orders.length === 0) break;
      pageInfo = next;
    }

    console.log("Orders fetched", { count: allOrders.length });

    if (allOrders.length === 0) {
      return new Response(JSON.stringify({ success: true, synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = allOrders.map((order) => {
      const extracted = extractOrderData(order);

      const valorFrete = order.shipping_lines && order.shipping_lines.length > 0 ? parseFloat(order.shipping_lines[0].price) : 0;
      const valorTotal = parseFloat(order.total_price);
      const valorParaMeta = valorTotal - valorFrete;

      const customerName = order.customer
        ? `${order.customer.first_name ?? ""} ${order.customer.last_name ?? ""}`.trim() || null
        : null;

      return {
        shopify_order_id: order.id,
        order_number: order.name,
        vendedor_id: extracted.vendedorId,
        cliente_id: extracted.clienteId,
        status_pagamento: order.financial_status,
        valor_total: valorTotal,
        valor_frete: valorFrete,
        valor_para_meta: valorParaMeta,
        customer_email: order.email || order.customer?.email || null,
        customer_name: customerName,
        customer_document: extracted.customerDocument,
        customer_phone: extracted.telefone,
        endereco_rua: extracted.endereco.rua,
        endereco_numero: extracted.endereco.numero,
        endereco_complemento: extracted.endereco.complemento,
        endereco_bairro: extracted.endereco.bairro,
        endereco_cidade: extracted.endereco.cidade,
        endereco_estado: extracted.endereco.estado,
        endereco_cep: extracted.endereco.cep,
        order_date: order.created_at,
        created_at: order.created_at,
        updated_at: order.updated_at,
      };
    });

    const { error } = await supabase
      .from("ebd_shopify_pedidos")
      .upsert(rows, { onConflict: "shopify_order_id", ignoreDuplicates: false });

    if (error) {
      console.error("Error upserting orders", error);
      return new Response(JSON.stringify({ error: "Failed to save orders", details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync line items for each order
    console.log("Syncing line items...");
    let totalItemsSynced = 0;

    for (const order of allOrders) {
      if (!order.line_items || order.line_items.length === 0) continue;

      // Get the pedido_id from database
      const { data: pedidoData } = await supabase
        .from("ebd_shopify_pedidos")
        .select("id")
        .eq("shopify_order_id", order.id)
        .single();

      if (!pedidoData) continue;

      const itemRows = order.line_items.map((item) => ({
        pedido_id: pedidoData.id,
        shopify_line_item_id: item.id,
        product_title: item.title,
        variant_title: item.variant_title || null,
        sku: item.sku || null,
        quantity: item.quantity,
        price: parseFloat(item.price),
        total_discount: parseFloat(item.total_discount || "0"),
      }));

      const { error: itemsError } = await supabase
        .from("ebd_shopify_pedidos_itens")
        .upsert(itemRows, { onConflict: "pedido_id,shopify_line_item_id", ignoreDuplicates: false });

      if (itemsError) {
        console.error(`Error upserting items for order ${order.name}`, itemsError);
      } else {
        totalItemsSynced += itemRows.length;
      }
    }

    console.log("Items synced", { totalItemsSynced });

    return new Response(JSON.stringify({ success: true, synced: rows.length, items_synced: totalItemsSynced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
