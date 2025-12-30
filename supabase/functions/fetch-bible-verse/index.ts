import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bible book name mapping for bible-api.com (uses English names)
const bookNameToEnglish: Record<string, string> = {
  "gênesis": "genesis", "genesis": "genesis", "gn": "genesis",
  "êxodo": "exodus", "exodo": "exodus", "ex": "exodus",
  "levítico": "leviticus", "levitico": "leviticus", "lv": "leviticus",
  "números": "numbers", "numeros": "numbers", "nm": "numbers",
  "deuteronômio": "deuteronomy", "deuteronomio": "deuteronomy", "dt": "deuteronomy",
  "josué": "joshua", "josue": "joshua", "js": "joshua",
  "juízes": "judges", "juizes": "judges", "jz": "judges",
  "rute": "ruth", "rt": "ruth",
  "1 samuel": "1samuel", "1samuel": "1samuel", "1sm": "1samuel",
  "2 samuel": "2samuel", "2samuel": "2samuel", "2sm": "2samuel",
  "1 reis": "1kings", "1reis": "1kings", "1rs": "1kings",
  "2 reis": "2kings", "2reis": "2kings", "2rs": "2kings",
  "1 crônicas": "1chronicles", "1cronicas": "1chronicles", "1cr": "1chronicles",
  "2 crônicas": "2chronicles", "2cronicas": "2chronicles", "2cr": "2chronicles",
  "esdras": "ezra", "ed": "ezra",
  "neemias": "nehemiah", "ne": "nehemiah",
  "ester": "esther", "et": "esther",
  "jó": "job", "jo": "job",
  "salmos": "psalms", "salmo": "psalms", "sl": "psalms",
  "provérbios": "proverbs", "proverbios": "proverbs", "pv": "proverbs",
  "eclesiastes": "ecclesiastes", "ec": "ecclesiastes",
  "cânticos": "songofsolomon", "cantares": "songofsolomon", "ct": "songofsolomon",
  "isaías": "isaiah", "isaias": "isaiah", "is": "isaiah",
  "jeremias": "jeremiah", "jr": "jeremiah",
  "lamentações": "lamentations", "lamentacoes": "lamentations", "lm": "lamentations",
  "ezequiel": "ezekiel", "ez": "ezekiel",
  "daniel": "daniel", "dn": "daniel",
  "oseias": "hosea", "oséias": "hosea", "os": "hosea",
  "joel": "joel", "jl": "joel",
  "amós": "amos", "amos": "amos", "am": "amos",
  "obadias": "obadiah", "ob": "obadiah",
  "jonas": "jonah", "jn": "jonah",
  "miqueias": "micah", "miquéias": "micah", "mq": "micah",
  "naum": "nahum", "na": "nahum",
  "habacuque": "habakkuk", "hc": "habakkuk",
  "sofonias": "zephaniah", "sf": "zephaniah",
  "ageu": "haggai", "ag": "haggai",
  "zacarias": "zechariah", "zc": "zechariah",
  "malaquias": "malachi", "ml": "malachi",
  "mateus": "matthew", "mt": "matthew",
  "marcos": "mark", "mc": "mark",
  "lucas": "luke", "lc": "luke",
  "joão": "john", "joao": "john",
  "atos": "acts", "at": "acts",
  "romanos": "romans", "rm": "romans",
  "1 coríntios": "1corinthians", "1corintios": "1corinthians", "1co": "1corinthians",
  "2 coríntios": "2corinthians", "2corintios": "2corinthians", "2co": "2corinthians",
  "gálatas": "galatians", "galatas": "galatians", "gl": "galatians",
  "efésios": "ephesians", "efesios": "ephesians", "ef": "ephesians",
  "filipenses": "philippians", "fp": "philippians",
  "colossenses": "colossians", "cl": "colossians",
  "1 tessalonicenses": "1thessalonians", "1tessalonicenses": "1thessalonians", "1ts": "1thessalonians",
  "2 tessalonicenses": "2thessalonians", "2tessalonicenses": "2thessalonians", "2ts": "2thessalonians",
  "1 timóteo": "1timothy", "1timoteo": "1timothy", "1tm": "1timothy",
  "2 timóteo": "2timothy", "2timoteo": "2timothy", "2tm": "2timothy",
  "tito": "titus", "tt": "titus",
  "filemom": "philemon", "fm": "philemon",
  "hebreus": "hebrews", "hb": "hebrews",
  "tiago": "james", "tg": "james",
  "1 pedro": "1peter", "1pedro": "1peter", "1pe": "1peter",
  "2 pedro": "2peter", "2pedro": "2peter", "2pe": "2peter",
  "1 joão": "1john", "1joao": "1john", "1jo": "1john",
  "2 joão": "2john", "2joao": "2john", "2jo": "2john",
  "3 joão": "3john", "3joao": "3john", "3jo": "3john",
  "judas": "jude", "jd": "jude",
  "apocalipse": "revelation", "ap": "revelation",
};

