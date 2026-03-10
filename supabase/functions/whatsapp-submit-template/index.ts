import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NAMED_VARS = [
  "nome_completo", "primeiro_nome", "produtos_pedido", "data_pedido",
  "valor_pedido", "categoria_produtos", "cpf", "cnpj",
];

function mapVariablesToPositional(corpo: string): { mappedBody: string; mapping: Record<string, number>; examples: string[] } {
  const mapping: Record<string, number> = {};
  const examples: string[] = [];
  let position = 1;

  const exampleValues: Record<string, string> = {
    nome_completo: "João da Silva",
    primeiro_nome: "João",
    produtos_pedido: "Revista EBD Adultos",
    data_pedido: "15/03/2026",
    valor_pedido: "R$ 149,90",
    categoria_produtos: "Revistas EBD",
    cpf: "123.456.789-00",
    cnpj: "12.345.678/0001-90",
  };

  let mappedBody = corpo;

  // Find all variables used in order
  const usedVars: string[] = [];
  const regex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = regex.exec(corpo)) !== null) {
    const varName = match[1];
    if (NAMED_VARS.includes(varName) && !usedVars.includes(varName)) {
      usedVars.push(varName);
    }
  }

  // Map each unique variable to a position
  for (const varName of usedVars) {
    mapping[varName] = position;
    examples.push(exampleValues[varName] || varName);
    mappedBody = mappedBody.replace(new RegExp(`\\{\\{${varName}\\}\\}`, "g"), `{{${position}}}`);
    position++;
  }

  return { mappedBody, mapping, examples };
}

