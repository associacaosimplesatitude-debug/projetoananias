import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Map abbreviations and full names (normalized, no accents) → API-accepted Portuguese name
const bookMapping: Record<string, string> = {
  // AT
  "gn": "gênesis", "genesis": "gênesis",
  "ex": "êxodo", "exodo": "êxodo",
  "lv": "levítico", "levitico": "levítico",
  "nm": "números", "numeros": "números",
  "dt": "deuteronômio", "deuteronomio": "deuteronômio",
  "js": "josué", "josue": "josué",
  "jz": "juízes", "juizes": "juízes",
  "rt": "rute", "rute": "rute",
  "1sm": "1 samuel", "1 samuel": "1 samuel", "1samuel": "1 samuel",
  "2sm": "2 samuel", "2 samuel": "2 samuel", "2samuel": "2 samuel",
  "1rs": "1 reis", "1 reis": "1 reis", "1reis": "1 reis",
  "2rs": "2 reis", "2 reis": "2 reis", "2reis": "2 reis",
  "1cr": "1 crônicas", "1 cronicas": "1 crônicas", "1cronicas": "1 crônicas",
  "2cr": "2 crônicas", "2 cronicas": "2 crônicas", "2cronicas": "2 crônicas",
  "ed": "esdras", "esdras": "esdras",
  "ne": "neemias", "neemias": "neemias",
  "et": "ester", "ester": "ester",
  // "jó" handled via special logic in resolveBookName
  "sl": "salmos", "salmos": "salmos", "salmo": "salmos",
  "pv": "provérbios", "proverbios": "provérbios",
  "ec": "eclesiastes", "eclesiastes": "eclesiastes",
  "ct": "cantares", "cantares": "cantares", "canticos": "cantares",
  "is": "isaías", "isaias": "isaías",
  "jr": "jeremias", "jeremias": "jeremias",
  "lm": "lamentações", "lamentacoes": "lamentações",
  "ez": "ezequiel", "ezequiel": "ezequiel",
  "dn": "daniel", "daniel": "daniel",
  "os": "oséias", "oseias": "oséias",
  "jl": "joel", "joel": "joel",
  "am": "amós", "amos": "amós",
  "ob": "obadias", "ab": "obadias", "obadias": "obadias",
  "jn": "jonas", "jonas": "jonas",
  "mq": "miquéias", "miqueias": "miquéias",
  "na": "naum", "naum": "naum",
  "hc": "habacuque", "habacuque": "habacuque",
  "sf": "sofonias", "sofonias": "sofonias",
  "ag": "ageu", "ageu": "ageu",
  "zc": "zacarias", "zacarias": "zacarias",
  "ml": "malaquias", "malaquias": "malaquias",
  // NT
  "mt": "mateus", "mateus": "mateus",
  "mc": "marcos", "marcos": "marcos",
  "lc": "lucas", "lucas": "lucas",
  "joao": "joão",
  "at": "atos", "atos": "atos",
  "rm": "romanos", "romanos": "romanos",
  "1co": "1 coríntios", "1 corintios": "1 coríntios", "1corintios": "1 coríntios",
  "2co": "2 coríntios", "2 corintios": "2 coríntios", "2corintios": "2 coríntios",
  "gl": "gálatas", "galatas": "gálatas",
  "ef": "efésios", "efesios": "efésios",
  "fp": "filipenses", "filipenses": "filipenses",
  "cl": "colossenses", "colossenses": "colossenses",
  "1ts": "1 tessalonicenses", "1 tessalonicenses": "1 tessalonicenses", "1tessalonicenses": "1 tessalonicenses",
  "2ts": "2 tessalonicenses", "2 tessalonicenses": "2 tessalonicenses", "2tessalonicenses": "2 tessalonicenses",
  "1tm": "1 timóteo", "1 timoteo": "1 timóteo", "1timoteo": "1 timóteo",
  "2tm": "2 timóteo", "2 timoteo": "2 timóteo", "2timoteo": "2 timóteo",
  "tt": "tito", "tito": "tito",
  "fm": "filemom", "filemom": "filemom",
  "hb": "hebreus", "hebreus": "hebreus",
  "tg": "tiago", "tiago": "tiago",
  "1pe": "1 pedro", "1 pedro": "1 pedro", "1pedro": "1 pedro",
  "2pe": "2 pedro", "2 pedro": "2 pedro", "2pedro": "2 pedro",
  "1jo": "1 joão", "1 joao": "1 joão", "1joao": "1 joão",
  "2jo": "2 joão", "2 joao": "2 joão", "2joao": "2 joão",
  "3jo": "3 joão", "3 joao": "3 joão", "3joao": "3 joão",
  "jd": "judas", "judas": "judas",
  "ap": "apocalipse", "apocalipse": "apocalipse",
};

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveBookName(book: string): string | null {
  const lower = book.toLowerCase().trim();
  
  // Special case: "jó" (with accent) → Job, "jo" (without) → João
  if (lower === "jó") return "jó";
  if (lower === "jo") return "joão";
  
  const key = normalizeKey(book);
  return bookMapping[key] || null;
}