function normalizeBookName(book: string): string {
  const normalized = book.toLowerCase().trim();
  return bookNameToEnglish[normalized] || normalized;
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
  
  // Match book name (can include number prefix like "1 Samuel", "2 Coríntios")
  const match = cleaned.match(/^(\d?\s*[A-Za-zÀ-ÿ]+)\s+(\d+)(?:[.:](\d+))?(?:-(\d+))?$/i);
  
  if (!match) {
    console.log(`Could not parse reference: ${reference}`);
    return null;
  }
  
  const [, book, chapterStr, startVerseStr, endVerseStr] = match;
  const originalBook = book.trim();
  
  return {
    originalBook,
    book: normalizeBookName(originalBook),
    chapter: parseInt(chapterStr),
    startVerse: startVerseStr ? parseInt(startVerseStr) : null,
    endVerse: endVerseStr ? parseInt(endVerseStr) : null,
  };
}

async function fetchVerseFromAPI(ref: ParsedReference): Promise<{ text: string; verses: string[] } | null> {
  // Build the reference string for bible-api.com
  // Format: "john 3:16" or "john 3:16-18"
  let refString = `${ref.book}${ref.chapter}`;
  if (ref.startVerse !== null) {
    refString += `:${ref.startVerse}`;
    if (ref.endVerse !== null) {
      refString += `-${ref.endVerse}`;
    }
  }
  
  // Using bible-api.com with Almeida version (almeida)
  const apiUrl = `https://bible-api.com/${encodeURIComponent(refString)}?translation=almeida`;
  
  console.log(`Fetching from API: ${apiUrl}`);
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      }
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

    // bible-api.com returns verses array with { book_name, chapter, verse, text }
    const verses = data.verses || [];
    
    if (verses.length === 0 && data.text) {
      // Some responses return just text
      return {
        text: data.text.trim(),
        verses: [data.text.trim()]
      };
    }

    if (verses.length === 0) {
      return null;
    }

    // Format each verse on its own line
    const verseTexts = verses.map((v: any) => v.text.trim());
    const combinedText = verseTexts.join('\n\n');
    
    return {
      text: combinedText,
      verses: verseTexts
    };
  } catch (error) {
    console.error(`Error fetching verse ${refString}:`, error);
    return null;
  }
}

function formatReferenceTitle(ref: ParsedReference): string {
  let title = `${ref.originalBook} ${ref.chapter}`;
  if (ref.startVerse !== null) {
    title += `.${ref.startVerse}`;
    if (ref.endVerse !== null) {
      title += `-${ref.endVerse}`;
    }
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

    const results: { referencia: string; texto: string; versiculos: string[] }[] = [];
    
    for (const refString of references) {
      const parsed = parseReference(refString);
      
      if (!parsed) {
        results.push({
          referencia: refString,
          texto: `Referência não reconhecida: ${refString}`,
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
          texto: `Texto não disponível para ${formatReferenceTitle(parsed)}. Consulte sua Bíblia.`,
          versiculos: []
        });
      }
    }
    
    // Combine all results with clear separation
    const combinedText = results.map(r => {
      if (results.length > 1) {
        return `📖 ${r.referencia}\n\n${r.texto}`;
      }
      return r.texto;
    }).join('\n\n---\n\n');
    
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
        texto: 'Não foi possível carregar o texto. Consulte sua Bíblia.',
        referencia: ''
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
