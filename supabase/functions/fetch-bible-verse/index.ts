import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bible book abbreviations mapping for the API
const bookAbbreviations: Record<string, string> = {
  "genesis": "gn", "gênesis": "gn",
  "exodus": "ex", "êxodo": "ex",
  "leviticus": "lv", "levítico": "lv",
  "numbers": "nm", "números": "nm",
  "deuteronomy": "dt", "deuteronômio": "dt",
  "joshua": "js", "josué": "js",
  "judges": "jz", "juízes": "jz",
  "ruth": "rt", "rute": "rt",
  "1samuel": "1sm", "1 samuel": "1sm",
  "2samuel": "2sm", "2 samuel": "2sm",
  "1kings": "1rs", "1 reis": "1rs",
  "2kings": "2rs", "2 reis": "2rs",
  "1chronicles": "1cr", "1 crônicas": "1cr",
  "2chronicles": "2cr", "2 crônicas": "2cr",
  "ezra": "ed", "esdras": "ed",
  "nehemiah": "ne", "neemias": "ne",
  "esther": "et", "ester": "et",
  "job": "jó", "jó": "jó",
  "psalms": "sl", "salmos": "sl",
  "proverbs": "pv", "provérbios": "pv",
  "ecclesiastes": "ec", "eclesiastes": "ec",
  "songofsolomon": "ct", "cânticos": "ct", "cantares": "ct",
  "isaiah": "is", "isaías": "is",
  "jeremiah": "jr", "jeremias": "jr",
  "lamentations": "lm", "lamentações": "lm",
  "ezekiel": "ez", "ezequiel": "ez",
  "daniel": "dn",
  "hosea": "os", "oseias": "os", "oséias": "os",
  "joel": "jl",
  "amos": "am", "amós": "am",
  "obadiah": "ob", "obadias": "ob",
  "jonah": "jn", "jonas": "jn",
  "micah": "mq", "miqueias": "mq", "miquéias": "mq",
  "nahum": "na", "naum": "na",
  "habakkuk": "hc", "habacuque": "hc",
  "zephaniah": "sf", "sofonias": "sf",
  "haggai": "ag", "ageu": "ag",
  "zechariah": "zc", "zacarias": "zc",
  "malachi": "ml", "malaquias": "ml",
  "matthew": "mt", "mateus": "mt",
  "mark": "mc", "marcos": "mc",
  "luke": "lc", "lucas": "lc",
  "john": "jo", "joão": "jo",
  "acts": "at", "atos": "at",
  "romans": "rm", "romanos": "rm",
  "1corinthians": "1co", "1 coríntios": "1co",
  "2corinthians": "2co", "2 coríntios": "2co",
  "galatians": "gl", "gálatas": "gl",
  "ephesians": "ef", "efésios": "ef",
  "philippians": "fp", "filipenses": "fp",
  "colossians": "cl", "colossenses": "cl",
  "1thessalonians": "1ts", "1 tessalonicenses": "1ts",
  "2thessalonians": "2ts", "2 tessalonicenses": "2ts",
  "1timothy": "1tm", "1 timóteo": "1tm",
  "2timothy": "2tm", "2 timóteo": "2tm",
  "titus": "tt", "tito": "tt",
  "philemon": "fm", "filemom": "fm",
  "hebrews": "hb", "hebreus": "hb",
  "james": "tg", "tiago": "tg",
  "1peter": "1pe", "1 pedro": "1pe",
  "2peter": "2pe", "2 pedro": "2pe",
  "1john": "1jo", "1 joão": "1jo",
  "2john": "2jo", "2 joão": "2jo",
  "3john": "3jo", "3 joão": "3jo",
  "jude": "jd", "judas": "jd",
  "revelation": "ap", "apocalipse": "ap",
};

function normalizeBookName(book: string): string {
  const normalized = book.toLowerCase().trim();
  return bookAbbreviations[normalized] || normalized;
}

function parseVerseReference(versiculo: string): { chapter: number; startVerse: number; endVerse: number | null } {
  // Handle formats like "3.22-23", "3:22-23", "3.22", "3:22"
  const cleanRef = versiculo.replace(/\s/g, '');
  
  // Split by . or :
  const [chapterPart, versePart] = cleanRef.split(/[.:]/);
  const chapter = parseInt(chapterPart);
  
  if (!versePart) {
    return { chapter, startVerse: 1, endVerse: null };
  }
  
  // Check for verse range (e.g., "22-23")
  if (versePart.includes('-')) {
    const [start, end] = versePart.split('-').map(v => parseInt(v));
    return { chapter, startVerse: start, endVerse: end };
  }
  
  return { chapter, startVerse: parseInt(versePart), endVerse: null };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { livro, versiculo } = await req.json();
    
    if (!livro || !versiculo) {
      return new Response(
        JSON.stringify({ error: 'Livro e versículo são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching verse: ${livro} ${versiculo}`);

    const bookAbbr = normalizeBookName(livro);
    const { chapter, startVerse, endVerse } = parseVerseReference(versiculo);

    // Use the ABP (A Bíblia para Todos) API or similar free Bible API
    // Using Bible API that supports Portuguese (NVI version)
    const apiUrl = `https://www.abibliadigital.com.br/api/verses/nvi/${bookAbbr}/${chapter}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.error(`Bible API error: ${response.status}`);
      // Return a fallback message when API fails
      return new Response(
        JSON.stringify({ 
          texto: `Leia ${livro} ${versiculo}`,
          referencia: `${livro} ${versiculo}`,
          error: 'Não foi possível carregar o texto. Consulte sua Bíblia.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Extract the specific verses
    let verses = data.verses || [];
    if (startVerse) {
      verses = verses.filter((v: any) => {
        const verseNum = v.number;
        if (endVerse) {
          return verseNum >= startVerse && verseNum <= endVerse;
        }
        return verseNum === startVerse;
      });
    }

    const texto = verses.map((v: any) => `${v.number} ${v.text}`).join(' ');
    
    return new Response(
      JSON.stringify({ 
        texto: texto || `Leia ${livro} ${versiculo}`,
        referencia: `${livro} ${versiculo}`,
        versiculos: verses
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
