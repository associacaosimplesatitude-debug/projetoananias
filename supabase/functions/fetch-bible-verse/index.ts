import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bible book abbreviations mapping for the API
const bookAbbreviations: Record<string, string> = {
  "genesis": "gn", "gênesis": "gn", "gn": "gn",
  "exodus": "ex", "êxodo": "ex", "ex": "ex",
  "leviticus": "lv", "levítico": "lv", "lv": "lv",
  "numbers": "nm", "números": "nm", "nm": "nm",
  "deuteronomy": "dt", "deuteronômio": "dt", "dt": "dt",
  "joshua": "js", "josué": "js", "js": "js",
  "judges": "jz", "juízes": "jz", "jz": "jz",
  "ruth": "rt", "rute": "rt", "rt": "rt",
  "1samuel": "1sm", "1 samuel": "1sm", "1sm": "1sm",
  "2samuel": "2sm", "2 samuel": "2sm", "2sm": "2sm",
  "1kings": "1rs", "1 reis": "1rs", "1rs": "1rs",
  "2kings": "2rs", "2 reis": "2rs", "2rs": "2rs",
  "1chronicles": "1cr", "1 crônicas": "1cr", "1cr": "1cr",
  "2chronicles": "2cr", "2 crônicas": "2cr", "2cr": "2cr",
  "ezra": "ed", "esdras": "ed", "ed": "ed",
  "nehemiah": "ne", "neemias": "ne", "ne": "ne",
  "esther": "et", "ester": "et", "et": "et",
  "job": "jó", "jó": "jó",
  "psalms": "sl", "salmos": "sl", "sl": "sl", "salmo": "sl",
  "proverbs": "pv", "provérbios": "pv", "pv": "pv",
  "ecclesiastes": "ec", "eclesiastes": "ec", "ec": "ec",
  "songofsolomon": "ct", "cânticos": "ct", "cantares": "ct", "ct": "ct",
  "isaiah": "is", "isaías": "is", "is": "is",
  "jeremiah": "jr", "jeremias": "jr", "jr": "jr",
  "lamentations": "lm", "lamentações": "lm", "lm": "lm",
  "ezekiel": "ez", "ezequiel": "ez", "ez": "ez",
  "daniel": "dn", "dn": "dn",
  "hosea": "os", "oseias": "os", "oséias": "os", "os": "os",
  "joel": "jl", "jl": "jl",
  "amos": "am", "amós": "am", "am": "am",
  "obadiah": "ob", "obadias": "ob", "ob": "ob",
  "jonah": "jn", "jonas": "jn",
  "micah": "mq", "miqueias": "mq", "miquéias": "mq", "mq": "mq",
  "nahum": "na", "naum": "na", "na": "na",
  "habakkuk": "hc", "habacuque": "hc", "hc": "hc",
  "zephaniah": "sf", "sofonias": "sf", "sf": "sf",
  "haggai": "ag", "ageu": "ag", "ag": "ag",
  "zechariah": "zc", "zacarias": "zc", "zc": "zc",
  "malachi": "ml", "malaquias": "ml", "ml": "ml",
  "matthew": "mt", "mateus": "mt", "mt": "mt",
  "mark": "mc", "marcos": "mc", "mc": "mc",
  "luke": "lc", "lucas": "lc", "lc": "lc",
  "john": "jo", "joão": "jo", "jo": "jo",
  "acts": "at", "atos": "at", "at": "at",
  "romans": "rm", "romanos": "rm", "rm": "rm",
  "1corinthians": "1co", "1 coríntios": "1co", "1co": "1co",
  "2corinthians": "2co", "2 coríntios": "2co", "2co": "2co",
  "galatians": "gl", "gálatas": "gl", "gl": "gl",
  "ephesians": "ef", "efésios": "ef", "ef": "ef",
  "philippians": "fp", "filipenses": "fp", "fp": "fp",
  "colossians": "cl", "colossenses": "cl", "cl": "cl",
  "1thessalonians": "1ts", "1 tessalonicenses": "1ts", "1ts": "1ts",
  "2thessalonians": "2ts", "2 tessalonicenses": "2ts", "2ts": "2ts",
  "1timothy": "1tm", "1 timóteo": "1tm", "1tm": "1tm",
  "2timothy": "2tm", "2 timóteo": "2tm", "2tm": "2tm",
  "titus": "tt", "tito": "tt", "tt": "tt",
  "philemon": "fm", "filemom": "fm", "fm": "fm",
  "hebrews": "hb", "hebreus": "hb", "hb": "hb",
  "james": "tg", "tiago": "tg", "tg": "tg",
  "1peter": "1pe", "1 pedro": "1pe", "1pe": "1pe",
  "2peter": "2pe", "2 pedro": "2pe", "2pe": "2pe",
  "1john": "1jo", "1 joão": "1jo", "1jo": "1jo",
  "2john": "2jo", "2 joão": "2jo", "2jo": "2jo",
  "3john": "3jo", "3 joão": "3jo", "3jo": "3jo",
  "jude": "jd", "judas": "jd", "jd": "jd",
  "revelation": "ap", "apocalipse": "ap", "ap": "ap",
};

