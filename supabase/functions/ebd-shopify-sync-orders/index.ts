import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "revendacentralgospel.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";

type ShopifyOrder = {
  id: number;
  name: string;
  financial_status: string;
  created_at: string;
  updated_at: string;
  email: string | null;
  customer: { 
    first_name: string | null; 
    last_name: string | null; 
    email: string | null;
    default_address?: {
      company?: string | null;
    } | null;
    metafield?: { value: string } | null;
    metafields?: Array<{ key: string; value: string }>;
  } | null;
  tags: string | null;
  note_attributes?: Array<{ name: string; value: string }>;
  note?: string | null;
  total_price: string;
  shipping_lines?: Array<{ price: string }>;
  billing_address?: {
    company?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  shipping_address?: {
    company?: string | null;
  } | null;
  custom_attributes?: Array<{ name: string; value: string }>;
  // Para lojas brasileiras, CPF/CNPJ pode estar em buyer_accepts_marketing ou tax_lines
  tax_lines?: Array<{ title?: string; rate?: number }>;
  // Novos campos para checkout brasileiro
  checkout_id?: number;
  order_status_url?: string;
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

function extractIds(order: ShopifyOrder): { vendedorId: string | null; clienteId: string | null; customerDocument: string | null } {
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
    const docFields = ["cpf", "cnpj", "cpfcnpj", "document", "taxid", "registroempresa", "registrodaempresa", "documento", "cpf/cnpj"];
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

  // 3. Busca no campo "company" dos endereços
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

  // Log detalhado para debugging
  console.log(`Order ${order.name}: document=${customerDocument}, note_attrs=${JSON.stringify(order.note_attributes)}, billing_company=${order.billing_address?.company}`);

  return { vendedorId, clienteId, customerDocument };
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

      if (pageInfo) url.searchParams.set("page_info", pageInfo);

      console.log("Fetching orders page", { i, pageInfo });

      // Adiciona fields extras para pegar note_attributes
      const fieldsParam = "id,name,financial_status,created_at,updated_at,email,customer,tags,note_attributes,note,total_price,shipping_lines,billing_address,shipping_address";
      if (!pageInfo) {
        url.searchParams.set("fields", fieldsParam);
      }

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
      const { vendedorId, clienteId, customerDocument } = extractIds(order);

      const valorFrete = order.shipping_lines && order.shipping_lines.length > 0 ? parseFloat(order.shipping_lines[0].price) : 0;
      const valorTotal = parseFloat(order.total_price);
      const valorParaMeta = valorTotal - valorFrete;

      const customerName = order.customer
        ? `${order.customer.first_name ?? ""} ${order.customer.last_name ?? ""}`.trim() || null
        : null;

      return {
        shopify_order_id: order.id,
        order_number: order.name,
        vendedor_id: vendedorId,
        cliente_id: clienteId,
        status_pagamento: order.financial_status, // keep canonical Shopify status
        valor_total: valorTotal,
        valor_frete: valorFrete,
        valor_para_meta: valorParaMeta,
        customer_email: order.email || order.customer?.email || null,
        customer_name: customerName,
        customer_document: customerDocument,
        // IMPORTANT: use Shopify's real order date for metrics
        order_date: order.created_at,
        // Keep created_at aligned to the real order date as well (legacy screens still use created_at)
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

    return new Response(JSON.stringify({ success: true, synced: rows.length }), {
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
