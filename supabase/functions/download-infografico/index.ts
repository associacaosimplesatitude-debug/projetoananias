import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function decodeLeitorToken(token: string): { whatsapp?: string; licencas?: string[]; expires_at?: number; exp?: number } | null {
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { infografico_id, token } = await req.json();

    if (!infografico_id || typeof infografico_id !== "string") {
      return new Response(JSON.stringify({ error: "invalid_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const decoded = decodeLeitorToken(token);
    const expiresAt =
      typeof decoded?.expires_at === "number"
        ? decoded.expires_at
        : typeof decoded?.exp === "number"
        ? decoded.exp
        : null;

    if (!decoded || !decoded.whatsapp || !expiresAt || expiresAt <= Date.now()) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar infografico
    const { data: revista } = await supabase
      .from("revistas_digitais")
      .select("id, titulo, tipo_conteudo, pdf_storage_path, pdf_url")
      .eq("id", infografico_id)
      .maybeSingle();

    if (!revista || revista.tipo_conteudo !== "infografico") {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar licença ativa do identificador (whatsapp ou email) para este infografico
    const identificador = decoded.whatsapp;
    const { data: licenca } = await supabase
      .from("revista_licencas_shopify")
      .select("id, ativo, expira_em")
      .eq("revista_id", infografico_id)
      .eq("ativo", true)
      .or(`whatsapp.eq.${identificador},email.eq.${identificador}`)
      .limit(1)
      .maybeSingle();

    if (!licenca) {
      return new Response(JSON.stringify({ error: "license_invalid" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (licenca.expira_em && new Date(licenca.expira_em) < new Date()) {
      return new Response(JSON.stringify({ error: "license_invalid" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerar signed URL do bucket privado
    const path = revista.pdf_storage_path;
    if (!path) {
      // Fallback: se tiver pdf_url público antigo
      if (revista.pdf_url) {
        return new Response(JSON.stringify({ url: revista.pdf_url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "pdf_not_available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from("infograficos-pdf")
      .createSignedUrl(path, 900);

    if (signErr || !signed?.signedUrl) {
      console.error("Sign URL error:", signErr);
      return new Response(JSON.stringify({ error: "signing_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: signed.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("download-infografico error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
