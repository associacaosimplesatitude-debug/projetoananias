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

export function generatePhoneVariants(phone: string): string[] {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return [];
  const variants = new Set<string>();
  variants.add(digits);

  let local = digits;
  if (digits.length >= 12 && digits.startsWith("55")) {
    local = digits.slice(2);
    variants.add(local);
  }
  if (!digits.startsWith("55") && (local.length === 10 || local.length === 11)) {
    variants.add("55" + local);
  }
  if (local.length === 10) {
    const with9 = local.slice(0, 2) + "9" + local.slice(2);
    variants.add(with9);
    variants.add("55" + with9);
  }
  if (local.length === 11 && local[2] === "9") {
    const without9 = local.slice(0, 2) + local.slice(3);
    variants.add(without9);
    variants.add("55" + without9);
  }
  Array.from(variants)
    .filter((v) => v.startsWith("55"))
    .forEach((v) => variants.add("+" + v));

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

  // Collect vendedor ids needing name resolution (atribuído + shopify[0])
  const vendedorIds = new Set<string>();
  aicRes.data?.forEach((r: any) => r.vendedor_atribuido_id && vendedorIds.add(r.vendedor_atribuido_id));
  pedidosRes.data?.forEach((r: any) => r.vendedor_id && vendedorIds.add(r.vendedor_id));

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
    });
  }

  return result;
}

export async function resolveLeadByPhone(phone: string): Promise<ResolvedLead> {
  const map = await resolveLeadsByPhones([phone]);
  return map.get(normalizePhone(phone)) ?? emptyResolved(phone);
}
