// Envia template Meta aprovado para UM destinatário (1:1).
// Usado pelo painel de atendimento quando a janela de 24h expirou.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatPhone(phone: string): string {
  let cleaned = (phone || "").replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("55")) cleaned = "55" + cleaned;
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // --- Auth: requer JWT de usuário com role admin/superadmin/gerente_ebd/financeiro
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) return jsonResponse({ error: "Não autorizado" }, 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return jsonResponse({ error: "Não autorizado" }, 401);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowed = ["admin", "superadmin", "gerente_ebd", "financeiro"];
    const ok = (roles || []).some((r: any) => allowed.includes(r.role));
    if (!ok) return jsonResponse({ error: "Permissão negada" }, 403);

    const body = await req.json();
    const telefone: string = body?.telefone;
    const template_id: string = body?.template_id;
    const variable_values: Record<string, string> = body?.variable_values || {};
    const button_dynamic_suffix: string | undefined = body?.button_dynamic_suffix;
    const nome_destino: string | undefined = body?.nome_destino;

    if (!telefone || !template_id) {
      return jsonResponse({ error: "telefone e template_id são obrigatórios" }, 400);
    }

    // Carrega template
    const { data: tpl, error: tplErr } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("id", template_id)
      .single();
    if (tplErr || !tpl) return jsonResponse({ error: "Template não encontrado" }, 404);
    if (tpl.status !== "APROVADO" && tpl.status !== "APPROVED") {
      return jsonResponse({ error: "Template não está aprovado" }, 400);
    }

    // Carrega credenciais Meta
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);
    const sm: Record<string, string> = {};
    (settings || []).forEach((s: any) => { sm[s.key] = s.value; });
    const phoneNumberId = sm["whatsapp_phone_number_id"];
    const accessToken = sm["whatsapp_access_token"];
    if (!phoneNumberId || !accessToken) {
      return jsonResponse({ error: "Credenciais WhatsApp não configuradas" }, 500);
    }

    const formattedPhone = formatPhone(telefone);
    const header_image_url: string | undefined = body?.header_image_url;

    // Monta components
    const variables: string[] = (tpl.variaveis_usadas as string[]) || [];
    const components: any[] = [];

    // ---- Validação de campos obrigatórios ANTES de enviar ----
    const camposFaltando: string[] = [];
    for (const v of variables) {
      const key = String(v).replace(/\{\{|\}\}/g, "").trim();
      const val = variable_values[key];
      if (val === undefined || val === null || String(val).trim() === "") {
        camposFaltando.push(`variável "${key}"`);
      }
    }
    const headerImageUrl = header_image_url || tpl.cabecalho_midia_url;
    const templateMediaId: string | null = (tpl as any).cabecalho_media_id || null;
    // header_image_url passed explicitly by the caller overrides the stored media_id
    const useMediaId = templateMediaId && !header_image_url;
    if (tpl.cabecalho_tipo === "IMAGE" && !headerImageUrl && !useMediaId) {
      camposFaltando.push("imagem do cabeçalho (header_image_url)");
    }
    if (camposFaltando.length > 0) {
      return jsonResponse({
        error: "Campos obrigatórios faltando",
        detalhe: `Template "${tpl.nome}" requer: ${camposFaltando.join(", ")}`,
        campos_faltando: camposFaltando,
      }, 400);
    }

    // ---- Header ----
    if (tpl.cabecalho_tipo === "IMAGE" && (headerImageUrl || useMediaId)) {
      components.push({
        type: "header",
        parameters: [{
          type: "image",
          image: useMediaId ? { id: templateMediaId } : { link: headerImageUrl },
        }],
      });
    } else if (tpl.cabecalho_tipo === "VIDEO" && headerImageUrl) {
      components.push({
        type: "header",
        parameters: [{ type: "video", video: { link: headerImageUrl } }],
      });
    } else if (tpl.cabecalho_tipo === "DOCUMENT" && headerImageUrl) {
      components.push({
        type: "header",
        parameters: [{ type: "document", document: { link: headerImageUrl, filename: "documento.pdf" } }],
      });
    }
    // HEADER do tipo TEXT estático não precisa de parameters (apenas se tivesse {{1}} no texto)

    // ---- Body params (suporta NOMEADOS e NUMERADOS) ----
    if (variables.length > 0) {
      // Detecta se é nomeado: pelo menos uma variável NÃO é puramente numérica
      const isNamed = variables.some((v) => {
        const key = String(v).replace(/\{\{|\}\}/g, "").trim();
        return !/^\d+$/.test(key);
      });

      const params = variables.map((v) => {
        const key = String(v).replace(/\{\{|\}\}/g, "").trim();
        const text = String(variable_values[key]).trim();
        if (isNamed) {
          return { type: "text", parameter_name: key, text };
        }
        return { type: "text", text };
      });

      components.push({ type: "body", parameters: params });
    }

    // ---- Botões ----
    const botoes = (() => {
      const raw = tpl.botoes;
      if (!raw) return [] as any[];
      try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return []; }
    })();
    botoes.forEach((btn: any, index: number) => {
      if (btn?.tipo === "URL" && btn?.url_dinamica === true) {
        const suffix = (button_dynamic_suffix && String(button_dynamic_suffix).trim()) ||
          formattedPhone.replace(/^55/, "");
        components.push({
          type: "button",
          sub_type: "url",
          index: String(index),
          parameters: [{ type: "text", text: suffix }],
        });
      }
      // URL estática, QUICK_REPLY, CATALOG e PHONE_NUMBER não precisam de component
    });

    const payload = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: tpl.nome,
        language: { code: tpl.idioma || "pt_BR" },
        ...(components.length > 0 ? { components } : {}),
      },
    };

    console.log("[whatsapp-send-template-avulso] payload:", JSON.stringify(payload));

    const graphRes = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const graphResult = await graphRes.json().catch(() => ({}));
    const isSuccess = graphRes.ok;

    // Texto representativo da mensagem (corpo com variáveis substituídas)
    let textoExibido = String(tpl.corpo || tpl.nome);
    Object.entries(variable_values || {}).forEach(([k, v]) => {
      const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g");
      textoExibido = textoExibido.replace(re, String(v));
    });

    // Log em whatsapp_mensagens
    await supabase.from("whatsapp_mensagens").insert({
      tipo_mensagem: "template_avulso",
      telefone_destino: formattedPhone,
      nome_destino: nome_destino || null,
      mensagem: textoExibido,
      status: isSuccess ? "enviado" : "erro",
      erro_detalhes: isSuccess ? null : JSON.stringify(graphResult).slice(0, 1000),
      enviado_por: user.id,
      payload_enviado: payload,
      resposta_recebida: graphResult,
    });

    // Adiciona ao timeline da conversa também (assistant)
    if (isSuccess) {
      await supabase.from("whatsapp_conversas").insert({
        telefone: formattedPhone,
        role: "assistant",
        content: `📋 [Template: ${tpl.nome}]\n\n${textoExibido}`,
      });

      // Reativa agente IA: envio de template avulso = vendedor quer agente respondendo
      const phoneDigits = formattedPhone.replace(/^55/, "");
      const variantesTel = [formattedPhone, phoneDigits];
      await supabase
        .from("agente_ia_conversas")
        .update({ agente_pausado: false })
        .in("telefone", variantesTel)
        .eq("agente_pausado", true);
    }

    if (!isSuccess) {
      const errMsg = graphResult?.error?.message || JSON.stringify(graphResult).slice(0, 300);
      return jsonResponse({ error: "Falha no envio Meta", detalhe: errMsg, meta: graphResult }, 500);
    }

    const wamid = graphResult?.messages?.[0]?.id || null;
    return jsonResponse({ success: true, message_id: wamid });
  } catch (err: any) {
    console.error("[whatsapp-send-template-avulso] erro:", err);
    return jsonResponse({ error: err?.message || "Erro interno" }, 500);
  }
});
