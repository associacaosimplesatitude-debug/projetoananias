// Edge Function: licao-tts-preview
// Gera um trecho curto de áudio para pré-ouvir uma voz. Não persiste nada.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VOZES_VALIDAS = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
const TEXTO_PREVIEW =
  "Bem-vindos à Escola Bíblica Dominical. Hoje vamos estudar a Palavra de Deus juntos.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json().catch(() => ({}));
    const voz: string = body?.voz ?? "nova";
    if (!VOZES_VALIDAS.includes(voz as typeof VOZES_VALIDAS[number])) {
      return new Response(JSON.stringify({ error: "Voz inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ttsResp = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: voz,
        input: TEXTO_PREVIEW,
        response_format: "mp3",
      }),
    });

    if (!ttsResp.ok) {
      const t = await ttsResp.text();
      return new Response(JSON.stringify({ error: `TTS HTTP ${ttsResp.status}: ${t}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = await ttsResp.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
