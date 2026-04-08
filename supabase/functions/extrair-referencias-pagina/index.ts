import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Normalize reference to bible-api.com format
function normalizeBibleRef(ref: string): string {
  let r = ref.trim();
  // Map abbreviations to english names
  const bookMap: Record<string, string> = {
    "gn": "genesis", "gê": "genesis", "ge": "genesis", "gên": "genesis",
    "ex": "exodus", "êx": "exodus",
    "lv": "leviticus", "lev": "leviticus",
    "nm": "numbers", "núm": "numbers", "num": "numbers",
    "dt": "deuteronomy", "deut": "deuteronomy",
    "js": "joshua", "jos": "joshua",
    "jz": "judges", "juí": "judges", "jui": "judges",
    "rt": "ruth", "rute": "ruth",
    "1sm": "1 samuel", "1 sm": "1 samuel", "1samuel": "1 samuel",
    "2sm": "2 samuel", "2 sm": "2 samuel", "2samuel": "2 samuel",
    "1rs": "1 kings", "1 rs": "1 kings", "1reis": "1 kings", "1 reis": "1 kings",
    "2rs": "2 kings", "2 rs": "2 kings", "2reis": "2 kings", "2 reis": "2 kings",
    "1cr": "1 chronicles", "1 cr": "1 chronicles", "1crônicas": "1 chronicles",
    "2cr": "2 chronicles", "2 cr": "2 chronicles", "2crônicas": "2 chronicles",
    "ed": "ezra", "esd": "ezra", "esdras": "ezra",
    "ne": "nehemiah", "nee": "nehemiah", "neemias": "nehemiah",
    "et": "esther", "est": "esther", "ester": "esther",
    "jó": "job",
    "sl": "psalms", "sal": "psalms", "salmo": "psalms", "salmos": "psalms",
    "pv": "proverbs", "pr": "proverbs", "prov": "proverbs", "provérbios": "proverbs",
    "ec": "ecclesiastes", "ecl": "ecclesiastes",
    "ct": "song of solomon", "cânticos": "song of solomon", "canticos": "song of solomon", "cantares": "song of solomon",
    "is": "isaiah", "isa": "isaiah", "isaías": "isaiah",
    "jr": "jeremiah", "jer": "jeremiah", "jeremias": "jeremiah",
    "lm": "lamentations", "lam": "lamentations", "lamentações": "lamentations",
    "ez": "ezekiel", "ezeq": "ezekiel", "ezequiel": "ezekiel",
    "dn": "daniel", "dan": "daniel",
    "os": "hosea", "oséias": "hosea", "oseias": "hosea",
    "jl": "joel",
    "am": "amos", "amós": "amos",
    "ob": "obadiah", "obadias": "obadiah",
    "jn": "jonah", "jonas": "jonah",
    "mq": "micah", "miquéias": "micah", "miqueias": "micah",
    "na": "nahum", "naum": "nahum",
    "hc": "habakkuk", "habacuque": "habakkuk",
    "sf": "zephaniah", "sofonias": "zephaniah",
    "ag": "haggai", "ageu": "haggai",
    "zc": "zechariah", "zac": "zechariah", "zacarias": "zechariah",
    "ml": "malachi", "malaquias": "malachi",
    "mt": "matthew", "mat": "matthew", "mateus": "matthew",
    "mc": "mark", "marcos": "mark",
    "lc": "luke", "lucas": "luke",
    "jo": "john", "joão": "john",
    "at": "acts", "atos": "acts",
    "rm": "romans", "rom": "romans", "romanos": "romans",
    "1co": "1 corinthians", "1 co": "1 corinthians", "1coríntios": "1 corinthians",
    "2co": "2 corinthians", "2 co": "2 corinthians", "2coríntios": "2 corinthians",
    "gl": "galatians", "gál": "galatians", "gal": "galatians", "gálatas": "galatians",
    "ef": "ephesians", "efé": "ephesians", "efésios": "ephesians",
    "fp": "philippians", "fil": "philippians", "filipenses": "philippians",
    "cl": "colossians", "col": "colossians", "colossenses": "colossians",
    "1ts": "1 thessalonians", "1 ts": "1 thessalonians", "1tessalonicenses": "1 thessalonians",
    "2ts": "2 thessalonians", "2 ts": "2 thessalonians", "2tessalonicenses": "2 thessalonians",
    "1tm": "1 timothy", "1 tm": "1 timothy", "1timóteo": "1 timothy",
    "2tm": "2 timothy", "2 tm": "2 timothy", "2timóteo": "2 timothy",
    "tt": "titus", "tito": "titus",
    "fm": "philemon", "filemom": "philemon", "filemon": "philemon",
    "hb": "hebrews", "hebr": "hebrews", "hebreus": "hebrews",
    "tg": "james", "tiago": "james",
    "1pe": "1 peter", "1 pe": "1 peter", "1pedro": "1 peter",
    "2pe": "2 peter", "2 pe": "2 peter", "2pedro": "2 peter",
    "1jo": "1 john", "1 jo": "1 john", "1joão": "1 john",
    "2jo": "2 john", "2 jo": "2 john", "2joão": "2 john",
    "3jo": "3 john", "3 jo": "3 john", "3joão": "3 john",
    "jd": "jude", "judas": "jude",
    "ap": "revelation", "apoc": "revelation", "apocalipse": "revelation",
  };

  // Replace . with : for bible-api format
  r = r.replace(/\./g, ":");

  // Extract book and chapter:verse
  const match = r.match(/^(\d?\s*[a-záàâãéèêíïóôõúüç]+)\s*(\d.*)$/i);
  if (!match) return r;

  let book = match[1].trim().toLowerCase();
  // Remove accents for lookup
  const bookNoAccent = book.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const verse = match[2];

  const mapped = bookMap[book] || bookMap[bookNoAccent];
  if (mapped) {
    return `${mapped} ${verse}`;
  }
  return `${book} ${verse}`;
}