interface ParsedReference {
  originalBook: string;
  book: string;
  chapter: number;
  startVerse: number | null;
  endVerse: number | null;
}

function parseReference(reference: string): ParsedReference | null {
  const cleaned = reference.trim();
  
  // Match: "Efésios 2.8", "Ef 2.4-5", "1Co 13.4", "1 João 2.1-3"
  const match = cleaned.match(
    /^(\d?\s*[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)\s+(\d+)(?:[.:](\d+))?(?:\s*[-–]\s*(\d+))?$/i
  );
  
  if (!match) {
    console.log(`Could not parse reference: ${reference}`);
    return null;
  }
  
  const [, bookRaw, chapterStr, startVerseStr, endVerseStr] = match;
  const originalBook = bookRaw.trim();
  
  const resolvedBook = resolveBookName(originalBook);
  if (!resolvedBook) {
    console.log(`Book not found in mapping: ${originalBook}`);
    return null;
  }

  return {
    originalBook,
    book: resolvedBook,
    chapter: parseInt(chapterStr),
    startVerse: startVerseStr ? parseInt(startVerseStr) : null,
    endVerse: endVerseStr ? parseInt(endVerseStr) : null,
  };
}

async function fetchVerseFromAPI(ref: ParsedReference): Promise<{ text: string; verses: string[] } | null> {
  // Format: "efésios 2:8" or "1 coríntios 10:3-5"
  let refString = `${ref.book} ${ref.chapter}`;
  if (ref.startVerse !== null) {
    refString += `:${ref.startVerse}`;
    if (ref.endVerse !== null) {
      refString += `-${ref.endVerse}`;
    }
  }
  
  const apiUrl = `https://bible-api.com/${encodeURIComponent(refString)}?translation=almeida`;
  console.log(`Fetching from API: ${apiUrl}`);
  
  try {
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.error(`Bible API error for ${refString}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.error(`Bible API returned error: ${data.error}`);
      return null;
    }

    const verses = data.verses || [];
    
    if (verses.length === 0 && data.text) {
      return { text: data.text.trim(), verses: [data.text.trim()] };
    }

    if (verses.length === 0) return null;

    const verseTexts = verses.map((v: any) => v.text.trim());
    return { text: verseTexts.join('\n\n'), verses: verseTexts };
  } catch (error) {
    console.error(`Error fetching verse ${refString}:`, error);
    return null;
  }
}

function formatReferenceTitle(ref: ParsedReference): string {
  let title = `${ref.originalBook} ${ref.chapter}`;
  if (ref.startVerse !== null) {
    title += `.${ref.startVerse}`;
    if (ref.endVerse !== null) title += `-${ref.endVerse}`;
  }
  return title;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { livro, versiculo } = await req.json();
    
    if (!livro && !versiculo) {
      return new Response(
        JSON.stringify({ error: 'Livro ou versículo são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let fullReference = '';
    if (livro && versiculo) {
      fullReference = `${livro} ${versiculo}`;
    } else {
      fullReference = livro || versiculo;
    }
    
    console.log(`Processing reference: ${fullReference}`);

    const references = fullReference.split(';').map((r: string) => r.trim()).filter((r: string) => r.length > 0);
    
    const results: { referencia: string; texto: string | null; versiculos: string[] }[] = [];
    
    for (const refString of references) {
      const parsed = parseReference(refString);
      
      if (!parsed) {
        results.push({ referencia: refString, texto: null, versiculos: [] });
        continue;
      }
      
      const verseData = await fetchVerseFromAPI(parsed);
      
      if (verseData) {
        results.push({
          referencia: formatReferenceTitle(parsed),
          texto: verseData.text,
          versiculos: verseData.verses
        });
      } else {
        results.push({ referencia: formatReferenceTitle(parsed), texto: null, versiculos: [] });
      }
    }
    
    const combinedText = results.map(r => {
      const text = r.texto || `Não foi possível carregar: ${r.referencia}`;
      if (results.length > 1) return `📖 ${r.referencia}\n\n${text}`;
      return text;
    }).join('\n\n---\n\n');
    
    const allReferences = results.map(r => r.referencia).join('; ');
    
    return new Response(
      JSON.stringify({ 
        texto: results.some(r => r.texto) ? combinedText : null,
        referencia: allReferences,
        versiculos: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Bible verse:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar versículo', texto: null, referencia: '' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
