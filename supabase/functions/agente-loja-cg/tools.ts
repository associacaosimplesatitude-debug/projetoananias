import { gerarVariantes } from "./phone-utils.ts";

export interface ContextoConversa {
  conversa_id: string;
  cliente_id: string | null;
  telefone: string;
}

export type ToolHandler = (
  input: any,
  supabase: any,
  ctx: ContextoConversa,
) => Promise<any>;

// ───────────────────────── TOOL SCHEMAS ─────────────────────────
export const TOOL_SCHEMAS = [
  {
    name: "identificar_cliente",
    description:
      "Busca cliente no banco pelo telefone. Retorna dados básicos + tipo_cliente + se pode_faturar. Se não encontrar, retorna { found: false }.",
    input_schema: {
      type: "object",
      properties: {
        telefone: { type: "string", description: "Telefone em qualquer formato" },
      },
      required: ["telefone"],
    },
  },
  {
    name: "buscar_catalogo",
    description: "Busca produtos por termo. Filtrável por tipo. Retorna lista com sku, título, preço, imagem e fonte.",
    input_schema: {
      type: "object",
      properties: {
        termo: { type: "string" },
        tipo: {
          type: "string",
          enum: ["revista_ebd", "produto_digital", "fisico_bling", "todos"],
          default: "todos",
        },
        max_resultados: { type: "integer", default: 5, minimum: 1, maximum: 10 },
      },
      required: ["termo"],
    },
  },
  {
    name: "calcular_preco",
    description: "Aplica descontos do cliente. SEMPRE usar antes de informar preço a cliente identificado.",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              variantId: { type: "string" },
              title: { type: "string" },
              price: { type: "number" },
              quantity: { type: "integer" },
            },
            required: ["variantId", "title", "price", "quantity"],
          },
        },
      },
      required: ["cliente_id", "items"],
    },
  },
  {
    name: "criar_proposta",
    description:
      "Gera proposta no sistema, retorna link público para o cliente aprovar e pagar. SÓ usar após cliente confirmar items + estar identificado.",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        items: { type: "array" },
        frete_tipo: { type: "string", enum: ["automatico", "manual"], default: "automatico" },
        observacoes: { type: "string" },
      },
      required: ["cliente_id", "items"],
    },
  },
  {
    name: "consultar_pedidos_cliente",
    description: "Histórico de pedidos do cliente em pedidos_cliente_360.",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        limite: { type: "integer", default: 5, minimum: 1, maximum: 20 },
      },
      required: ["cliente_id"],
    },
  },
  {
    name: "escalar_para_humano",
    description:
      "Escala para vendedor humano. Use para reembolso, devolução, problema sério ou quando o cliente pediu humano.",
    input_schema: {
      type: "object",
      properties: {
        motivo: {
          type: "string",
          enum: [
            "cliente_solicitou_humano",
            "reembolso_devolucao_troca",
            "produto_defeituoso",
            "cancelamento_pedido_pago",
            "alteracao_nfe",
            "cliente_emocional",
            "fora_de_escopo",
            "outro",
          ],
        },
        detalhes: { type: "string" },
        prioridade: { type: "string", enum: ["baixa", "normal", "alta", "urgente"], default: "normal" },
      },
      required: ["motivo", "detalhes"],
    },
  },
];

// ───────────────────────── IMPLEMENTAÇÕES ─────────────────────────

const identificar_cliente: ToolHandler = async (input, supabase, ctx) => {
  const variantes = gerarVariantes(input.telefone);
  if (variantes.length === 0) return { found: false };

  const { data: cliente } = await supabase
    .from("ebd_clientes")
    .select(
      "id, nome_igreja, nome_superintendente, nome_responsavel, tipo_cliente, pode_faturar, vendedor_id, cnpj, cpf, email_superintendente, endereco_cidade, endereco_estado",
    )
    .in("telefone", variantes)
    .limit(1)
    .maybeSingle();

  if (!cliente) return { found: false };

  await supabase.from("agente_ia_conversas").update({ cliente_id: cliente.id }).eq("id", ctx.conversa_id);
  ctx.cliente_id = cliente.id;

  const { data: ultimo } = await supabase
    .from("pedidos_cliente_360")
    .select("data_pedido, valor_total")
    .eq("cliente_id", cliente.id)
    .order("data_pedido", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: totalPedidos } = await supabase
    .from("pedidos_cliente_360")
    .select("*", { count: "exact", head: true })
    .eq("cliente_id", cliente.id);

  return {
    found: true,
    cliente_id: cliente.id,
    nome_igreja: cliente.nome_igreja,
    tipo_cliente: cliente.tipo_cliente,
    pode_faturar: cliente.pode_faturar,
    vendedor_id: cliente.vendedor_id,
    cidade: cliente.endereco_cidade,
    estado: cliente.endereco_estado,
    ultimo_pedido_em: ultimo?.data_pedido || null,
    ultimo_valor: ultimo?.valor_total || null,
    total_pedidos: totalPedidos || 0,
  };
};