async function validateRef(ref: string): Promise<boolean> {
  try {
    const normalized = normalizeBibleRef(ref);
    const resp = await fetch(`https://bible-api.com/${encodeURIComponent(normalized)}?translation=almeida`);
    if (!resp.ok) return false;
    const data = await resp.json();
    return !!(data.text && data.text.trim().length > 0);
  } catch {
    return false;
  }
}

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

    let totalRefsExtraidas = 0;
    let totalRefsValidas = 0;
    let totalRefsDescartadas = 0;
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
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          continue;
        }

        const aiData = await response.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (!jsonMatch) continue;

        const refs = JSON.parse(jsonMatch[0]) as string[];
        if (!Array.isArray(refs) || refs.length === 0) continue;

        const extractedRefs = refs.filter((r: string) => typeof r === "string" && r.trim().length > 0);
        totalRefsExtraidas += extractedRefs.length;

        // Validate each reference against bible-api.com
        const validRefs: string[] = [];
        for (const ref of extractedRefs) {
          const isValid = await validateRef(ref);
          if (isValid) {
            validRefs.push(ref);
          } else {
            console.log(`Referência descartada (inválida): "${ref}"`);
            totalRefsDescartadas++;
          }
          // Rate limit
          await new Promise(r => setTimeout(r, 200));
        }

        if (validRefs.length > 0) {
          await supabase
            .from("revista_referencias_pagina")
            .upsert(
              { licao_id, pagina: i, referencias: validRefs },
              { onConflict: "licao_id,pagina" }
            );
          totalRefsValidas += validRefs.length;
          totalPaginas++;
        } else {
          // Delete existing record if no valid refs
          await supabase
            .from("revista_referencias_pagina")
            .delete()
            .eq("licao_id", licao_id)
            .eq("pagina", i);
        }
      } catch (e) {
        console.error(`Error processing page ${i}:`, e);
        continue;
      }

      // Delay between pages
      if (i < maxPages - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return new Response(JSON.stringify({
      sucesso: true,
      total_paginas: totalPaginas,
      total_refs_extraidas: totalRefsExtraidas,
      total_refs_validas: totalRefsValidas,
      total_refs_descartadas: totalRefsDescartadas,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
