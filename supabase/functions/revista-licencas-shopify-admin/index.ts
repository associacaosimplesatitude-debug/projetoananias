import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Public action — no auth required
    if (action === "list_catalogo") {
      const { data, error } = await supabaseAdmin
        .from("ebd_produto_revista_mapping")
        .select(`
          id,
          sku,
          shopify_url,
          revista_digital_id,
          revistas_digitais:revistas_digitais!ebd_produto_revista_mapping_revista_digital_id_fkey(
            id, titulo, capa_url, tipo
          )
        `)
        .not("revista_digital_id", "is", null)
        .not("shopify_url", "is", null);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require auth + admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Verify admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const hasAccess = (roles || []).some((r: any) =>
      ["admin", "gerente_ebd"].includes(r.role)
    );

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Sem permissão" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      const { data, error } = await supabaseAdmin
        .from("revista_licencas_shopify")
        .select("*, revistas_digitais(titulo, capa_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "insert") {
      const { error } = await supabaseAdmin
        .from("revista_licencas_shopify")
        .insert(params.record);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deactivate") {
      const { error } = await supabaseAdmin
        .from("revista_licencas_shopify")
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq("id", params.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resend") {
      const { data: lic } = await supabaseAdmin
        .from("revista_licencas_shopify")
        .select("nome_comprador, whatsapp, email, revistas_digitais(titulo)")
        .eq("id", params.id)
        .single();

      if (!lic) throw new Error("Licença não encontrada");

      const titulo = (lic as any).revistas_digitais?.titulo || "Revista";
      const urlAcesso = "https://revistas.centralgospel.com.br/revista/acesso";

      // Envio WhatsApp
      if (lic.whatsapp) {
        try {
          await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp-message`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                telefone: lic.whatsapp,
                mensagem: `Ola, ${lic.nome_comprador || "Cliente"}! Sua ${titulo} esta disponivel.\n\nAcesse em:\n${urlAcesso}\n\nDigite seu numero de WhatsApp para receber o codigo de acesso.`,
              }),
            }
          );
        } catch (whatsErr) {
          console.error("Erro ao reenviar WhatsApp:", whatsErr);
        }
      }

      // Envio Email via Resend
      if (lic.email && lic.email.includes("@")) {
        try {
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          if (resendApiKey) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Central Gospel <relatorios@painel.editoracentralgospel.com.br>",
                to: [lic.email],
                subject: `Seu acesso a ${titulo}`,
                html: `
                  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                    <h2 style="color:#1a1a1a">Olá, ${lic.nome_comprador || "leitor"}!</h2>
                    <p style="color:#333;font-size:16px">Seu acesso a <strong>${titulo}</strong> está disponível.</p>
                    <p style="color:#333;font-size:16px">Para acessar, clique no botão abaixo:</p>
                    <div style="text-align:center;margin:30px 0">
                      <a href="${urlAcesso}" style="background-color:#2563eb;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold">Acessar meu material</a>
                    </div>
                    <p style="color:#666;font-size:14px">Você vai precisar do seu número de WhatsApp para entrar.<br>Enviaremos um código de 4 números para confirmar sua identidade.</p>
                    <p style="color:#999;font-size:12px;margin-top:30px">Ou acesse diretamente: <a href="${urlAcesso}">${urlAcesso}</a></p>
                  </div>
                `,
              }),
            });
          }
        } catch (emailErr) {
          console.error("Erro ao reenviar email:", emailErr);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_mappings") {
      const { data, error } = await supabaseAdmin
        .from("ebd_produto_revista_mapping")
        .select(`
          id,
          sku,
          revista_id,
          revista_digital_id,
          bling_produto_id,
          shopify_url,
          created_at,
          revista_digital:revistas_digitais!ebd_produto_revista_mapping_revista_digital_id_fkey(titulo),
          revista_ebd:ebd_revistas!ebd_produto_revista_mapping_revista_id_fkey(titulo)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (action === "insert_mapping") {
      const insertData: Record<string, unknown> = {
        sku: params.sku,
        revista_digital_id: params.revista_digital_id,
      };
      if (params.bling_produto_id) {
        insertData.bling_produto_id = params.bling_produto_id;
      }
      if (params.revista_id) {
        insertData.revista_id = params.revista_id;
      }
      if (params.shopify_url) {
        insertData.shopify_url = params.shopify_url;
      }
      const { error } = await supabaseAdmin
        .from("ebd_produto_revista_mapping")
        .insert(insertData);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_mapping") {
      const { error } = await supabaseAdmin
        .from("ebd_produto_revista_mapping")
        .update({
          sku: params.sku,
          revista_digital_id: params.revista_digital_id || null,
          shopify_url: params.shopify_url || null,
          bling_produto_id: params.bling_produto_id || null,
        })
        .eq("id", params.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_mapping") {
      const { error } = await supabaseAdmin
        .from("ebd_produto_revista_mapping")
        .delete()
        .eq("id", params.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