function normalizeBookName(book: string): string {
  const normalized = book.toLowerCase().trim();
  return bookAbbreviations[normalized] || normalized;
}

interface ParsedReference {
  book: string;
  chapter: number;
  startVerse: number | null;
  endVerse: number | null;
}

function parseReference(reference: string): ParsedReference | null {
  // Handle formats like "Êxodo 14.14", "Josué 6", "2 Coríntios 10.3-5"
  const cleaned = reference.trim();
  
  // Match book name (can include number prefix like "1 Samuel", "2 Coríntios")
  const match = cleaned.match(/^(\d?\s*[A-Za-zÀ-ÿ]+)\s+(\d+)(?:[.:](\d+))?(?:-(\d+))?$/i);
  
  if (!match) {
    console.log(`Could not parse reference: ${reference}`);
    return null;
  }
  
  const [, book, chapterStr, startVerseStr, endVerseStr] = match;
  
  return {
    book: book.trim(),
    chapter: parseInt(chapterStr),
    startVerse: startVerseStr ? parseInt(startVerseStr) : null,
    endVerse: endVerseStr ? parseInt(endVerseStr) : null,
  };
}

async function fetchVerseFromAPI(ref: ParsedReference): Promise<string | null> {
  const bookAbbr = normalizeBookName(ref.book);
  
  // Using ARC (Almeida Revista e Corrigida) version
  const apiUrl = `https://www.abibliadigital.com.br/api/verses/arc/${bookAbbr}/${ref.chapter}`;
  
  console.log(`Fetching from API: ${apiUrl}`);
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.error(`Bible API error for ${ref.book} ${ref.chapter}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    let verses = data.verses || [];
    
    // Filter to specific verses if provided
    if (ref.startVerse !== null) {
      const startV = ref.startVerse;
      const endV = ref.endVerse;
      verses = verses.filter((v: any) => {
        const verseNum = v.number;
        if (endV !== null) {
          return verseNum >= startV && verseNum <= endV;
        }
        return verseNum === startV;
      });
    }

    if (verses.length === 0) {
      return null;
    }

    // Format the text
    const verseText = verses.map((v: any) => `${v.number} ${v.text}`).join(' ');
    return verseText;
  } catch (error) {
    console.error(`Error fetching verse ${ref.book} ${ref.chapter}:`, error);
    return null;
  }
}

function formatReferenceTitle(ref: ParsedReference): string {
  let title = `${ref.book} ${ref.chapter}`;
  if (ref.startVerse !== null) {
    title += `.${ref.startVerse}`;
    if (ref.endVerse !== null) {
      title += `-${ref.endVerse}`;
    }
  }
  return title;
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Combine livro and versiculo or use livro as full reference
    let fullReference = '';
    if (livro && versiculo) {
      fullReference = `${livro} ${versiculo}`;
    } else {
      fullReference = livro || versiculo;
    }
    
    console.log(`Processing reference: ${fullReference}`);

    // Split multiple references by semicolon
    const references = fullReference.split(';').map(r => r.trim()).filter(r => r.length > 0);
    
    console.log(`Found ${references.length} references to fetch`);

    const results: { referencia: string; texto: string }[] = [];
    
    for (const refString of references) {
      const parsed = parseReference(refString);
      
      if (!parsed) {
        results.push({
          referencia: refString,
          texto: `Leia ${refString}`
        });
        continue;
      }
      
      const verseText = await fetchVerseFromAPI(parsed);
      
      if (verseText) {
        results.push({
          referencia: formatReferenceTitle(parsed),
          texto: verseText
        });
      } else {
        results.push({
          referencia: formatReferenceTitle(parsed),
          texto: `Leia ${formatReferenceTitle(parsed)} na sua Bíblia.`
        });
      }
    }
    
    // Combine all results
    const combinedText = results.map(r => `**${r.referencia}**\n${r.texto}`).join('\n\n');
    const allReferences = results.map(r => r.referencia).join('; ');
    
    console.log(`Successfully processed ${results.length} references`);
    
    return new Response(
      JSON.stringify({ 
        texto: combinedText,
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
        texto: 'Consulte sua Bíblia para ler o texto.',
        referencia: ''
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
