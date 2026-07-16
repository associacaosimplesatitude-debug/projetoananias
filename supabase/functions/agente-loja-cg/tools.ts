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
    name: "identificar_pessoa",
    description:
      "Busca uma pessoa em TODAS as fontes do sistema (clientes, licenças digitais, embaixadoras, sorteios, auth.users) por telefone, email ou documento. Use quando precisar identificar OUTRO cliente além do que está atendendo (o cliente atual já vem identificado no system prompt).",
    input_schema: {
      type: "object",
      properties: {
        telefone: { type: "string" },
        email: { type: "string" },
        documento: { type: "string", description: "CPF ou CNPJ" },
      },
    },
  },
  {
    name: "consultar_historico_compras",
    description:
      "Retorna histórico COMPLETO de compras do cliente — Loja CG atual, MP standalone, históricos arquivados Shopify, propostas B2B, marketplace Bling (ML/Shopee/Amazon), e PDV. Use quando cliente perguntar sobre pedidos passados.",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string", description: "UUID do cliente (preferencial)" },
        telefone: { type: "string" },
        email: { type: "string" },
        limite: { type: "integer", default: 10, maximum: 50 },
      },
    },
  },
  {
    name: "consultar_acessos_digital",
    description:
      "Retorna licenças digitais do cliente (Shopify + multi-licença) com revista, status, primeiro/último acesso, e OTPs recentes. Use quando cliente perguntar sobre revista digital, acesso, ou se já comprou produto digital.",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        telefone: { type: "string" },
        email: { type: "string" },
      },
    },
  },
  {
    name: "consultar_disparos_recentes",
    description:
      "Retorna mensagens WhatsApp e emails enviados pelo sistema pra esse contato nos últimos N dias. Use pra ENTENDER o que o cliente recebeu antes de mandar mensagem (ex: cliente recebeu OTP, recebeu template, recebeu campanha de retenção).",
    input_schema: {
      type: "object",
      properties: {
        telefone: { type: "string" },
        email: { type: "string" },
        dias: { type: "integer", default: 7, maximum: 30 },
      },
      required: ["telefone"],
    },
  },
  {
    name: "buscar_catalogo",
    description:
      "Busca produtos por palavras-chave. Encontra revistas físicas + digitais. Busca normalizada (ignora acentos, números com Nº, espaços extras). Aceita termos parciais ('Cartas Prisão' acha 'Revista EBD Cartas da Prisão'). Use apenas_lancamentos=true quando cliente pedir explicitamente MAIS RECENTE / LANÇAMENTO / NOVIDADE.",
    input_schema: {
      type: "object",
      properties: {
        termo: { type: "string" },
        max_resultados: { type: "integer", default: 5, minimum: 1, maximum: 10 },
        apenas_lancamentos: {
          type: "boolean",
          description:
            "true quando o cliente pedir explicitamente a revista/produto MAIS RECENTE, LANÇAMENTO ou NOVIDADE — filtra só itens marcados como lançamento no sistema.",
        },
      },
      required: ["termo"],
    },
  },
  {
    name: "calcular_preco",
    description:
      "Aplica desconto correto pra esse cliente baseado em perfil/categoria. SEMPRE use antes de informar preço a cliente identificado.",
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
    name: "cadastrar_revendedor",
    description:
      "Promove o cliente atual ao perfil REVENDEDOR no cadastro (tipo_cliente='REVENDEDOR'), persistindo CPF/CNPJ se informado. Use SOMENTE quando o cliente AFIRMAR explicitamente que aceita virar Revendedor (ex: 'sim quero', 'gere com 30%', 'prefiro no cpf'). DEPOIS desta tool, IMEDIATAMENTE chame calcular_preco novamente — o desconto Revendedor (Bronze/Prata/Ouro) só aparece após esta atualização. Não promete nada ao cliente antes de chamar — chame e depois confirme com o desconto real.",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string", description: "UUID obrigatório do cliente em ebd_clientes." },
        documento: { type: "string", description: "CPF (11 dígitos) ou CNPJ (14 dígitos), apenas números ou formatado — será normalizado." },
        nome_completo: { type: "string", description: "Opcional. Atualiza nome_responsavel se ainda estiver vazio." },
      },
      required: ["cliente_id"],
    },
  },
  {
    name: "criar_proposta",
    description:
      "Gera proposta de compra com link público de pagamento. SÓ usar após cliente confirmar items + estar identificado.",
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
    name: "reenviar_otp_revista",
    description:
      "Reenvia OTP de acesso a revista digital pro cliente via WhatsApp. Use quando cliente pedir reenvio de acesso a revista digital que ele já comprou (verificou em consultar_acessos_digital).",
    input_schema: {
      type: "object",
      properties: {
        telefone: { type: "string" },
        email: { type: "string" },
        revista_id: { type: "string", description: "Opcional. Se omitido, sistema escolhe a licença mais recente." },
      },
      required: ["telefone"],
    },
  },
  {
    name: "escalar_para_humano",
    description:
      "Escala conversa para vendedor humano. Use APENAS para reembolso, devolução, troca, cancelamento de pedido pago, alteração de NF-e, produto defeituoso, cliente em crise, ou quando cliente pediu humano explicitamente.",
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

// ───────────────────────── HANDLERS ─────────────────────────

const identificar_pessoa: ToolHandler = async (input, supabase) => {
  const { data, error } = await supabase.rpc("identificar_pessoa_unificada", {
    p_telefone: input.telefone || null,
    p_email: input.email || null,
    p_documento: input.documento || null,
  });
  if (error) throw new Error(error.message);
  return data;
};

const consultar_historico_compras: ToolHandler = async (input, supabase) => {
  const { data, error } = await supabase.rpc("historico_compras_completo", {
    p_cliente_id: input.cliente_id || null,
    p_telefone: input.telefone || null,
    p_email: input.email || null,
    p_limite: Math.min(Number(input.limite || 10), 50),
  });
  if (error) throw new Error(error.message);
  return data;
};

const consultar_acessos_digital: ToolHandler = async (input, supabase) => {
  const { data, error } = await supabase.rpc("acessos_revista_digital", {
    p_cliente_id: input.cliente_id || null,
    p_telefone: input.telefone || null,
    p_email: input.email || null,
  });
  if (error) throw new Error(error.message);
  return data;
};

const consultar_disparos_recentes: ToolHandler = async (input, supabase) => {
  const { data, error } = await supabase.rpc("disparos_recebidos", {
    p_telefone: input.telefone,
    p_email: input.email || null,
    p_dias: Math.min(Number(input.dias || 7), 30),
  });
  if (error) throw new Error(error.message);
  return data;
};

const NOVA_LOJA_CATALOGO_URL =
  "https://otynmnmazarsrddvxvmy.supabase.co/functions/v1/catalogo-publico";

function normalizarBusca(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // separa letra grudada em número (n10 -> n 10) pra bater com "Nº 10" (normalizado vira "no 10")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Se termo veio como URL/link de produto, extrai só o slug legível.
function extrairSlugDeUrl(termo: string): string {
  const t = String(termo || "").trim();
  const pareceUrl =
    /^https?:\/\//i.test(t) ||
    t.includes("centralgospel.com.br/produto/") ||
    t.includes("/produto/");
  if (!pareceUrl) return t;

  // pega o trecho depois de /produto/
  let slug = t;
  const idx = t.indexOf("/produto/");
  if (idx >= 0) slug = t.slice(idx + "/produto/".length);
  else {
    // fallback: tira protocolo e domínio
    slug = t.replace(/^https?:\/\/[^/]+\//i, "");
  }
  // remove query string e âncora
  slug = slug.split("?")[0].split("#")[0];
  // pega só o primeiro segmento (o slug do produto)
  slug = slug.split("/")[0] || slug;
  // remove sufixo numérico longo tipo -1783082755087 (ID interno da loja)
  slug = slug.replace(/[-_]\d{6,}$/g, "");
  // troca - e _ por espaço
  slug = slug.replace(/[-_]+/g, " ").trim();
  return slug || t;
}

const buscar_catalogo: ToolHandler = async (input) => {
  const max = Math.min(Number(input.max_resultados || 5), 10);
  const termoRaw = String(input.termo || "");
  const termoLimpo = extrairSlugDeUrl(termoRaw);
  const termoNorm = normalizarBusca(termoLimpo);
  const tokens = termoNorm.split(" ").filter((t) => t.length >= 2);

  let products: any[] = [];
  const erros: string[] = [];
  try {
    const url = termoLimpo
      ? `${NOVA_LOJA_CATALOGO_URL}?q=${encodeURIComponent(termoLimpo)}`
      : NOVA_LOJA_CATALOGO_URL;
    const res = await fetch(url);
    if (res.ok) {
      const raw = await res.json();
      products = Array.isArray(raw) ? raw : (raw?.products || []);
    } else {
      erros.push(`catalogo HTTP ${res.status}`);
    }
  } catch (e: any) {
    erros.push(`catalogo: ${e?.message || e}`);
  }

  // Pontuação: conta tokens que batem no título/SKU. Requer pelo menos
  // max(2, ~50% dos tokens) — em vez de exigir 100% (que quebra links longos).
  const minMatches = Math.max(2, Math.ceil(tokens.length * 0.5));
  const scored = products
    .map((p) => {
      const haystack = normalizarBusca(`${p.title || ""} ${p.sku || ""}`);
      const matched = tokens.filter((t) => haystack.includes(t)).length;
      return { p, matched };
    })
    .filter((x) => tokens.length === 0 || x.matched >= Math.min(minMatches, tokens.length))
    .sort((a, b) => b.matched - a.matched);

  const filtrados = scored.map((x) => x.p);

  // Itens prontos pra usar em criar_proposta (variantId no formato canônico)
  const items = filtrados.slice(0, max).map((p) => ({
    fonte: "nova_loja",
    variantId: `nova-loja-variant-${p.id}`,
    id: p.id,
    title: p.title,
    titulo: p.title,
    sku: p.sku || null,
    price: Number(p.price || 0),
    preco: Number(p.price || 0),
    imageUrl: p.image || null,
    imagem_url: p.image || null,
    estoque: typeof p.stock === "number" ? p.stock : null,
    disponivel: p.available ?? null,
    is_digital: !!p.is_digital,
  }));

  return {
    items,
    total_encontrados: items.length,
    fontes_consultadas: ["nova_loja"],
    termo_normalizado: termoNorm,
    erros,
  };
};


const calcular_preco: ToolHandler = async (input, supabase) => {
  const { data, error } = await supabase.rpc("calcular_preco_para_cliente", {
    p_cliente_id: input.cliente_id,
    p_items: input.items,
  });
  if (error) throw new Error(error.message);
  return data;
};

const cadastrar_revendedor: ToolHandler = async (input, supabase, ctx) => {
  const cliente_id = input.cliente_id || ctx.cliente_id;
  if (!cliente_id) {
    throw new Error("cliente_id obrigatório — cliente precisa estar identificado antes de virar Revendedor.");
  }

  const docDigits = String(input.documento || "").replace(/\D/g, "");
  let cpf: string | null = null;
  let cnpj: string | null = null;
  if (docDigits.length === 11) cpf = docDigits;
  else if (docDigits.length === 14) cnpj = docDigits;
  else if (docDigits.length > 0) {
    throw new Error(`Documento inválido (${docDigits.length} dígitos). CPF=11, CNPJ=14.`);
  }

  // Buscar estado atual pra não sobrescrever campos preenchidos
  const { data: atual, error: errGet } = await supabase
    .from("ebd_clientes")
    .select("id, tipo_cliente, cpf, cnpj, nome_responsavel")
    .eq("id", cliente_id)
    .maybeSingle();
  if (errGet) throw new Error(`Erro ao buscar cliente: ${errGet.message}`);
  if (!atual) throw new Error(`Cliente ${cliente_id} não encontrado em ebd_clientes.`);

  const updates: Record<string, any> = {
    tipo_cliente: "REVENDEDOR",
    updated_at: new Date().toISOString(),
  };
  if (cpf && !atual.cpf) updates.cpf = cpf;
  if (cnpj && !atual.cnpj) updates.cnpj = cnpj;
  if (input.nome_completo && !atual.nome_responsavel) {
    updates.nome_responsavel = String(input.nome_completo).trim();
  }

  const { error: updErr } = await supabase
    .from("ebd_clientes")
    .update(updates)
    .eq("id", cliente_id);
  if (updErr) throw new Error(`Erro ao atualizar cadastro: ${updErr.message}`);

  return {
    sucesso: true,
    cliente_id,
    tipo_cliente_anterior: atual.tipo_cliente || null,
    tipo_cliente_atual: "REVENDEDOR",
    documento_persistido: cpf ? { tipo: "CPF", valor: cpf } : cnpj ? { tipo: "CNPJ", valor: cnpj } : null,
    mensagem_para_agente:
      "Cliente promovido a Revendedor no banco. AGORA chame calcular_preco novamente com os mesmos items para obter o desconto Bronze/Prata/Ouro real, e SÓ ENTÃO chame criar_proposta.",
  };
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

const reenviar_otp_revista: ToolHandler = async (input, supabase) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/revista-solicitar-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({
      whatsapp: input.telefone,
      email: input.email,
      revista_id: input.revista_id,
    }),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(json?.erro || json?.error || `revista-solicitar-otp retornou ${resp.status}`);
  }
  return {
    enviado: true,
    canal: "whatsapp",
    detalhes: json,
    mensagem_para_agente:
      "OTP enviado pro WhatsApp do cliente. Diga ao cliente pra verificar e usar o código pra acessar.",
  };
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

  // NÃO marca conversa como 'escalada' — escalação é só notificação ao vendedor.
  // Agente continua respondendo até vendedor pausar manualmente via UI.

  const nome = vendedorAlvo?.nome || "um atendente";
  return {
    escalation_id: esc.id,
    vendedor_nome: vendedorAlvo?.nome || null,
    prioridade: input.prioridade || "normal",
    mensagem_para_cliente: `Vou pedir pra ${nome} te chamar por aqui em instantes. 🙏`,
  };
};

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  identificar_pessoa,
  consultar_historico_compras,
  consultar_acessos_digital,
  consultar_disparos_recentes,
  buscar_catalogo,
  calcular_preco,
  cadastrar_revendedor,
  criar_proposta,
  reenviar_otp_revista,
  escalar_para_humano,
};

// Export utilitário (não usado pelo loop, mas mantido para outros callers internos)
export { gerarVariantes };
