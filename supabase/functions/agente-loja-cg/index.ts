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
    const statusAprovacaoAssistant = "pendente"; // Forçado nesta versão. Trocar para modoCalculado === "autonomo" ? "enviada_auto" : "pendente"
    log("modo calculado", { modoCalculado, statusAprovacaoAssistant });

    // ── Buscar conversa ativa
    let { data: conversa } = await supabase
      .from("agente_ia_conversas")
      .select("id, cliente_id, status, total_turnos, total_tokens_in, total_tokens_out")
      .in("telefone", variantes)
      .in("status", ["ativa", "pausada_humano", "escalada"])
      .order("ultima_mensagem_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conversa && (conversa.status === "pausada_humano" || conversa.status === "escalada")) {
      log("conversa pausada/escalada — não chamar Anthropic", { id: conversa.id, status: conversa.status });
      return jsonResponse({ success: false, motivo: "conversa_pausada", conversa_id: conversa.id, status: conversa.status });
    }

    if (!conversa) {
      const { data: nova, error: novaErr } = await supabase
        .from("agente_ia_conversas")
        .insert({ telefone: telefoneNorm, status: "ativa" })
        .select("id, cliente_id, status, total_turnos, total_tokens_in, total_tokens_out")
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

    // ── Persistir mensagem do user
    await supabase.from("agente_ia_mensagens").insert({
      conversa_id: conversa.id,
      role: "user",
      conteudo: mensagemUser,
      status_aprovacao: "nao_aplicavel",
    });

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
          system: SYSTEM_PROMPT,
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
