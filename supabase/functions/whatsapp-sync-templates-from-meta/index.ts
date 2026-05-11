// Sincroniza todos os templates da WABA Meta para a tabela whatsapp_templates.
// Pode ser chamada por usuário admin/superadmin OU via SERVICE_ROLE (cron).

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // --- Auth: aceita SERVICE_KEY (cron) ou usuário admin/superadmin
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) return jsonResponse({ error: "Não autorizado" }, 401);

    if (token !== SERVICE_KEY) {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return jsonResponse({ error: "Não autorizado" }, 401);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const allowed = ["admin", "superadmin"];
      if (!(roles || []).some((r: any) => allowed.includes(r.role))) {
        return jsonResponse({ error: "Permissão negada" }, 403);
      }
    }

    // Credenciais
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_business_account_id", "whatsapp_access_token"]);
    const sm: Record<string, string> = {};
    (settings || []).forEach((s: any) => { sm[s.key] = s.value; });
    const wabaId = sm["whatsapp_business_account_id"];
    const accessToken = sm["whatsapp_access_token"];
    if (!wabaId || !accessToken) {
      return jsonResponse({ error: "Credenciais Meta não configuradas" }, 500);
    }

    // Buscar templates do Meta paginado
    const allTemplates: any[] = [];
    let nextUrl: string | null =
      `https://graph.facebook.com/v22.0/${wabaId}/message_templates?fields=name,id,status,category,language,components,rejected_reason&limit=100`;

    while (nextUrl) {
      const res: Response = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        return jsonResponse({
          error: "Erro ao buscar templates do Meta",
          detalhe: errText.slice(0, 500),
        }, 500);
      }
      const json = await res.json();
      if (Array.isArray(json.data)) allTemplates.push(...json.data);
      nextUrl = json.paging?.next || null;
    }

    const statusMap: Record<string, string> = {
      "APPROVED": "APROVADO",
      "REJECTED": "REJEITADO",
      "PENDING": "PENDENTE",
      "PAUSED": "PAUSADO",
      "DISABLED": "DESABILITADO",
      "IN_APPEAL": "PENDENTE",
      "PENDING_DELETION": "DESABILITADO",
    };

    const resultados = {
      total_meta: allTemplates.length,
      inseridos: 0,
      atualizados: 0,
      erros: [] as any[],
    };

    for (const tpl of allTemplates) {
      try {
        const nome = tpl.name;
        const idioma = tpl.language || "pt_BR";
        const categoria = tpl.category || "MARKETING";
        const status = statusMap[tpl.status] || "PENDENTE";
        const meta_template_id = tpl.id ? String(tpl.id) : null;
        const meta_rejection_reason = tpl.rejected_reason && tpl.rejected_reason !== "NONE"
          ? String(tpl.rejected_reason) : null;

        const components = Array.isArray(tpl.components) ? tpl.components : [];
        let corpo = "";
        let cabecalho_tipo: string | null = null;
        let cabecalho_texto: string | null = null;
        let cabecalho_midia_url: string | null = null;
        let rodape: string | null = null;
        let botoes: any[] = [];
        let variaveis_usadas: string[] = [];

        for (const c of components) {
          if (c.type === "HEADER") {
            cabecalho_tipo = c.format || "TEXT";
            if (c.format === "TEXT") cabecalho_texto = c.text || null;
            if (c.format === "IMAGE" || c.format === "VIDEO" || c.format === "DOCUMENT") {
              cabecalho_midia_url = c.example?.header_handle?.[0] || null;
            }
          } else if (c.type === "BODY") {
            corpo = c.text || "";
            const matches = corpo.match(/\{\{\s*([^}]+?)\s*\}\}/g) || [];
            variaveis_usadas = matches.map((m: string) => m.replace(/[{}]/g, "").trim());
          } else if (c.type === "FOOTER") {
            rodape = c.text || null;
          } else if (c.type === "BUTTONS") {
            botoes = (c.buttons || []).map((b: any) => ({
              tipo: b.type,
              texto: b.text,
              url: b.url || null,
              telefone: b.phone_number || null,
              url_dinamica: typeof b.url === "string" && b.url.includes("{{"),
            }));
          }
        }

        const registro: any = {
          nome,
          idioma,
          categoria,
          status,
          corpo: corpo || nome,
          cabecalho_tipo,
          cabecalho_texto,
          cabecalho_midia_url,
          rodape,
          botoes,
          variaveis_usadas,
          meta_template_id,
          meta_rejection_reason,
        };

        const { data: existente } = await supabase
          .from("whatsapp_templates")
          .select("id")
          .eq("nome", nome)
          .maybeSingle();

        if (existente) {
          const { error: updateErr } = await supabase
            .from("whatsapp_templates")
            .update(registro)
            .eq("id", existente.id);
          if (updateErr) resultados.erros.push({ template: nome, erro: updateErr.message });
          else resultados.atualizados++;
        } else {
          const { error: insertErr } = await supabase
            .from("whatsapp_templates")
            .insert(registro);
          if (insertErr) resultados.erros.push({ template: nome, erro: insertErr.message });
          else resultados.inseridos++;
        }
      } catch (e: any) {
        resultados.erros.push({ template: tpl?.name || "?", erro: e?.message || String(e) });
      }
    }

    return jsonResponse(resultados);
  } catch (err: any) {
    console.error("[whatsapp-sync-templates-from-meta] erro:", err);
    return jsonResponse({ error: err?.message || "Erro interno" }, 500);
  }
});