async function uploadImageToMeta(imageUrl: string, accessToken: string): Promise<string> {
  console.log("[upload-image] Downloading image from:", imageUrl);
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Falha ao baixar imagem: ${imgRes.status}`);
  }
  const imgBuffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  const fileLength = imgBuffer.byteLength;

  console.log("[upload-image] Creating upload session, type:", contentType, "size:", fileLength);
  const sessionRes = await fetch(
    `https://graph.facebook.com/v22.0/app/uploads?file_type=${encodeURIComponent(contentType)}&file_length=${fileLength}&access_token=${accessToken}`,
    { method: "POST" }
  );
  const sessionData = await sessionRes.json();
  console.log("[upload-image] Session response:", JSON.stringify(sessionData));

  if (!sessionData.id) {
    throw new Error(`Falha ao criar sessão de upload: ${JSON.stringify(sessionData)}`);
  }

  console.log("[upload-image] Uploading file to session:", sessionData.id);
  const uploadRes = await fetch(
    `https://graph.facebook.com/v22.0/${sessionData.id}`,
    {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${accessToken}`,
        "file_offset": "0",
        "Content-Type": contentType,
      },
      body: new Uint8Array(imgBuffer),
    }
  );
  const uploadData = await uploadRes.json();
  console.log("[upload-image] Upload response:", JSON.stringify(uploadData));

  if (!uploadData.h) {
    throw new Error(`Falha no upload da imagem: ${JSON.stringify(uploadData)}`);
  }

  return uploadData.h;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[whatsapp-submit-template] v2 - with uploadImageToMeta support");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, template_id } = body;

    // Get Meta credentials from system_settings
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_access_token", "whatsapp_business_account_id"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    const accessToken = settingsMap["whatsapp_access_token"];
    const wabaId = settingsMap["whatsapp_business_account_id"];

    if (!accessToken || !wabaId) {
      return new Response(JSON.stringify({ error: "Credenciais WhatsApp não configuradas. Configure em Credenciais API." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ SUBMIT ============
    if (action === "submit") {
      const { data: template, error: fetchErr } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("id", template_id)
        .single();

      if (fetchErr || !template) {
        return new Response(JSON.stringify({ error: "Template não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { mappedBody, mapping, examples } = mapVariablesToPositional(template.corpo);

      // Build Meta payload
      const components: any[] = [];

      // Header component
      if (template.cabecalho_tipo === "TEXT" && template.cabecalho_texto) {
        components.push({ type: "HEADER", format: "TEXT", text: template.cabecalho_texto });
      } else if (template.cabecalho_tipo === "IMAGE" && template.cabecalho_midia_url) {
        const imageHandle = await uploadImageToMeta(template.cabecalho_midia_url, accessToken);
        components.push({
          type: "HEADER",
          format: "IMAGE",
          example: { header_handle: [imageHandle] },
        });
      }

      // Body component
      const bodyComponent: any = { type: "BODY", text: mappedBody };
      if (examples.length > 0) {
        bodyComponent.example = { body_text: [examples] };
      }
      components.push(bodyComponent);

      // Footer
      if (template.rodape) {
        components.push({ type: "FOOTER", text: template.rodape });
      }

      // Buttons
      const botoes = typeof template.botoes === "string" ? JSON.parse(template.botoes) : (template.botoes || []);
      if (botoes.length > 0) {
        const buttons = botoes.map((btn: any) => {
          if (btn.tipo === "URL") {
            if (btn.url_dinamica) {
              // Dynamic URL: use base URL + {{1}} placeholder for Meta
              const baseUrl = btn.url || "https://gestaoebd.com.br/oferta/";
              return { type: "URL", text: btn.texto, url: `${baseUrl.replace(/\/+$/, "")}/{{1}}`, example: [`${baseUrl.replace(/\/+$/, "")}/exemplo-token`] };
            }
            return { type: "URL", text: btn.texto, url: btn.url };
          }
          return { type: "QUICK_REPLY", text: btn.texto };
        });
        components.push({ type: "BUTTONS", buttons });
      }

      const metaPayload = {
        name: template.nome,
        language: template.idioma,
        category: template.categoria,
        components,
      };

      console.log("[submit-template] Payload:", JSON.stringify(metaPayload));

      const metaRes = await fetch(`https://graph.facebook.com/v22.0/${wabaId}/message_templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(metaPayload),
      });

      const metaData = await metaRes.json();
      console.log("[submit-template] Meta response:", metaRes.status, JSON.stringify(metaData));

      if (!metaRes.ok) {
        const errMsg = metaData?.error?.message || "Erro desconhecido ao submeter template";
        return new Response(JSON.stringify({ error: errMsg, details: metaData?.error }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update template with Meta ID and status
      await supabase.from("whatsapp_templates").update({
        meta_template_id: metaData.id,
        status: "PENDENTE",
      }).eq("id", template_id);

      return new Response(JSON.stringify({
        success: true,
        meta_template_id: metaData.id,
        status: metaData.status,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ CHECK STATUS ============
    if (action === "check_status") {
      const { data: template, error: fetchErr } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("id", template_id)
        .single();

      if (fetchErr || !template) {
        return new Response(JSON.stringify({ error: "Template não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!template.meta_template_id) {
        return new Response(JSON.stringify({ error: "Template ainda não foi enviado ao Meta" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const metaRes = await fetch(
        `https://graph.facebook.com/v22.0/${template.meta_template_id}?fields=status,rejected_reason,quality_score`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const metaData = await metaRes.json();
      console.log("[check-status] Meta:", metaRes.status, JSON.stringify(metaData));

      if (!metaRes.ok) {
        return new Response(JSON.stringify({ error: metaData?.error?.message || "Erro ao consultar Meta" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Map Meta status to our status
      let newStatus = template.status;
      let rejectionReason = template.meta_rejection_reason;

      const metaStatus = (metaData.status || "").toUpperCase();
      if (metaStatus === "APPROVED") {
        newStatus = "APROVADO";
      } else if (metaStatus === "REJECTED") {
        newStatus = "REJEITADO";
        rejectionReason = metaData.rejected_reason || "Motivo não informado pelo Meta";
      } else if (metaStatus === "PENDING" || metaStatus === "IN_REVIEW") {
        newStatus = "PENDENTE";
      }

      await supabase.from("whatsapp_templates").update({
        status: newStatus,
        meta_rejection_reason: rejectionReason,
      }).eq("id", template_id);

      return new Response(JSON.stringify({
        success: true,
        status: newStatus,
        meta_status: metaData.status,
        rejection_reason: rejectionReason,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[whatsapp-submit-template] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
