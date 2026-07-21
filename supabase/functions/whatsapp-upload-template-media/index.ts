// Uploads a template header image from a URL (or from whatsapp_templates.cabecalho_midia_url)
// to Meta's Media API (POST /{phone_number_id}/media) and stores the returned media_id
// on whatsapp_templates.cabecalho_media_id. media_id is stable (~30 days) and avoids the
// Meta re-downloading the asset from our Storage for every send.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GRAPH_VERSION = "v20.0";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function guessMime(url: string, fallback = "image/jpeg"): string {
  const u = url.toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".mp4")) return "video/mp4";
  if (u.endsWith(".pdf")) return "application/pdf";
  return fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const { template_id, template_nome, image_url } = body || {};
    if (!template_id && !template_nome) {
      return json({ error: "template_id ou template_nome obrigatório" }, 400);
    }

    // Fetch template row
    const q = supabase.from("whatsapp_templates").select("*").limit(1);
    const { data: tplRow, error: tErr } = template_id
      ? await q.eq("id", template_id).maybeSingle()
      : await q.eq("nome", template_nome).maybeSingle();

    if (tErr || !tplRow) return json({ error: "Template não encontrado", detalhe: tErr?.message }, 404);

    const sourceUrl: string | null = image_url || tplRow.cabecalho_midia_url;
    if (!sourceUrl) return json({ error: "Template sem cabecalho_midia_url" }, 400);

    // Meta credentials
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);
    const sm: Record<string, string> = {};
    (settings || []).forEach((s: any) => { sm[s.key] = s.value; });
    const phoneNumberId = sm["whatsapp_phone_number_id"];
    const accessToken = sm["whatsapp_access_token"];
    if (!phoneNumberId || !accessToken) return json({ error: "Credenciais WhatsApp não configuradas" }, 500);

    // Download the media
    const dl = await fetch(sourceUrl);
    if (!dl.ok) {
      const txt = await dl.text().catch(() => "");
      return json({ error: "Falha ao baixar imagem", status: dl.status, body: txt.slice(0, 500) }, 502);
    }
    const bytes = new Uint8Array(await dl.arrayBuffer());
    const mime = dl.headers.get("content-type") || guessMime(sourceUrl);

    // POST multipart to Meta Media API
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mime);
    form.append("file", new Blob([bytes], { type: mime }), `header.${mime.split("/")[1] || "bin"}`);

    const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const metaJson = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok || !metaJson?.id) {
      console.error("[upload-template-media] Meta error:", metaJson);
      return json({ error: "Meta rejeitou upload", meta: metaJson }, 502);
    }

    const mediaId: string = metaJson.id;

    const { error: uErr } = await supabase
      .from("whatsapp_templates")
      .update({
        cabecalho_media_id: mediaId,
        cabecalho_media_id_atualizado_em: new Date().toISOString(),
      })
      .eq("id", tplRow.id);

    if (uErr) return json({ error: "Falha ao salvar media_id", detalhe: uErr.message }, 500);

    return json({
      ok: true,
      template_id: tplRow.id,
      template_nome: tplRow.nome,
      media_id: mediaId,
      mime,
      bytes: bytes.length,
    });
  } catch (e: any) {
    console.error("[upload-template-media] Exception:", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
