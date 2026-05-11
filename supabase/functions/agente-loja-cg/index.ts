import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SYSTEM_PROMPT } from "./skill.ts";
import { TOOL_HANDLERS, TOOL_SCHEMAS, type ContextoConversa } from "./tools.ts";
import { calcularCustoUsd } from "./cost.ts";
import { gerarVariantes, normalizarTelefone } from "./phone-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-sonnet-4-5-20250929";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_LOOPS = 10;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function log(msg: string, extra?: unknown) {
  if (extra !== undefined) console.log(`[agente-loja-cg] ${msg}`, extra);
  else console.log(`[agente-loja-cg] ${msg}`);
}

type DadosCadastroAtuais = {
  origem: "cliente" | "lead";
  primeiroNome: string;
  nome: string;
  igreja: string;
  email: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
};

function normalizarTextoBusca(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Guardrail anti-alucinação de link de proposta.
 * Bloqueia respostas que contenham UUID de proposta que não tenha vindo
 * de uma chamada criar_proposta REAL feita neste mesmo turno.
 */
function validarLinksProposta(
  texto: string,
  toolCallsTurno: Array<{ name: string; output: any }>,
): { ok: true } | { ok: false; uuids_invalidos: string[]; uuids_validos: string[] } {
  const regex = /gestaoebd\.com\.br\/proposta\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi;
  const matches = [...(texto || "").matchAll(regex)];
  if (matches.length === 0) return { ok: true };

  const uuidsNoTexto = matches.map((m) => m[1].toLowerCase());

  const uuidsValidos: string[] = [];
  for (const tc of toolCallsTurno) {
    if (tc.name !== "criar_proposta") continue;
    const link = String(tc.output?.link || "");
    const propId = String(tc.output?.proposta_id || "");
    const tok = String(tc.output?.token || "");
    const m = link.match(/proposta\/([a-f0-9-]{36})/i);
    if (m) uuidsValidos.push(m[1].toLowerCase());
    if (propId) uuidsValidos.push(propId.toLowerCase());
    if (tok) uuidsValidos.push(tok.toLowerCase());
  }

  const invalidos = uuidsNoTexto.filter((u) => !uuidsValidos.includes(u));
  if (invalidos.length > 0) {
    return { ok: false, uuids_invalidos: invalidos, uuids_validos: uuidsValidos };
  }
  return { ok: true };
}

function formatarTelefoneWhatsapp(input: string): string {
  const d = normalizarTelefone(input || "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return input || "—";
}

function formatarCep(input: string): string {
  const d = (input || "").replace(/\D/g, "");
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return input || "—";
}

// ─── Interceptação determinística de confirmação de cotação ───
// Detecta se a mensagem do user é uma confirmação curta ("sim", "pode", "gere o link" etc.)
// E se houve uma cotação recente nas últimas mensagens do assistant.
function detectarConfirmacaoCotacao(
  mensagemUser: string,
  ultimasMensagensAssistant: string[],
): boolean {
  const userNorm = (mensagemUser || "").toLowerCase().trim().replace(/[!.?,;:]+$/g, "");
  if (!userNorm) return false;

  const confirmacoes = [
    "sim", "sim pode", "sim, pode", "sim quero", "sim, quero", "sim, gere o link", "sim gere o link",
    "pode", "pode gerar", "pode mandar", "pode sim", "pode ser", "pode fechar",
    "gere", "gera", "gere o link", "gera o link", "gerar link", "gera link",
    "manda", "manda o link", "mande o link", "mande", "me manda o link", "me manda",
    "fecha", "fechou", "fechado", "vamos", "vamos lá",
    "ok", "okay", "ta bom", "tá bom", "beleza", "blz",
    "isso", "perfeito", "isso mesmo", "exato",
    "envia", "envia o link", "envie o link", "me envia o link", "me envia",
    "quero o link", "quero o link de pagamento", "quero sim", "quero",
    "confirmo", "confirmado",
  ];

  const isConfirm = confirmacoes.some(
    (c) => userNorm === c || userNorm.startsWith(c + " ") || userNorm.endsWith(" " + c) || userNorm.includes(" " + c + " "),
  );
  if (!isConfirm) return false;

  const palavrasChaveCotacao = [
    "subtotal", "total dos produtos", "posso gerar o link", "posso gerar",
    "vou gerar o link", "resumo do pedido", "cotação", "valor total",
    "então fechando", "fechando:",
  ];
  return ultimasMensagensAssistant.some((msg) => {
    const m = (msg || "").toLowerCase();
    return palavrasChaveCotacao.some((p) => m.includes(p));
  });
}

// Recupera os items da última cotação real (calcular_preco) DESDE QUE
// tenha ocorrido APÓS a penúltima mensagem do user (i.e., no mesmo turno
// que produziu a cotação que está sendo confirmada agora).
async function recuperarItemsDaCotacao(
  supabase: any,
  conversaId: string,
): Promise<{ items: any[]; cliente_id: string | null } | null> {
  // Penúltima user msg (a atual já foi inserida; queremos a anterior).
  const { data: users } = await supabase
    .from("agente_ia_mensagens")
    .select("created_at")
    .eq("conversa_id", conversaId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(2);
  const previousUserAt =
    users && users.length >= 2 ? new Date(users[1].created_at).getTime() : null;

  const { data: ultimoCalc } = await supabase
    .from("agente_ia_mensagens")
    .select("tool_input, created_at")
    .eq("conversa_id", conversaId)
    .eq("tool_name", "calcular_preco")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ultimoCalc) return null;

  const calcAt = new Date(ultimoCalc.created_at).getTime();
  if (Date.now() - calcAt > 20 * 60 * 1000) return null;
  // Calc precisa ser do mesmo turno da cotação confirmada
  if (previousUserAt && calcAt < previousUserAt) return null;

  const input = ultimoCalc.tool_input || {};
  const items = Array.isArray(input.items) ? input.items : [];
  return { items, cliente_id: input.cliente_id || null };
}

function ehPedidoDadosCadastrais(input: string): boolean {
  const t = normalizarTextoBusca(input);
  return [
    "meus dados",
    "meu cadastro",
    "dados cadastrais",
    "dados do cadastro",
    "confira meus dados",
    "confere meus dados",
    "veja meus dados",
    "verifique meus dados",
    "verifica meus dados",
    "qual meu endereco",
    "qual meu telefone",
    "qual meu email",
  ].some((termo) => t.includes(termo));
}

function montarRespostaDadosCadastrais(dados: DadosCadastroAtuais | null, telefoneFallback: string): string {
  if (!dados) {
    return [
      "Conferi seu contato no sistema neste momento, mas ainda não encontrei um cadastro completo vinculado a este número.",
      "",
      `- **Telefone informado:** ${formatarTelefoneWhatsapp(telefoneFallback)}`,
      "- **Status:** contato ainda não localizado no cadastro principal",
    ].join("\n");
  }

  const intro = dados.primeiroNome && dados.primeiroNome !== "—"
    ? `${dados.primeiroNome}, estes são os dados atuais do seu cadastro no sistema:`
    : "Estes são os dados atuais do seu cadastro no sistema:";

  return [
    intro,
    "",
    `- **Nome:** ${dados.nome || "—"}`,
    `- **Igreja:** ${dados.igreja || "—"}`,
    `- **Email:** ${dados.email || "—"}`,
    `- **Telefone:** ${formatarTelefoneWhatsapp(dados.telefone)}`,
    `- **Endereço:** ${dados.endereco || "—"}`,
    `- **Cidade/UF:** ${dados.cidade || "—"} - ${dados.estado || "—"}`,
    `- **CEP:** ${formatarCep(dados.cep)}`,
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY_LOJA");
    if (!ANTHROPIC_KEY) return jsonResponse({ error: "ANTHROPIC_API_KEY_LOJA não configurada" }, 500);

    // Auth: somente Service Role
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ") || auth.replace("Bearer ", "").trim() !== SERVICE_KEY) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const telefoneRaw: string = body?.telefone;
    const mensagemUser: string = body?.mensagem_user;
    if (!telefoneRaw || !mensagemUser) {
      return jsonResponse({ error: "telefone e mensagem_user são obrigatórios" }, 400);
    }

    const telefoneNorm = normalizarTelefone(telefoneRaw);
    const variantes = gerarVariantes(telefoneRaw);
    log("recebido", { telefone: telefoneNorm, msgLen: mensagemUser.length });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Modo (sempre salva pendente nesta versão, mas calcula para futuro switch)
    const { data: modoSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "agente_modo_loja_cg")
      .maybeSingle();
    const modoCalculado = (typeof modoSetting?.value === "string" ? modoSetting.value : modoSetting?.value) || "supervisionado";
    if (modoCalculado === "desligado") {
      log("agente desligado via system_settings — saindo sem chamar Anthropic");
      return jsonResponse({ success: false, motivo: "agente_desligado" });
    }
    const ehAutonomo = modoCalculado === "autonomo";
    const statusAprovacaoAssistant = ehAutonomo ? "enviada_auto" : "pendente";
    log("modo calculado", { modoCalculado, statusAprovacaoAssistant });

    // ── Buscar conversa ativa
    let { data: conversa } = await supabase
      .from("agente_ia_conversas")
      .select("id, cliente_id, status, agente_pausado, total_turnos, total_tokens_in, total_tokens_out, custo_estimado")
      .in("telefone", variantes)
      .eq("status", "ativa")
      .order("ultima_mensagem_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conversa && conversa.agente_pausado === true) {
      log("agente pausado manualmente — não chamar Anthropic", { id: conversa.id });
      return jsonResponse({ success: false, motivo: "agente_pausado_manualmente", conversa_id: conversa.id });
    }

    if (!conversa) {
      const { data: nova, error: novaErr } = await supabase
        .from("agente_ia_conversas")
        .insert({ telefone: telefoneNorm, status: "ativa" })
          .select("id, cliente_id, status, total_turnos, total_tokens_in, total_tokens_out, custo_estimado")
        .single();
      if (novaErr || !nova) {
        log("erro criando conversa", novaErr);
        return jsonResponse({ error: "Falha ao criar conversa", detalhe: novaErr?.message }, 500);
      }
      conversa = nova;
      log("conversa criada", { id: conversa.id });
    } else {
      log("conversa existente", { id: conversa.id });
    }

    const ctx: ContextoConversa = {
      conversa_id: conversa.id,
      cliente_id: conversa.cliente_id,
      telefone: telefoneNorm,
    };

    // ── Contexto inicial completo (RPC unificada) — usado APENAS se ainda não temos cliente_id
    //    e também como descoberta inicial. Não persistimos mais snapshot no agente_ia_mensagens.
    let contextoInfererencia = "";
    if (!conversa.cliente_id) {
      const { data: contextoFull, error: ctxErr } = await supabase
        .rpc("contexto_inicial_cliente", { p_telefone: telefoneRaw });

      if (ctxErr) {
        log("erro contexto_inicial_cliente", ctxErr);
      } else if (contextoFull && contextoFull.pessoa?.found) {
        const clienteId = contextoFull.pessoa.ebd_clientes?.cliente_id || null;
        log("contexto inicial obtido", {
          cliente_id: clienteId,
          total_pedidos: contextoFull.historico?.total,
          tem_licenca: contextoFull.acessos?.tem_acesso_atual,
          motivo: contextoFull.inferencia?.provavel_motivo_contato,
        });

        if (clienteId) {
          await supabase.from("agente_ia_conversas")
            .update({ cliente_id: clienteId })
            .eq("id", conversa.id);
          ctx.cliente_id = clienteId;
          conversa.cliente_id = clienteId;
        }

        // Manter inferência (recorrência, motivo provável, campanhas) — esses são contextuais
        contextoInfererencia = `
📊 HISTÓRICO E INFERÊNCIA (snapshot do início desta conversa):
- Total de pedidos: ${contextoFull.historico?.total || 0}
- Cliente recorrente: ${contextoFull.inferencia?.cliente_recorrente}
- Cliente inativo (>90d): ${contextoFull.inferencia?.cliente_inativo}
- Licenças digitais ativas: ${contextoFull.acessos?.total_licencas_ativas || 0}
- Em campanha ativa: ${contextoFull.campanhas_ativas?.em_alguma_campanha}
- PROVÁVEL MOTIVO DO CONTATO: ${contextoFull.inferencia?.provavel_motivo_contato}`;
      } else {
        log("cliente NÃO identificado em nenhuma fonte", { telefone: telefoneNorm });
      }
    }

    // ── DADOS ATUAIS DO CLIENTE — re-buscados FRESCOS a cada turno (fonte da verdade absoluta)
    let dadosAtuais = "";
    let cadastroAtual: DadosCadastroAtuais | null = null;
    if (ctx.cliente_id) {
      const { data: c } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, nome_superintendente, nome_responsavel, email_superintendente, telefone, tipo_cliente, pode_faturar, cnpj, cpf, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep")
        .eq("id", ctx.cliente_id)
        .maybeSingle();
      if (c) {
        const nomeFull = (c.nome_responsavel || c.nome_superintendente || c.nome_igreja || "").trim();
        const primeiro = nomeFull.split(/\s+/)[0] || "—";
        const enderecoPrincipal = [c.endereco_rua, c.endereco_numero].filter(Boolean).join(", ");
        const enderecoDetalhes = [c.endereco_complemento, c.endereco_bairro].filter(Boolean).join(" - ");
        const enderecoCompleto = [enderecoPrincipal, enderecoDetalhes].filter(Boolean).join(" - ");
        cadastroAtual = {
          origem: "cliente",
          primeiroNome: primeiro,
          nome: nomeFull || "—",
          igreja: c.nome_igreja || "—",
          email: c.email_superintendente || "—",
          telefone: c.telefone || "—",
          endereco: enderecoCompleto || "—",
          cidade: c.endereco_cidade || "—",
          estado: c.endereco_estado || "—",
          cep: c.endereco_cep || "—",
        };
        dadosAtuais = `
🔒 DADOS ATUAIS DO CADASTRO DO CLIENTE (FONTE DA VERDADE — relido do banco AGORA, sobrepõe QUALQUER informação anterior do histórico desta conversa):
- cliente_id: ${c.id}
- Primeiro nome: ${primeiro}
- Nome completo: ${nomeFull || "—"}
- Igreja: ${c.nome_igreja || "—"}
- Email: ${c.email_superintendente || "—"}
- Telefone: ${c.telefone || "—"}
- Documento: ${c.cnpj || c.cpf || "—"}
- Endereço: ${enderecoCompleto || "—"}
- Cidade/UF: ${c.endereco_cidade || "—"}/${c.endereco_estado || "—"}
- CEP: ${c.endereco_cep || "—"}
- Tipo cliente: ${c.tipo_cliente || "(não classificado)"}
- Pode faturar (B2B): ${c.pode_faturar ?? false}

REGRA: Se o cliente perguntar quais dados estão no cadastro dele, responda EXCLUSIVAMENTE com base neste bloco. Se você (agente) afirmou nome/igreja/endereço/telefone diferentes em mensagens anteriores desta conversa, esses dados antigos estão ERRADOS — o cadastro foi atualizado. NUNCA repita dados que apareçam apenas em mensagens anteriores e contradigam este bloco.`;
      }
    } else {
      // Lead totalmente novo — sem cliente_id em ebd_clientes. Tentar lead landing.
      const { data: lead } = await supabase
        .from("ebd_leads_reativacao")
        .select("nome_igreja, nome_responsavel, email, telefone, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep")
        .in("telefone", variantes)
        .maybeSingle();
      if (lead) {
        const enderecoPrincipal = [lead.endereco_rua, lead.endereco_numero].filter(Boolean).join(", ");
        const enderecoCompleto = [enderecoPrincipal, lead.endereco_bairro].filter(Boolean).join(" - ");
        cadastroAtual = {
          origem: "lead",
          primeiroNome: (lead.nome_responsavel || lead.nome_igreja || "").trim().split(/\s+/)[0] || "—",
          nome: lead.nome_responsavel || "—",
          igreja: lead.nome_igreja || "—",
          email: lead.email || "—",
          telefone: lead.telefone || "—",
          endereco: enderecoCompleto || "—",
          cidade: lead.endereco_cidade || "—",
          estado: lead.endereco_estado || "—",
          cep: lead.endereco_cep || "—",
        };
        dadosAtuais = `
🔒 DADOS ATUAIS DO LEAD (FONTE DA VERDADE — relido AGORA, sobrepõe histórico):
- Nome: ${lead.nome_responsavel || "—"}
- Igreja: ${lead.nome_igreja || "—"}
- Email: ${lead.email || "—"}
- Telefone: ${lead.telefone || "—"}
- Endereço: ${enderecoCompleto || "—"}
- Cidade/UF: ${lead.endereco_cidade || "—"}/${lead.endereco_estado || "—"}
- CEP: ${lead.endereco_cep || "—"}
- Tipo: lead landing page (sem cadastro de cliente ainda)`;
      } else {
        dadosAtuais = `
🔒 DADOS ATUAIS DO CONTATO:
- Telefone: ${telefoneNorm}
- Cliente NÃO encontrado em ebd_clientes nem em ebd_leads_reativacao (lead totalmente novo)
- Você não sabe nome, igreja, nem histórico

INSTRUÇÃO: Cumprimente neutro com apresentação do agente. Colete naturalmente nome + igreja (se aplicável) + email/cidade.`;
      }
    }

    const systemFinal = SYSTEM_PROMPT
      + (contextoInfererencia ? "\n\n---\n" + contextoInfererencia : "")
      + "\n\n---\n" + dadosAtuais
      + "\n\n---\nINSTRUÇÃO GERAL: Use TODO esse contexto INTERNAMENTE. NÃO anuncie tudo que sabe na primeira mensagem — apenas cumprimente e pergunte em que pode ajudar. Quando o cliente pedir confirmação dos dados cadastrais, responda APENAS com o bloco DADOS ATUAIS DO CADASTRO acima.";

    // ── Persistir mensagem do user
    await supabase.from("agente_ia_mensagens").insert({
      conversa_id: conversa.id,
      role: "user",
      conteudo: mensagemUser,
      status_aprovacao: "nao_aplicavel",
    });

    if (ehPedidoDadosCadastrais(mensagemUser)) {
      const respostaCadastro = montarRespostaDadosCadastrais(cadastroAtual, telefoneNorm);
      log("resposta determinística de cadastro acionada", {
        conversa_id: conversa.id,
        cliente_id: ctx.cliente_id,
        origem: cadastroAtual?.origem || "nao_encontrado",
      });

      const { data: assistMsg, error: assistErr } = await supabase
        .from("agente_ia_mensagens")
        .insert({
          conversa_id: conversa.id,
          role: "assistant",
          conteudo: respostaCadastro,
          tokens_in: 0,
          tokens_out: 0,
          status_aprovacao: statusAprovacaoAssistant,
        })
        .select("id")
        .single();
      if (assistErr) log("erro insert assistant determinístico", assistErr);

      await supabase
        .from("agente_ia_conversas")
        .update({
          ultima_mensagem_em: new Date().toISOString(),
          total_turnos: (conversa.total_turnos || 0) + 1,
        })
        .eq("id", conversa.id);

      if (ehAutonomo && assistMsg?.id && respostaCadastro) {
        log("modo autônomo — disparando envio Meta (determinístico)", { mensagem_id: assistMsg.id });
        const envioPromise = fetch(`${SUPABASE_URL}/functions/v1/agente-enviar-mensagem-whatsapp`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mensagem_id: assistMsg.id,
            telefone_destino: telefoneNorm,
            texto: respostaCadastro,
          }),
        }).then(async (r) => {
          if (!r.ok) console.error(`[agente-loja-cg] envio Meta falhou (determinístico):`, await r.text());
          else log("envio Meta determinístico disparado com sucesso");
        }).catch(err => console.error(`[agente-loja-cg] envio Meta erro (determinístico):`, err));
        // @ts-ignore EdgeRuntime no Deno deploy
        const wait = (globalThis as any).EdgeRuntime?.waitUntil ?? ((q: Promise<any>) => q);
        wait(envioPromise);
      }

      return jsonResponse({
        success: true,
        conversa_id: conversa.id,
        mensagem_pendente_id: assistMsg?.id || null,
        resposta_preview: respostaCadastro,
        tokens: {
          in: 0,
          out: 0,
          custo_usd: 0,
          custo_acumulado_usd: Number(conversa.custo_estimado || 0),
        },
        modo: modoCalculado,
      });
    }

    // ── Reconstruir histórico para Claude (somente user/assistant/tool relevantes)
    const { data: historico } = await supabase
      .from("agente_ia_mensagens")
      .select("role, conteudo, tool_name, tool_input, tool_output, id")
      .eq("conversa_id", conversa.id)
      .order("created_at", { ascending: true });

    const messages: any[] = [];
    for (const m of historico || []) {
      if (m.role === "user") {
        messages.push({ role: "user", content: m.conteudo || "" });
      } else if (m.role === "assistant") {
        messages.push({ role: "assistant", content: m.conteudo || "" });
      }
      // tool_use/tool_result do turno atual são reconstruídos no loop abaixo
    }

    // ── Loop de tool use
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let mensagemPendenteId: string | null = null;
    let respostaTextoFinal = "";
    // Acumula TODAS as tool_uses do turno completo para o guardrail
    const toolCallsTurno: Array<{ name: string; output: any }> = [];

    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      log(`loop ${loop} → Anthropic`, { msgs: messages.length });

      const anthropicResp = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2048,
          system: systemFinal,
          tools: TOOL_SCHEMAS,
          messages,
        }),
      });

      if (!anthropicResp.ok) {
        const errText = await anthropicResp.text();
        log("Anthropic erro", { status: anthropicResp.status, body: errText });
        await supabase.from("agente_ia_mensagens").insert({
          conversa_id: conversa.id,
          role: "system",
          conteudo: `Anthropic API erro ${anthropicResp.status}: ${errText.slice(0, 1000)}`,
          status_aprovacao: "nao_aplicavel",
        });
        return jsonResponse({ error: "Anthropic API error", status: anthropicResp.status, detalhe: errText }, 500);
      }

      const data = await anthropicResp.json();
      totalTokensIn += data?.usage?.input_tokens || 0;
      totalTokensOut += data?.usage?.output_tokens || 0;

      const blocks: any[] = data?.content || [];
      const toolUses = blocks.filter((b) => b.type === "tool_use");
      const textBlocks = blocks.filter((b) => b.type === "text");

      // Adicionar resposta do assistant ao histórico do turno (com blocks raw)
      messages.push({ role: "assistant", content: blocks });

      if (toolUses.length === 0) {
        respostaTextoFinal = textBlocks.map((t: any) => t.text).join("\n").trim();
        log("loop final — texto recebido", { len: respostaTextoFinal.length });

        // ── GUARDRAIL: bloqueia link de proposta alucinado
        const guard = validarLinksProposta(respostaTextoFinal, toolCallsTurno);
        if (!guard.ok) {
          log("⛔ GUARDRAIL bloqueou link alucinado", {
            uuids_invalidos: guard.uuids_invalidos,
            uuids_validos: guard.uuids_validos,
          });

          // 1. Registra incidente
          await supabase.from("agente_ia_guardrail_alerts").insert({
            conversa_id: conversa.id,
            tipo: "link_proposta_alucinado",
            detalhes: {
              uuids_invalidos: guard.uuids_invalidos,
              uuids_validos_no_turno: guard.uuids_validos,
              tool_calls_turno: toolCallsTurno.map((t) => t.name),
            },
            texto_bloqueado: respostaTextoFinal,
          });

          // 2. Persiste a mensagem original como "bloqueada" (audit) — NÃO envia
          await supabase.from("agente_ia_mensagens").insert({
            conversa_id: conversa.id,
            role: "assistant",
            conteudo: `[BLOQUEADA PELO GUARDRAIL — link alucinado]\n${respostaTextoFinal}`,
            tokens_in: data?.usage?.input_tokens || 0,
            tokens_out: data?.usage?.output_tokens || 0,
            status_aprovacao: "bloqueada",
          });

          // 3. Cria escalation automática
          try {
            await TOOL_HANDLERS.escalar_para_humano(
              {
                motivo: "outro",
                detalhes: `Guardrail bloqueou link de proposta alucinado. UUIDs inválidos: ${guard.uuids_invalidos.join(", ")}`,
                prioridade: "alta",
              },
              supabase,
              ctx,
            );
          } catch (escErr) {
            log("erro ao criar escalation automática do guardrail", escErr);
          }

          // 4. Envia mensagem genérica ao cliente
          const mensagemFallback =
            "Tive um problema técnico aqui pra finalizar agora. Um consultor já foi acionado e vai te chamar pra concluir. 🙏";

          const { data: fallbackMsg } = await supabase
            .from("agente_ia_mensagens")
            .insert({
              conversa_id: conversa.id,
              role: "assistant",
              conteudo: mensagemFallback,
              tokens_in: 0,
              tokens_out: 0,
              status_aprovacao: statusAprovacaoAssistant,
            })
            .select("id")
            .single();

          mensagemPendenteId = fallbackMsg?.id || null;
          respostaTextoFinal = mensagemFallback;

          if (ehAutonomo && mensagemPendenteId) {
            const envioPromise = fetch(`${SUPABASE_URL}/functions/v1/agente-enviar-mensagem-whatsapp`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                mensagem_id: mensagemPendenteId,
                telefone_destino: telefoneNorm,
                texto: mensagemFallback,
              }),
            }).catch((e) => console.error(`[agente-loja-cg] envio fallback erro:`, e));
            // @ts-ignore EdgeRuntime no Deno deploy
            const wait = (globalThis as any).EdgeRuntime?.waitUntil ?? ((q: Promise<any>) => q);
            wait(envioPromise);
          }
          break;
        }

        const { data: assistMsg, error: assistErr } = await supabase
          .from("agente_ia_mensagens")
          .insert({
            conversa_id: conversa.id,
            role: "assistant",
            conteudo: respostaTextoFinal,
            tokens_in: data?.usage?.input_tokens || 0,
            tokens_out: data?.usage?.output_tokens || 0,
            status_aprovacao: statusAprovacaoAssistant,
          })
          .select("id")
          .single();
        if (assistErr) log("erro insert assistant", assistErr);
        mensagemPendenteId = assistMsg?.id || null;

        // Modo autônomo: dispara envio Meta fire-and-forget
        if (ehAutonomo && mensagemPendenteId && respostaTextoFinal) {
          log("modo autônomo — disparando envio Meta", { mensagem_id: mensagemPendenteId });
          const envioPromise = fetch(`${SUPABASE_URL}/functions/v1/agente-enviar-mensagem-whatsapp`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mensagem_id: mensagemPendenteId,
              telefone_destino: telefoneNorm,
              texto: respostaTextoFinal,
            }),
          }).then(async (r) => {
            if (!r.ok) console.error(`[agente-loja-cg] envio Meta falhou:`, await r.text());
            else log("envio Meta disparado com sucesso");
          }).catch(err => console.error(`[agente-loja-cg] envio Meta erro:`, err));
          // @ts-ignore EdgeRuntime no Deno deploy
          const wait = (globalThis as any).EdgeRuntime?.waitUntil ?? ((q: Promise<any>) => q);
          wait(envioPromise);
        }
        break;
      }

      // Executar tools e enviar resultados de volta
      const toolResults: any[] = [];
      for (const tu of toolUses) {
        const handler = TOOL_HANDLERS[tu.name];
        log(`tool_use → ${tu.name}`, tu.input);
        let outputObj: any;
        let ok = true;
        if (!handler) {
          ok = false;
          outputObj = { error: `tool desconhecida: ${tu.name}` };
        } else {
          try {
            outputObj = await handler(tu.input, supabase, ctx);
          } catch (e: any) {
            ok = false;
            outputObj = { error: e?.message || String(e) };
            log(`tool ${tu.name} falhou`, outputObj);
          }
        }

        // Acumula no rastreamento do turno (pra guardrail)
        toolCallsTurno.push({ name: tu.name, output: outputObj });

        await supabase.from("agente_ia_mensagens").insert({
          conversa_id: conversa.id,
          role: "tool",
          tool_name: tu.name,
          tool_input: tu.input,
          tool_output: outputObj,
          status_aprovacao: "nao_aplicavel",
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(outputObj),
          is_error: !ok,
        });
      }

      messages.push({ role: "user", content: toolResults });

      if (data.stop_reason !== "tool_use") {
        log("stop_reason inesperado", { stop_reason: data.stop_reason });
      }
    }

    // ── Atualizar contadores da conversa
    const custoTurnoUsd = calcularCustoUsd(MODEL, totalTokensIn, totalTokensOut);
    const { data: convAtual } = await supabase
      .from("agente_ia_conversas")
      .select("custo_estimado")
      .eq("id", conversa.id)
      .maybeSingle();
    const custoAcumuladoUsd =
      Math.round(((Number(convAtual?.custo_estimado) || 0) + custoTurnoUsd) * 10000) / 10000;

    await supabase
      .from("agente_ia_conversas")
      .update({
        ultima_mensagem_em: new Date().toISOString(),
        total_turnos: (conversa.total_turnos || 0) + 1,
        total_tokens_in: (conversa.total_tokens_in || 0) + totalTokensIn,
        total_tokens_out: (conversa.total_tokens_out || 0) + totalTokensOut,
        custo_estimado: custoAcumuladoUsd,
      })
      .eq("id", conversa.id);

    return jsonResponse({
      success: true,
      conversa_id: conversa.id,
      mensagem_pendente_id: mensagemPendenteId,
      resposta_preview: respostaTextoFinal,
      tokens: { in: totalTokensIn, out: totalTokensOut, custo_usd: custoTurnoUsd, custo_acumulado_usd: custoAcumuladoUsd },
      modo: modoCalculado,
    });
  } catch (err: any) {
    console.error("[agente-loja-cg] erro inesperado", err);
    return jsonResponse({ error: "Erro interno", detalhe: err?.message || String(err) }, 500);
  }
});
