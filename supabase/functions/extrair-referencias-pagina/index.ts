import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { licao_id } = await req.json();
    if (!licao_id) {
      return new Response(JSON.stringify({ error: "licao_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: licao, error: licaoError } = await supabase
      .from("revista_licoes")
      .select("id, numero, titulo, paginas")
      .eq("id", licao_id)
      .single();

    if (licaoError || !licao) {
      return new Response(JSON.stringify({ error: "Lição não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paginas = (licao.paginas as string[]) || [];
    if (paginas.length === 0) {
      return new Response(JSON.stringify({ error: "Lição sem páginas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalRefs = 0;
    let totalPaginas = 0;
    const maxPages = Math.min(paginas.length, 13);

    for (let i = 0; i < maxPages; i++) {
      const url = paginas[i];

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Analise esta página de uma revista bíblica e extraia APENAS as referências bíblicas citadas no texto (ex: Jo 3.16, Ef 2.4-5). Retorne SOMENTE um array JSON com as referências encontradas. Se não houver referências, retorne []. Formato: ["Livro cap.vers", "Livro cap.vers-vers"]. Não inclua explicações, apenas o array JSON.`,
                  },
                  {
                    type: "image_url",
                    image_url: { url },
                  },
                ],
              },
            ],
          }),
        });

        if (!response.ok) {
          console.error(`AI error for page ${i}: ${response.status}`);
          if (response.status === 429) {
            // Wait and retry
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          continue;
        }

        const aiData = await response.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        // Extract JSON array from response
        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (!jsonMatch) continue;

        const refs = JSON.parse(jsonMatch[0]) as string[];
        if (!Array.isArray(refs) || refs.length === 0) continue;

        // Filter valid refs
        const validRefs = refs.filter((r: string) => typeof r === "string" && r.trim().length > 0);
        if (validRefs.length === 0) continue;

        await supabase
          .from("revista_referencias_pagina")
          .upsert(
            { licao_id, pagina: i, referencias: validRefs },
            { onConflict: "licao_id,pagina" }
          );

        totalRefs += validRefs.length;
        totalPaginas++;
      } catch (e) {
        console.error(`Error processing page ${i}:`, e);
        continue;
      }

      // Small delay between requests
      if (i < maxPages - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return new Response(JSON.stringify({ sucesso: true, total_paginas: totalPaginas, total_refs: totalRefs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
