// Edge Function: licao-transcrever
// OCR multimodal das páginas de uma lição usando GPT-4o Vision (OpenAI direto).
// Salva texto consolidado em revista_licoes.transcricao_audio.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OCR_SYSTEM_PROMPT = `Você é um transcritor de revista de Escola Bíblica Dominical para narração em áudio. Extraia APENAS o texto principal didático da lição desta página.

IGNORE COMPLETAMENTE (não inclua no resultado):
- Cabeçalhos, rodapés, números de página
- Caixa de 'TEXTO BÍBLICO' ou 'LEITURA BÍBLICA' ou similar (lista de versículos numerados isolados que aparece no início da lição, ex: '3 Bendito o Deus... 4 Como nos elegeu... 5 E nos predestinou...')
- Caixas laterais de 'Para refletir', 'Texto Áureo', 'Verdade Prática', 'Subsídio Pastoral', 'Auxílio Bibliográfico', 'Hora da Revisão', 'Para meditar', 'Você sabia?', 'Saiba mais'
- Logos, propagandas, anúncios, QR codes, créditos editoriais
- Numeração de versículos isolada no início de parágrafos quando formar lista de versículos avulsos

PRESERVE (inclua no resultado):
- Título da lição e subtítulos numerados (I, II, III ou 1, 2, 3)
- Parágrafos do conteúdo principal (introdução, desenvolvimento, conclusão)
- Citações bíblicas que estão integradas ao texto narrativo do autor (ex: 'Como ensina Paulo em Efésios 1.3, fomos abençoados...')
- Aplicações práticas dentro do corpo do texto

REGRAS DE FORMATAÇÃO PARA LEITURA EM VOZ ALTA:
- Substitua referências bíblicas abreviadas por extenso: 'Ef 1.3' → 'Efésios capítulo 1, versículo 3'; '1Co 2.4' → 'Primeira Coríntios capítulo 2, versículo 4'; '2Tm' → 'Segunda Timóteo'
- Substitua algarismos romanos em títulos: 'II.' → '2.'
- Devolva apenas o texto limpo em parágrafos, em português brasileiro, sem comentários seus, sem marcadores de página, sem [PÁGINA X].`;

async function transcreverPagina(url: string, openAiKey: string, idx: number): Promise<string> {
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: OCR_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcreva esta página seguindo as regras." },
              { type: "image_url", image_url: { url } },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      console.error(`[pagina ${idx}] OpenAI HTTP ${resp.status}:`, errTxt);
      return "";
    }
    const data = await resp.json();
    const texto = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return texto;
  } catch (e) {
    console.error(`[pagina ${idx}] erro:`, e);
    return "";
  }
}

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

    // Auth: validar usuário e role admin
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
    if (!licao_id || typeof licao_id !== "string") {
      return new Response(JSON.stringify({ success: false, error: "licao_id obrigatório." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: licao, error: licaoErr } = await admin
      .from("revista_licoes")
      .select("id, titulo, paginas")
      .eq("id", licao_id)
      .maybeSingle();

    if (licaoErr || !licao) {
      return new Response(
        JSON.stringify({ success: false, error: "Lição não encontrada." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const paginas: string[] = Array.isArray(licao.paginas) ? licao.paginas : [];
    if (paginas.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Lição sem páginas/imagens." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[licao-transcrever] processando ${paginas.length} páginas da lição ${licao_id}`);

    // Paralelo
    const resultados = await Promise.all(
      paginas.map((url, idx) => transcreverPagina(url, OPENAI_API_KEY, idx)),
    );

    const transcricao = resultados.filter((t) => t && t.length > 0).join("\n\n");

    if (!transcricao) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível extrair texto das páginas. Verifique se as imagens têm conteúdo legível.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: updErr } = await admin
      .from("revista_licoes")
      .update({
        transcricao_audio: transcricao,
        transcricao_gerada_em: new Date().toISOString(),
      })
      .eq("id", licao_id);

    if (updErr) {
      console.error("erro update:", updErr);
      return new Response(
        JSON.stringify({ success: false, error: "Erro salvando transcrição." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcricao,
        total_caracteres: transcricao.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("erro geral:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
