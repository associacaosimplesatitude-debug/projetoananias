// Authoritative lead/cliente/vendedor resolver shared by LeadDetailModal and WhatsAppChat list.
// Both single-phone and batch APIs MUST produce identical fields for the same phone.
//
// Priority rules (matched to LeadDetailModal):
//   tipoCliente  = cliente.tipo_cliente  || lead.tipo_lead
//   vendedor (histórico) = lead.vendedores.nome || shopify[0].vendedor.nome
//   vendedor atribuído (somente lista) = agente_ia_conversas.vendedor_atribuido_id
//
import { supabase } from "@/integrations/supabase/client";

export function normalizePhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 12 && digits.startsWith("55")) return digits.slice(2);
  return digits;
}

// Country dial-code rules: prefix + accepted local lengths.
// Order matters: first match wins.
const DDI_RULES: Array<{ ddi: string; localLens: number[] }> = [
  { ddi: "55", localLens: [10, 11] },     // BR
  { ddi: "1", localLens: [10] },          // US/CA
  { ddi: "351", localLens: [9] },         // PT
  { ddi: "44", localLens: [9, 10] },      // UK
  { ddi: "33", localLens: [9] },          // FR
  { ddi: "34", localLens: [9] },          // ES
  { ddi: "39", localLens: [9, 10] },      // IT
  { ddi: "49", localLens: [10, 11] },     // DE
  { ddi: "52", localLens: [10] },         // MX
  { ddi: "54", localLens: [10, 11] },     // AR
];

function addBoth(set: Set<string>, value: string) {
  if (!value) return;
  set.add(value);
  set.add("+" + value);
}

export function generatePhoneVariants(phone: string): string[] {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return [];
  const variants = new Set<string>();

  // Try to detect DDI
  let detected: { ddi: string; local: string } | null = null;
  for (const rule of DDI_RULES) {
    if (digits.startsWith(rule.ddi)) {
      const rest = digits.slice(rule.ddi.length);
      if (rule.localLens.includes(rest.length)) {
        detected = { ddi: rule.ddi, local: rest };
        break;
      }
    }
  }

  if (detected) {
    const { ddi, local } = detected;
    addBoth(variants, ddi + local);
    addBoth(variants, local);

    if (ddi === "55") {
      // BR ninth-digit rule
      if (local.length === 11 && local[2] === "9") {
        const without9 = local.slice(0, 2) + local.slice(3);
        addBoth(variants, without9);
        addBoth(variants, ddi + without9);
      } else if (local.length === 10) {
        const with9 = local.slice(0, 2) + "9" + local.slice(2);
        addBoth(variants, with9);
        addBoth(variants, ddi + with9);
      }
    }
  } else {
    // Unknown DDI — fallback: assume BR sem DDI (back-compat)
    addBoth(variants, digits);
    addBoth(variants, "55" + digits);

    if (digits.length === 11 && digits[2] === "9") {
      const without9 = digits.slice(0, 2) + digits.slice(3);
      addBoth(variants, without9);
      addBoth(variants, "55" + without9);
    } else if (digits.length === 10) {
      const with9 = digits.slice(0, 2) + "9" + digits.slice(2);
      addBoth(variants, with9);
      addBoth(variants, "55" + with9);
    }
  }

  return Array.from(variants);
}

export interface ResolvedLead {
  phone: string; // normalized key
  // Raw rows (for modal extras)
  lead: any | null;
  cliente: any | null;
  pedidos: any[];
  // Computed authoritative fields
  tipoCliente: string | null;
  vendedorHistoricoId: string | null;
  vendedorHistoricoNome: string | null;
  vendedorAtribuidoId: string | null;
  vendedorAtribuidoNome: string | null;
  conversaId: string | null;
  clienteId: string | null;
  nomeResolvido: string | null;
  // Extended fallback fields (lead -> cliente -> shopify)
  emailResolvido: string | null;
  documentoResolvido: string | null;
  vendedorResolvido: { id: string; nome: string } | null;
  pedidoShopify: {
    id: string;
    orderNumber: string;
    valorTotal: number;
    statusPagamento: string;
    createdAt: string;
    codigoRastreio: string | null;
    urlRastreio: string | null;
  } | null;
  ultimoLogin: string | null;
  tipoLead: string | null;
  statusLead: string | null;
  contaCriada: boolean | null;
  fontes: Array<"lead" | "cliente" | "shopify">;
}

function emptyResolved(phone: string): ResolvedLead {
  return {
    phone: normalizePhone(phone),
    lead: null,
    cliente: null,
    pedidos: [],
    tipoCliente: null,
    vendedorHistoricoId: null,
    vendedorHistoricoNome: null,
    vendedorAtribuidoId: null,
    vendedorAtribuidoNome: null,
    conversaId: null,
    clienteId: null,
    nomeResolvido: null,
    emailResolvido: null,
    documentoResolvido: null,
    vendedorResolvido: null,
    pedidoShopify: null,
    ultimoLogin: null,
    tipoLead: null,
    statusLead: null,
    contaCriada: null,
    fontes: [],
  };
}

