// Edge Function: licao-gerar-audio
// TTS-1-HD da OpenAI a partir de revista_licoes.transcricao_audio.
// Faz upload no bucket licoes-audio e atualiza a tabela.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VOZES_VALIDAS = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "OPENAI_API_KEY não configurada." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Sessão inválida." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ success: false, error: "Apenas administradores." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const licao_id: string | undefined = body?.licao_id;
    const voz: string = body?.voz ?? "nova";

    if (!licao_id) {
      return new Response(JSON.stringify({ success: false, error: "licao_id obrigatório." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!VOZES_VALIDAS.includes(voz as typeof VOZES_VALIDAS[number])) {
      return new Response(JSON.stringify({ success: false, error: "Voz inválida." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: licao } = await admin
      .from("revista_licoes")
      .select("id, transcricao_audio")
      .eq("id", licao_id)
      .maybeSingle();

    if (!licao) {
      return new Response(JSON.stringify({ success: false, error: "Lição não encontrada." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcricao = (licao.transcricao_audio ?? "").trim();
    if (!transcricao) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Transcrição não encontrada. Gere a transcrição primeiro.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[licao-gerar-audio] gerando TTS ${voz} para ${transcricao.length} caracteres`);

    // OpenAI TTS limita a 4096 chars por request. Dividimos em chunks
    // respeitando fronteiras de frase/parágrafo e concatenamos os MP3s.
    const MAX_CHUNK = 3800;
    function splitTexto(txt: string, max: number): string[] {
      if (txt.length <= max) return [txt];
      const chunks: string[] = [];
      // Primeiro tenta quebrar por parágrafos
      const paragrafos = txt.split(/\n\s*\n/);
      let buffer = "";
      const flush = () => {
        if (buffer.trim()) chunks.push(buffer.trim());
        buffer = "";
      };
      for (const p of paragrafos) {
        if ((buffer + "\n\n" + p).length <= max) {
          buffer = buffer ? buffer + "\n\n" + p : p;
        } else {
          flush();
          if (p.length <= max) {
            buffer = p;
          } else {
            // Quebra por frase
            const frases = p.split(/(?<=[.!?])\s+/);
            for (const f of frases) {
              if ((buffer + " " + f).length <= max) {
                buffer = buffer ? buffer + " " + f : f;
              } else {
                flush();
                if (f.length <= max) {
                  buffer = f;
                } else {
                  // força split bruto
                  for (let i = 0; i < f.length; i += max) {
                    chunks.push(f.slice(i, i + max));
                  }
                }
              }
            }
          }
        }
      }
      flush();
      return chunks;
    }

    const chunks = splitTexto(transcricao, MAX_CHUNK);
    console.log(`[licao-gerar-audio] ${chunks.length} chunk(s)`);

    const buffers: Uint8Array[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[licao-gerar-audio] chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      const ttsResp = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1-hd",
          voice: voz,
          input: chunk,
          response_format: "mp3",
        }),
      });
      if (!ttsResp.ok) {
        const errTxt = await ttsResp.text();
        console.error("OpenAI TTS error:", ttsResp.status, errTxt);
        return new Response(
          JSON.stringify({ success: false, error: `OpenAI TTS HTTP ${ttsResp.status} no chunk ${i + 1}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      buffers.push(new Uint8Array(await ttsResp.arrayBuffer()));
    }

    // Concatena MP3s (frames MP3 são auto-sincronizáveis, basta concatenar bytes)
    const totalLen = buffers.reduce((s, b) => s + b.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const b of buffers) {
      merged.set(b, offset);
      offset += b.length;
    }
    const arrayBuf = merged.buffer;
    const filePath = `licao_${licao_id}_${Date.now()}.mp3`;

    const { error: upErr } = await admin.storage
      .from("licoes-audio")
      .upload(filePath, new Uint8Array(arrayBuf), {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (upErr) {
      console.error("upload error:", upErr);
      return new Response(
        JSON.stringify({ success: false, error: "Erro no upload do áudio." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: pub } = admin.storage.from("licoes-audio").getPublicUrl(filePath);
    const audio_url = pub.publicUrl;

    const { error: updErr } = await admin
      .from("revista_licoes")
      .update({
        audio_url,
        audio_voz: voz,
        audio_modelo: "tts-1-hd",
        audio_gerado_em: new Date().toISOString(),
      })
      .eq("id", licao_id);

    if (updErr) {
      console.error("update error:", updErr);
      return new Response(
        JSON.stringify({ success: false, error: "Áudio gerado, mas erro salvando URL." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, audio_url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("erro geral:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
