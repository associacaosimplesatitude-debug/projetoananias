import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Complete Bible book mapping: Portuguese (full + abbreviated) → English
const bookNameToEnglish: Record<string, string> = {
  // Antigo Testamento
  "genesis": "genesis", "gn": "genesis",
  "exodo": "exodus", "ex": "exodus",
  "levitico": "leviticus", "lv": "leviticus",
  "numeros": "numbers", "nm": "numbers",
  "deuteronomio": "deuteronomy", "dt": "deuteronomy",
  "josue": "joshua", "js": "joshua",
  "juizes": "judges", "jz": "judges",
  "rute": "ruth", "rt": "ruth",
  "1 samuel": "1samuel", "1samuel": "1samuel", "1sm": "1samuel",
  "2 samuel": "2samuel", "2samuel": "2samuel", "2sm": "2samuel",
  "1 reis": "1kings", "1reis": "1kings", "1rs": "1kings",
  "2 reis": "2kings", "2reis": "2kings", "2rs": "2kings",
  "1 cronicas": "1chronicles", "1cronicas": "1chronicles", "1cr": "1chronicles",
  "2 cronicas": "2chronicles", "2cronicas": "2chronicles", "2cr": "2chronicles",
  "esdras": "ezra", "ed": "ezra",
  "neemias": "nehemiah", "ne": "nehemiah",
  "ester": "esther", "et": "esther",
  "jo": "job",
  "salmos": "psalms", "salmo": "psalms", "sl": "psalms",
  "proverbios": "proverbs", "pv": "proverbs",
  "eclesiastes": "ecclesiastes", "ec": "ecclesiastes",
  "canticos": "songofsolomon", "cantares": "songofsolomon", "ct": "songofsolomon",
  "isaias": "isaiah", "is": "isaiah",
  "jeremias": "jeremiah", "jr": "jeremiah",
  "lamentacoes": "lamentations", "lm": "lamentations",
  "ezequiel": "ezekiel", "ez": "ezekiel",
  "daniel": "daniel", "dn": "daniel",
  "oseias": "hosea", "os": "hosea",
  "joel": "joel", "jl": "joel",
  "amos": "amos", "am": "amos",
  "obadias": "obadiah", "ob": "obadiah", "ab": "obadiah",
  "jonas": "jonah", "jn": "jonah",
  "miqueias": "micah", "mq": "micah",
  "naum": "nahum", "na": "nahum",
  "habacuque": "habakkuk", "hc": "habakkuk",
  "sofonias": "zephaniah", "sf": "zephaniah",
  "ageu": "haggai", "ag": "haggai",
  "zacarias": "zechariah", "zc": "zechariah",
  "malaquias": "malachi", "ml": "malachi",
  // Novo Testamento
  "mateus": "matthew", "mt": "matthew",
  "marcos": "mark", "mc": "mark",
  "lucas": "luke", "lc": "luke",
  "joao": "john",
  "atos": "acts", "at": "acts",
  "romanos": "romans", "rm": "romans",
  "1 corintios": "1corinthians", "1corintios": "1corinthians", "1co": "1corinthians",
  "2 corintios": "2corinthians", "2corintios": "2corinthians", "2co": "2corinthians",
  "galatas": "galatians", "gl": "galatians",
  "efesios": "ephesians", "ef": "ephesians",
  "filipenses": "philippians", "fp": "philippians",
  "colossenses": "colossians", "cl": "colossians",
  "1 tessalonicenses": "1thessalonians", "1tessalonicenses": "1thessalonians", "1ts": "1thessalonians",
  "2 tessalonicenses": "2thessalonians", "2tessalonicenses": "2thessalonians", "2ts": "2thessalonians",
  "1 timoteo": "1timothy", "1timoteo": "1timothy", "1tm": "1timothy",
  "2 timoteo": "2timothy", "2timoteo": "2timothy", "2tm": "2timothy",
  "tito": "titus", "tt": "titus",
  "filemom": "philemon", "fm": "philemon",
  "hebreus": "hebrews", "hb": "hebrews",
  "tiago": "james", "tg": "james",
  "1 pedro": "1peter", "1pedro": "1peter", "1pe": "1peter",
  "2 pedro": "2peter", "2pedro": "2peter", "2pe": "2peter",
  "1 joao": "1john", "1jo": "1john",
  "2 joao": "2john", "2jo": "2john",
  "3 joao": "3john", "3jo": "3john",
  "judas": "jude", "jd": "jude",
  "apocalipse": "revelation", "ap": "revelation",
};

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBookName(book: string): string | null {
  const key = normalizeKey(book);
  return bookNameToEnglish[key] || null;
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
  
  // Match patterns like: "Efésios 2.8", "Ef 2.4-5", "1Co 13.4", "Jo 3.16", "1 João 2.1-3"
  // Book part: optional number prefix + letters (with optional space between)
  // Ref part: chapter, then optional .verse or :verse, then optional -endverse
  const match = cleaned.match(
    /^(\d?\s*[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)\s+(\d+)(?:[.:](\d+))?(?:\s*[-–]\s*(\d+))?$/i
  );
  
  if (!match) {
    console.log(`Could not parse reference: ${reference}`);
    return null;
  }
  
  const [, bookRaw, chapterStr, startVerseStr, endVerseStr] = match;
  const originalBook = bookRaw.trim();
  
  const englishBook = normalizeBookName(originalBook);
  if (!englishBook) {
    console.log(`Book not found in mapping: ${originalBook}`);
    return null;
  }

  return {
    originalBook,
    book: englishBook,
    chapter: parseInt(chapterStr),
    startVerse: startVerseStr ? parseInt(startVerseStr) : null,
    endVerse: endVerseStr ? parseInt(endVerseStr) : null,
  };
}

async function fetchVerseFromAPI(ref: ParsedReference): Promise<{ text: string; verses: string[] } | null> {
  // Format: "john 3:16" or "1corinthians 10:3-5"
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
        results.push({
          referencia: refString,
          texto: null,
          versiculos: []
        });
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
        results.push({
          referencia: formatReferenceTitle(parsed),
          texto: null,
          versiculos: []
        });
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
      JSON.stringify({ 
        error: 'Erro ao buscar versículo',
        texto: null,
        referencia: ''
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