/**
 * Resolve lead info for many phones in batch. Returns Map keyed by normalized phone.
 * Mirrors LeadDetailModal queries exactly so the list and the modal NEVER diverge.
 */
export async function resolveLeadsByPhones(phones: string[]): Promise<Map<string, ResolvedLead>> {
  const result = new Map<string, ResolvedLead>();
  const normPhones = Array.from(new Set(phones.map(normalizePhone).filter(Boolean)));
  if (normPhones.length === 0) return result;
  normPhones.forEach((p) => result.set(p, emptyResolved(p)));

  // Reverse index variant -> normalized phone (built incrementally per chunk)
  const variantToPhone = new Map<string, string>();

  // Chunking: PostgREST recusa URLs muito longas com 400.
  // Limita 10 telefones (≤ 60 variantes) por chamada.
  const CHUNK_SIZE = 10;
  const phoneChunks: string[][] = [];
  for (let i = 0; i < normPhones.length; i += CHUNK_SIZE) {
    phoneChunks.push(normPhones.slice(i, i + CHUNK_SIZE));
  }

  const allLeads: any[] = [];
  const allClientes: any[] = [];
  const allPedidos: any[] = [];
  const allAic: any[] = [];

  for (const chunk of phoneChunks) {
    const chunkVariants = new Set<string>();
    for (const p of chunk) {
      for (const v of generatePhoneVariants(p)) {
        chunkVariants.add(v);
        if (!variantToPhone.has(v)) variantToPhone.set(v, p);
      }
    }
    const chunkVarArr = Array.from(chunkVariants);

    const [leadsRes, clientesRes, pedidosRes, aicRes] = await Promise.all([
      supabase
        .from("ebd_leads_reativacao")
        .select("*, vendedores(id, nome)")
        .in("telefone", chunkVarArr),
      supabase
        .from("ebd_clientes")
        .select(
          "id, nome_igreja, email_superintendente, telefone, tipo_cliente, cnpj, cpf, senha_temporaria, ultimo_login, onboarding_concluido, data_proxima_compra, vendedor_id, updated_at"
        )
        .in("telefone", chunkVarArr)
        .order("updated_at", { ascending: false }),
      supabase
        .from("ebd_shopify_pedidos")
        .select(
          "id, order_number, customer_name, customer_email, customer_phone, customer_document, valor_total, valor_frete, status_pagamento, created_at, codigo_rastreio, codigo_rastreio_bling, url_rastreio, vendedor_id"
        )
        .in("customer_phone", chunkVarArr)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("agente_ia_conversas")
        .select("id, telefone, cliente_id, vendedor_atribuido_id, ultima_mensagem_em")
        .in("telefone", chunkVarArr)
        .order("ultima_mensagem_em", { ascending: false }),
    ]);

    if (leadsRes.data) allLeads.push(...leadsRes.data);
    if (clientesRes.data) allClientes.push(...clientesRes.data);
    if (pedidosRes.data) allPedidos.push(...pedidosRes.data);
    if (aicRes.data) allAic.push(...aicRes.data);
  }

  // Compat shims for downstream code expecting *.data shape
  const leadsRes = { data: allLeads };
  const clientesRes = { data: allClientes };
  const pedidosRes = { data: allPedidos };
  const aicRes = { data: allAic };

  // Group rows by normalized phone (first match wins for single-row picks)
  const groupBy = <T,>(rows: T[] | null | undefined, getter: (r: T) => string | null) => {
    const m = new Map<string, T[]>();
    (rows || []).forEach((r) => {
      const v = getter(r);
      if (!v) return;
      const key = variantToPhone.get(v);
      if (!key) return;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    });
    return m;
  };
  const leadsByPhone = groupBy(leadsRes.data as any[], (r: any) => r.telefone);
  const clientesByPhone = groupBy(clientesRes.data as any[], (r: any) => r.telefone);
  const pedidosByPhone = groupBy(pedidosRes.data as any[], (r: any) => r.customer_phone);
  const aicByPhone = groupBy(aicRes.data as any[], (r: any) => r.telefone);

  // Collect vendedor ids needing name resolution (atribuído + shopify + cliente.vendedor_id)
  const vendedorIds = new Set<string>();
  aicRes.data?.forEach((r: any) => r.vendedor_atribuido_id && vendedorIds.add(r.vendedor_atribuido_id));
  pedidosRes.data?.forEach((r: any) => r.vendedor_id && vendedorIds.add(r.vendedor_id));
  clientesRes.data?.forEach((r: any) => r.vendedor_id && vendedorIds.add(r.vendedor_id));

  let vendedorById: Record<string, string> = {};
  if (vendedorIds.size > 0) {
    const { data: vrows } = await supabase
      .from("vendedores")
      .select("id, nome")
      .in("id", Array.from(vendedorIds));
    (vrows || []).forEach((v: any) => {
      if (v?.id) vendedorById[v.id] = v.nome || "";
    });
  }

  for (const phone of normPhones) {
    const lead = leadsByPhone.get(phone)?.[0] || null;
    const cliente = clientesByPhone.get(phone)?.[0] || null;
    const pedidos = pedidosByPhone.get(phone) || [];
    const aic = aicByPhone.get(phone)?.[0] || null;

    // tipoCliente: cliente FIRST, lead second (per user requirement)
    const tipoCliente = (cliente?.tipo_cliente as string | null) || (lead?.tipo_lead as string | null) || null;

    // vendedor histórico: literal modal logic = lead.vendedores.nome || shopify[0].vendedor name
    const leadVend = (lead as any)?.vendedores || null;
    const shopVend = pedidos[0]?.vendedor_id || null;
    let vendedorHistoricoId: string | null = null;
    let vendedorHistoricoNome: string | null = null;
    if (leadVend?.id) {
      vendedorHistoricoId = leadVend.id;
      vendedorHistoricoNome = leadVend.nome || null;
    } else if (shopVend) {
      vendedorHistoricoId = shopVend;
      vendedorHistoricoNome = vendedorById[shopVend] || null;
    }

    const vendedorAtribuidoId = aic?.vendedor_atribuido_id || null;
    const vendedorAtribuidoNome = vendedorAtribuidoId ? vendedorById[vendedorAtribuidoId] || null : null;

    const shopifyOrder = pedidos[0] || null;
    const nomeResolvido =
      lead?.nome_igreja ||
      cliente?.nome_igreja ||
      shopifyOrder?.customer_name ||
      null;

    const emailResolvido =
      lead?.email || cliente?.email_superintendente || shopifyOrder?.customer_email || null;
    const documentoResolvido =
      lead?.cnpj || cliente?.cnpj || cliente?.cpf || shopifyOrder?.customer_document || null;

    // vendedorResolvido: lead.vendedores -> cliente.vendedor_id -> shopify.vendedor_id
    let vendedorResolvido: { id: string; nome: string } | null = null;
    if (leadVend?.id) {
      vendedorResolvido = { id: leadVend.id, nome: leadVend.nome || "" };
    } else if (cliente?.vendedor_id) {
      vendedorResolvido = { id: cliente.vendedor_id, nome: vendedorById[cliente.vendedor_id] || "" };
    } else if (shopifyOrder?.vendedor_id) {
      vendedorResolvido = { id: shopifyOrder.vendedor_id, nome: vendedorById[shopifyOrder.vendedor_id] || "" };
    }

    const pedidoShopify = shopifyOrder
      ? {
          id: shopifyOrder.id,
          orderNumber: shopifyOrder.order_number,
          valorTotal: Number(shopifyOrder.valor_total) || 0,
          statusPagamento: shopifyOrder.status_pagamento,
          createdAt: shopifyOrder.created_at,
          codigoRastreio: shopifyOrder.codigo_rastreio || shopifyOrder.codigo_rastreio_bling || null,
          urlRastreio: shopifyOrder.url_rastreio || null,
        }
      : null;

    const ultimoLogin = cliente?.ultimo_login || lead?.ultimo_login_ebd || null;

    const fontes: Array<"lead" | "cliente" | "shopify"> = [];
    if (lead) fontes.push("lead");
    if (cliente) fontes.push("cliente");
    if (shopifyOrder) fontes.push("shopify");

    result.set(phone, {
      phone,
      lead,
      cliente,
      pedidos,
      tipoCliente,
      vendedorHistoricoId,
      vendedorHistoricoNome,
      vendedorAtribuidoId,
      vendedorAtribuidoNome,
      conversaId: aic?.id || null,
      clienteId: aic?.cliente_id || cliente?.id || null,
      nomeResolvido,
      emailResolvido,
      documentoResolvido,
      vendedorResolvido,
      pedidoShopify,
      ultimoLogin,
      tipoLead: lead?.tipo_lead || null,
      statusLead: lead?.status_lead || null,
      contaCriada: lead ? !!lead.conta_criada : null,
      fontes,
    });
  }

  return result;
}

export async function resolveLeadByPhone(phone: string): Promise<ResolvedLead> {
  const map = await resolveLeadsByPhones([phone]);
  return map.get(normalizePhone(phone)) ?? emptyResolved(phone);
}