const buscar_catalogo: ToolHandler = async (input, supabase) => {
  const termo = String(input.termo || "").trim();
  const tipo = input.tipo || "todos";
  const max = Math.min(Number(input.max_resultados || 5), 10);
  const items: any[] = [];

  if (tipo === "revista_ebd" || tipo === "todos") {
    const { data } = await supabase
      .from("ebd_revistas")
      .select("id, titulo, preco_cheio, imagem_url, sku_bling, estoque, categoria")
      .or(`titulo.ilike.%${termo}%,descricao.ilike.%${termo}%`)
      .limit(max);
    (data || []).forEach((r: any) =>
      items.push({
        variantId: r.id,
        title: r.titulo,
        price: Number(r.preco_cheio || 0),
        imageUrl: r.imagem_url,
        sku: r.sku_bling,
        fonte: "revista_ebd",
        estoque: r.estoque,
        categoria: r.categoria,
      }),
    );
  }

  if (tipo === "produto_digital" || tipo === "todos") {
    const { data } = await supabase
      .from("revistas_digitais")
      .select("id, titulo, preco, capa_url, tipo_conteudo")
      .ilike("titulo", `%${termo}%`)
      .limit(max);
    (data || []).forEach((r: any) =>
      items.push({
        variantId: r.id,
        title: r.titulo,
        price: Number(r.preco || 0),
        imageUrl: r.capa_url,
        sku: null,
        fonte: "digital",
        estoque: null,
        categoria: r.tipo_conteudo,
      }),
    );
  }

  if (tipo === "fisico_bling" || tipo === "todos") {
    try {
      const { data } = await supabase.functions.invoke("bling-search-product", {
        body: { query: termo },
      });
      const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      arr.slice(0, max).forEach((r: any) =>
        items.push({
          variantId: String(r.id || r.variantId),
          title: r.nome || r.title,
          price: Number(r.preco || r.price || 0),
          imageUrl: r.imagem || r.imageUrl || null,
          sku: r.codigo || r.sku || null,
          fonte: "bling",
          estoque: r.estoque ?? null,
        }),
      );
    } catch (e) {
      console.error("[agente-loja-cg] bling-search-product falhou", e);
    }
  }

  const limited = items.slice(0, max);
  return { items: limited, total_encontrados: items.length };
};

const calcular_preco: ToolHandler = async (input, supabase) => {
  const { data, error } = await supabase.rpc("calcular_preco_para_cliente", {
    p_cliente_id: input.cliente_id,
    p_items: input.items,
  });
  if (error) throw new Error(error.message);
  return data;
};

const criar_proposta: ToolHandler = async (input, supabase, ctx) => {
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/agente-criar-proposta`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      cliente_id: input.cliente_id,
      items: input.items,
      frete_tipo: input.frete_tipo || "automatico",
      observacoes: input.observacoes || undefined,
    }),
  });

  const json = await resp.json();
  if (!resp.ok || !json?.success) {
    throw new Error(json?.error || `agente-criar-proposta retornou ${resp.status}`);
  }

  await supabase
    .from("agente_ia_conversas")
    .update({ proposta_id: json.proposta_id })
    .eq("id", ctx.conversa_id);

  return {
    proposta_id: json.proposta_id,
    token: json.token,
    link: json.link,
    resumo: json.resumo,
  };
};

const consultar_pedidos_cliente: ToolHandler = async (input, supabase) => {
  const limite = Math.min(Number(input.limite || 5), 20);
  const { data, error } = await supabase
    .from("pedidos_cliente_360")
    .select("numero_pedido, status, valor_total, data_pedido, codigo_rastreio, origem, arquivado")
    .eq("cliente_id", input.cliente_id)
    .order("data_pedido", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return { pedidos: data || [], total_encontrados: (data || []).length };
};

const escalar_para_humano: ToolHandler = async (input, supabase, ctx) => {
  let vendedorAlvo: { id: string; nome: string } | null = null;

  if (ctx.cliente_id) {
    const { data: cli } = await supabase
      .from("ebd_clientes")
      .select("vendedor_id, vendedores:vendedor_id (id, nome)")
      .eq("id", ctx.cliente_id)
      .maybeSingle();
    if (cli?.vendedores) vendedorAlvo = { id: cli.vendedores.id, nome: cli.vendedores.nome };
  }

  if (!vendedorAlvo) {
    const { data: fb } = await supabase
      .from("vendedores")
      .select("id, nome")
      .ilike("nome", "%Elielson%")
      .eq("status", "Ativo")
      .limit(1)
      .maybeSingle();
    if (fb) vendedorAlvo = { id: fb.id, nome: fb.nome };
  }

  const { data: esc, error } = await supabase
    .from("agente_ia_escalations")
    .insert({
      conversa_id: ctx.conversa_id,
      cliente_id: ctx.cliente_id,
      vendedor_alvo_id: vendedorAlvo?.id || null,
      motivo: input.motivo,
      detalhes: input.detalhes,
      prioridade: input.prioridade || "normal",
      status: "aberta",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("agente_ia_conversas").update({ status: "escalada" }).eq("id", ctx.conversa_id);

  const nome = vendedorAlvo?.nome || "um atendente";
  return {
    escalation_id: esc.id,
    vendedor_nome: vendedorAlvo?.nome || null,
    prioridade: input.prioridade || "normal",
    mensagem_para_cliente: `Vou pedir pra ${nome} te chamar por aqui em instantes. 🙏`,
  };
};

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  identificar_cliente,
  buscar_catalogo,
  calcular_preco,
  criar_proposta,
  consultar_pedidos_cliente,
  escalar_para_humano,
};
