import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function calcularDesconto(temDesconto: boolean, percentualAtual: number): number {
  if (!temDesconto) return 20;
  if (percentualAtual < 30) return percentualAtual + 5;
  return percentualAtual;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate user auth
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { campanha_id } = await req.json();
    if (!campanha_id) {
      return new Response(JSON.stringify({ error: "campanha_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch campaign with template
    const { data: campanha, error: cErr } = await supabase
      .from("whatsapp_campanhas")
      .select("*, whatsapp_templates(*)")
      .eq("id", campanha_id)
      .single();

    if (cErr || !campanha) {
      return new Response(JSON.stringify({ error: "Campanha não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update campaign status
    await supabase.from("whatsapp_campanhas").update({ status: "enviando" }).eq("id", campanha_id);

    // Get WhatsApp credentials from system_settings
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    const phoneNumberId = settingsMap["whatsapp_phone_number_id"];
    const accessToken = settingsMap["whatsapp_access_token"];

    if (!phoneNumberId || !accessToken) {
      await supabase.from("whatsapp_campanhas").update({ status: "pausada" }).eq("id", campanha_id);
      return new Response(JSON.stringify({ error: "Credenciais WhatsApp não configuradas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch pending recipients
    const { data: destinatarios } = await supabase
      .from("whatsapp_campanha_destinatarios")
      .select("*")
      .eq("campanha_id", campanha_id)
      .eq("status_envio", "pendente");

    const template = campanha.whatsapp_templates;
    const templateName = template?.nome;
    const templateLang = template?.idioma || "pt_BR";
    const variables: string[] = template?.variaveis_usadas || [];

    // Parse botoes once before the loop (robust)
    const botoes = (() => {
      try {
        const raw = template?.botoes;
        if (!raw) return [];
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch { return []; }
    })();

    const hasUrlDinamica = botoes.some((b: any) => b.tipo === 'URL' && b.url_dinamica === true);
    const usesLinkOferta = hasUrlDinamica || variables.some(
      (v: string) => v.replace(/\{\{|\}\}/g, "").trim() === "link_oferta"
    );

    console.log("[send-campaign] botoes:", JSON.stringify(botoes));
    console.log("[send-campaign] hasUrlDinamica:", hasUrlDinamica, "usesLinkOferta:", usesLinkOferta);

    let enviados = 0;
    let erros = 0;

    for (const dest of (destinatarios || [])) {
      try {
        // Format phone number
        let phone = (dest.telefone || "").replace(/\D/g, "");
        if (phone.startsWith("0")) phone = phone.substring(1);
        if (!phone.startsWith("55")) phone = "55" + phone;

        // --- Generate personalized link if template uses link_oferta ---
        let linkOferta = "";
        let linkToken = "";
        let linkRecord: any = null;

        if (usesLinkOferta) {
          // Lookup client data from ebd_clientes by email or cliente_id
          let clienteData: any = null;
          const destEmail = (dest.email || "").trim().toLowerCase();
          const destClienteId = dest.cliente_id;

          if (destClienteId) {
            const { data } = await supabase
              .from("ebd_clientes")
              .select("id, nome_igreja, email_superintendente, senha_temporaria, telefone")
              .eq("id", destClienteId)
              .single();
            clienteData = data;
          } else if (destEmail) {
            const { data } = await supabase
              .from("ebd_clientes")
              .select("id, nome_igreja, email_superintendente, senha_temporaria, telefone")
              .ilike("email_superintendente", destEmail)
              .limit(1)
              .single();
            clienteData = data;
          }

          // Fetch discount info
          let temDesconto = false;
          let percentualDesconto = 0;
          if (clienteData?.id) {
            const { data: descontoData } = await supabase
              .from("ebd_descontos_categoria_representante")
              .select("percentual_desconto")
              .eq("cliente_id", clienteData.id)
              .eq("categoria", "revistas")
              .limit(1)
              .single();
            if (descontoData) {
              temDesconto = true;
              percentualDesconto = Number(descontoData.percentual_desconto) || 0;
            }
          }

          const finalDiscount = calcularDesconto(temDesconto, percentualDesconto);

          // Parse last_products from dest metadata
          const produtosPedido = dest.produtos_pedido || "seus produtos";
          const lastProducts = produtosPedido !== "seus produtos"
            ? produtosPedido.split(",").map((p: string) => p.trim())
            : [];

          // Generate token and insert campaign_link
          const linkToken = crypto.randomUUID();
          const { data: insertedLink } = await supabase
            .from("campaign_links")
            .insert({
              token: linkToken,
              campaign_id: campanha_id,
              customer_name: dest.nome || clienteData?.nome_igreja || "Cliente",
              customer_email: destEmail || clienteData?.email_superintendente || null,
              customer_phone: dest.telefone || clienteData?.telefone || null,
              last_order_date: dest.data_pedido || null,
              last_products: lastProducts.length > 0 ? lastProducts : null,
              last_order_value: dest.valor_pedido ? Number(dest.valor_pedido) : null,
              has_discount: temDesconto,
              discount_percentage: temDesconto ? percentualDesconto : null,
              final_discount: finalDiscount,
              access_email: clienteData?.email_superintendente || destEmail || null,
              access_password: clienteData?.senha_temporaria || null,
              panel_url: "https://gestaoebd.com.br/vendedor",
            })
            .select("id")
            .single();

          linkRecord = insertedLink;
          linkOferta = `https://gestaoebd.com.br/oferta/${linkToken}`;
        }

        // Build template components (variables)
        const varValues: string[] = [];
        for (const v of variables) {
          const key = v.replace(/\{\{|\}\}/g, "").trim();
          switch (key) {
            case "nome_completo": varValues.push(dest.nome || "Cliente"); break;
            case "primeiro_nome": varValues.push((dest.nome || "Cliente").split(" ")[0]); break;
            case "email": varValues.push(dest.email || "-"); break;
            case "cpf": varValues.push(dest.tipo_documento === "cpf" ? "CPF" : "-"); break;
            case "cnpj": varValues.push(dest.tipo_documento === "cnpj" ? "CNPJ" : "-"); break;
            case "data_pedido": varValues.push(dest.data_pedido || "-"); break;
            case "produtos_pedido": varValues.push(dest.produtos_pedido || "seus produtos"); break;
            case "valor_pedido": varValues.push(dest.valor_pedido || "-"); break;
            case "categoria_produtos": varValues.push(dest.categoria_produtos || "-"); break;
            case "link_oferta": varValues.push(linkOferta || "-"); break;
            default: varValues.push("-"); break;
          }
        }

        const components: any[] = [];

        // Add header component if template has IMAGE header
        if (template?.cabecalho_tipo === "IMAGE" && template?.cabecalho_midia_url) {
          components.push({
            type: "header",
            parameters: [
              {
                type: "image",
                image: { link: template.cabecalho_midia_url },
              },
            ],
          });
        }

        if (varValues.length > 0) {
          components.push({
            type: "body",
            parameters: varValues.map((v) => ({ type: "text", text: v })),
          });
        }

        // Add dynamic URL button components
        botoes.forEach((btn: any, idx: number) => {
          if (btn.tipo === "URL" && btn.url_dinamica) {
            const token = linkOferta ? linkOferta.split("/").pop() : "";
            components.push({
              type: "button",
              sub_type: "url",
              index: String(idx),
              parameters: [{ type: "text", text: token }],
            });
          }
        });

        const payload = {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLang },
            ...(components.length > 0 ? { components } : {}),
          },
        };

        const res = await fetch(
          `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        const resBody = await res.text();

        if (res.ok) {
          await supabase.from("whatsapp_campanha_destinatarios").update({
            status_envio: "enviado",
            enviado_em: new Date().toISOString(),
          }).eq("id", dest.id);
          enviados++;

          // Register message_sent event if link was generated
          if (linkRecord?.id) {
            await supabase.from("campaign_events").insert({
              link_id: linkRecord.id,
              campaign_id: campanha_id,
              event_type: "message_sent",
              event_data: { phone, template: templateName },
            });
          }
        } else {
          console.error(`Erro envio para ${phone}:`, resBody);
          await supabase.from("whatsapp_campanha_destinatarios").update({
            status_envio: "erro",
          }).eq("id", dest.id);
          erros++;
        }
      } catch (err) {
        console.error("Erro envio destinatário:", err);
        await supabase.from("whatsapp_campanha_destinatarios").update({
          status_envio: "erro",
        }).eq("id", dest.id);
        erros++;
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 100));
    }

    // Update campaign counters
    await supabase.from("whatsapp_campanhas").update({
      status: "enviada",
      total_enviados: enviados,
      total_erros: erros,
    }).eq("id", campanha_id);

    return new Response(
      JSON.stringify({ success: true, enviados, erros }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Erro geral:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
