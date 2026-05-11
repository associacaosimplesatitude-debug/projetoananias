import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOVA_LOJA_CATALOGO_URL =
  "https://otynmnmazarsrddvxvmy.supabase.co/functions/v1/catalogo-publico";

interface AgenteItem {
  variantId?: string;
  title?: string;
  price?: number | string;
  quantity: number;
  imageUrl?: string;
  sku?: string;
}

interface Payload {
  cliente_id: string;
  items: AgenteItem[];
  frete_tipo?: "automatico" | "manual" | null;
  frete_valor?: number;
  metodo_frete?: string | null;
  observacoes?: string;
}

interface NovaLojaProduct {
  id: string;
  title: string;
  sku: string;
  price: number | string;
  image?: string | null;
  is_digital?: boolean;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Normaliza variantId pra extrair id base (sem prefixo)
function extractBaseId(variantId?: string): string | null {
  if (!variantId) return null;
  const trimmed = String(variantId).trim();
  if (trimmed.startsWith("nova-loja-variant-")) {
    return trimmed.replace("nova-loja-variant-", "");
  }
  // Se for gid Shopify legado, ignora — não conseguimos resolver
  if (trimmed.startsWith("gid://")) return null;
  return trimmed;
}

async function fetchCatalogo(): Promise<NovaLojaProduct[]> {
  try {
    const res = await fetch(NOVA_LOJA_CATALOGO_URL);
    if (!res.ok) return [];
    const raw = await res.json();
    return Array.isArray(raw) ? raw : (raw?.products || []);
  } catch (e) {
    console.error("[agente-criar-proposta] catalogo fetch error", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ") || auth.replace("Bearer ", "").trim() !== SERVICE_KEY) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const payload = (await req.json()) as Payload;
    if (!payload?.cliente_id || !Array.isArray(payload.items) || payload.items.length === 0) {
      return jsonResponse({ error: "cliente_id e items são obrigatórios" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Cliente — todos os campos que o vendedor preenche
    const { data: cliente, error: clienteErr } = await supabase
      .from("ebd_clientes")
      .select(
        "id, nome_igreja, cnpj, cpf, telefone, email_superintendente, pode_faturar, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep",
      )
      .eq("id", payload.cliente_id)
      .maybeSingle();
    if (clienteErr || !cliente) return jsonResponse({ error: "Cliente não encontrado" }, 404);

    // 2. Vendedor virtual ID (com parsing defensivo)
    const { data: setting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "agente_ia_vendedor_id")
      .maybeSingle();
    let vendedorId: any = setting?.value;
    if (typeof vendedorId === "string") {
      const trimmed = vendedorId.trim();
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        try { vendedorId = JSON.parse(trimmed); } catch { vendedorId = trimmed.slice(1, -1); }
      } else {
        vendedorId = trimmed;
      }
    }
    if (!vendedorId || typeof vendedorId !== "string") {
      return jsonResponse({ error: "agente_ia_vendedor_id não configurado" }, 500);
    }

    // 3. Catálogo Nova Loja para enriquecer items (sku, imagem, price canônico)
    const catalogo = await fetchCatalogo();
    const byId = new Map<string, NovaLojaProduct>();
    const bySku = new Map<string, NovaLojaProduct>();
    const byTitleLower = new Map<string, NovaLojaProduct>();
    catalogo.forEach((p) => {
      byId.set(p.id, p);
      if (p.sku) bySku.set(String(p.sku), p);
      if (p.title) byTitleLower.set(p.title.toLowerCase().trim(), p);
    });

    // Enriquece cada item com dados canônicos do catálogo
    const itemsEnriquecidos = payload.items.map((it) => {
      const baseId = extractBaseId(it.variantId);
      let prod: NovaLojaProduct | undefined =
        (baseId && byId.get(baseId)) ||
        (it.sku && bySku.get(String(it.sku))) ||
        (it.title && byTitleLower.get(it.title.toLowerCase().trim())) ||
        undefined;

      const resolvedId = prod?.id || baseId || (it.variantId || "").toString();
      const variantId = `nova-loja-variant-${resolvedId}`;
      const title = prod?.title || it.title || "Produto";
      const priceNum = prod?.price != null ? Number(prod.price) : Number(it.price || 0);
      const sku = prod?.sku || it.sku || null;
      const imageUrl = prod?.image || it.imageUrl || null;

      return {
        variantId,
        title,
        price: priceNum,
        quantity: Number(it.quantity || 1),
        sku,
        imageUrl,
      };
    });

    // 4. RPC de preço com items enriquecidos (price em number p/ a RPC)
    const { data: precoData, error: precoErr } = await supabase.rpc("calcular_preco_para_cliente", {
      p_cliente_id: payload.cliente_id,
      p_items: itemsEnriquecidos.map((it) => ({
        variantId: it.variantId,
        title: it.title,
        price: it.price,
        quantity: it.quantity,
      })),
    });
    if (precoErr) return jsonResponse({ error: "Erro no cálculo de preço", detalhe: precoErr.message }, 500);

    const subtotal = Number(precoData?.subtotal || 0);
    const totalProdutos = Number(precoData?.total_produtos || 0);
    const descontoAplicado = Number(precoData?.desconto_aplicado || 0);
    const regraAplicada = String(precoData?.regra_aplicada || "Sem desconto");
    const itemsCalc: any[] = Array.isArray(precoData?.items_calculados) ? precoData.items_calculados : [];

    const itemsByVariant = new Map<string, any>();
    itemsCalc.forEach((c) => itemsByVariant.set(String(c.variantId), c));

    // 5. Items JSONB no formato EXATO da proposta do vendedor
    //    (price como string, todos os campos enriquecidos, descontoItem, categoria)
    const itensJson = itemsEnriquecidos.map((it) => {
      const calc = itemsByVariant.get(it.variantId);
      return {
        variantId: it.variantId,
        title: it.title,
        price: String(it.price), // STRING (parseFloat na PropostaDigital)
        quantity: it.quantity,
        sku: it.sku,
        imageUrl: it.imageUrl,
        descontoItem: calc ? Number(calc.desconto_percentual_item || 0) : 0,
        categoria: calc?.categoria || "Outros Produtos",
      };
    });

    const freteValor = Number(payload.frete_valor || 0);
    const valorTotal = totalProdutos + freteValor;
    const descontoPctConsolidado = subtotal > 0 ? Math.round((descontoAplicado / subtotal) * 10000) / 100 : 0;

    // 6. Endereço jsonb (mesmo shape do vendedor)
    const enderecoJson = {
      rua: cliente.endereco_rua || "",
      numero: cliente.endereco_numero || "",
      complemento: cliente.endereco_complemento || "",
      bairro: cliente.endereco_bairro || "",
      cidade: cliente.endereco_cidade || "",
      estado: cliente.endereco_estado || "",
      cep: cliente.endereco_cep || "",
    };

    const token = crypto.randomUUID();
    const podeFaturar = !!cliente.pode_faturar;

    // 7. INSERT proposta — campos espelhando o do vendedor
    //    valor_produtos = subtotal SEM desconto (igual o vendedor faz)
    const { data: proposta, error: insertErr } = await supabase
      .from("vendedor_propostas")
      .insert({
        vendedor_id: vendedorId,
        vendedor_nome: "Agente IA Central Gospel",
        vendedor_email: "agente-ia@centralgospel.com.br",
        cliente_id: cliente.id,
        cliente_nome: cliente.nome_igreja,
        cliente_cnpj: cliente.cnpj || cliente.cpf,
        cliente_endereco: enderecoJson,
        itens: itensJson,
        valor_produtos: subtotal,
        valor_frete: freteValor,
        valor_total: valorTotal,
        desconto_percentual: descontoPctConsolidado,
        status: "PROPOSTA_PENDENTE",
        token,
        metodo_frete: payload.metodo_frete || null,
        frete_tipo: payload.frete_tipo || "automatico",
        pode_faturar: podeFaturar,
        prazos_disponiveis: podeFaturar ? ["30", "60", "90"] : null,
        origem_venda: "agente_ia",
      })
      .select("id, token")
      .single();

    if (insertErr || !proposta) {
      console.error("[agente-criar-proposta] insert error", insertErr);
      return jsonResponse({ error: "Falha ao criar proposta", detalhe: insertErr?.message }, 500);
    }

    return jsonResponse({
      success: true,
      proposta_id: proposta.id,
      token: proposta.token,
      link: `https://gestaoebd.com.br/proposta/${proposta.token}`,
      resumo: {
        subtotal,
        desconto: descontoAplicado,
        regra_aplicada: regraAplicada,
        frete: freteValor,
        total: valorTotal,
      },
    });
  } catch (err: any) {
    console.error("[agente-criar-proposta] erro inesperado", err);
    return jsonResponse({ error: "Erro interno", detalhe: err?.message || String(err) }, 500);
  }
});
