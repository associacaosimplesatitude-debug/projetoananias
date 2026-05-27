import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });

    const authPayload = await authResponse.json().catch(() => null);

    if (!authResponse.ok || !authPayload?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", authPayload.id);

    const hasAccess = (roles || []).some((r: any) =>
      ["admin", "gerente_ebd", "superadmin"].includes(r.role)
    );
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    let { email, licenca_id } = body || {};

    if (!email && licenca_id) {
      const { data: lic } = await admin
        .from("revista_licencas_shopify")
        .select("email")
        .eq("id", licenca_id)
        .maybeSingle();
      email = lic?.email || null;
    }

    if (!email) {
      return new Response(JSON.stringify({ error: "email_obrigatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: logs } = await admin
      .from("ebd_email_logs")
      .select(
        "id, created_at, destinatario, assunto, status, erro, tipo_envio, email_aberto, data_abertura, link_clicado, data_clique, resend_email_id, dados_enviados"
      )
      .eq("destinatario", email)
      .order("created_at", { ascending: false })
      .limit(50);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Enrich with Resend last_event if possible (parallel)
    const enriched = await Promise.all(
      (logs || []).map(async (log: any) => {
        let resend: any = null;
        if (log.resend_email_id && resendApiKey) {
          try {
            const r = await fetch(
              `https://api.resend.com/emails/${log.resend_email_id}`,
              { headers: { Authorization: `Bearer ${resendApiKey}` } }
            );
            if (r.ok) {
              const j = await r.json();
              resend = {
                last_event: j?.last_event ?? null,
                created_at: j?.created_at ?? null,
                from: j?.from ?? null,
              };
            }
          } catch (_) {
            // ignore
          }
        }

        // Build timeline
        const failed = ["falhou", "erro", "failed"].includes(
          String(log.status).toLowerCase()
        );
        const lastEvent = String(resend?.last_event || "").toLowerCase();
        const delivered =
          ["delivered", "opened", "clicked"].includes(lastEvent) ||
          log.email_aberto ||
          log.link_clicado;
        const bounced = ["bounced", "complained"].includes(lastEvent);

        return {
          id: log.id,
          destinatario: log.destinatario,
          assunto: log.assunto,
          status: log.status,
          erro: log.erro,
          tipo_envio: log.tipo_envio,
          resend_email_id: log.resend_email_id,
          dados_enviados: log.dados_enviados,
          from: resend?.from || null,
          timeline: {
            enviado: { at: log.created_at, ok: !failed },
            entregue: {
              at: delivered ? resend?.created_at || log.created_at : null,
              ok: delivered && !bounced,
              bounced,
            },
            aberto: {
              at: log.data_abertura,
              ok: !!log.email_aberto,
            },
            clicou: {
              at: log.data_clique,
              ok: !!log.link_clicado,
            },
          },
        };
      })
    );

    return new Response(
      JSON.stringify({ success: true, email, emails: enriched }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "erro_interno",
        detalhe: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
