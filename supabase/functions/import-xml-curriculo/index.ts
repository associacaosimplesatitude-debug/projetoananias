import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractTextBetween(text: string, start: string, end: string): string {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) return '';
  const actualStart = startIndex + start.length;
  const endIndex = text.indexOf(end, actualStart);
  if (endIndex === -1) return '';
  return text.substring(actualStart, endIndex).trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Read the XML file
    const xmlText = await Deno.readTextFile('/var/task/public/GOOGLESHOP-2.xml');
    
    // Split by entries
    const entries = xmlText.split('<entry>').slice(1); // Skip first empty element
    const imported: any[] = [];

    for (const entry of entries) {
      if (!entry.trim()) continue;

      const title = extractTextBetween(entry, '<g:title>', '</g:title>');
      const description = extractTextBetween(entry, '<g:description>', '</g:description>');
      const price = extractTextBetween(entry, '<g:price>', '</g:price>');
      const imageLink = extractTextBetween(entry, '<g:image_link>', '</g:image_link>');
      const brand = extractTextBetween(entry, '<g:brand>', '</g:brand>');
      
      if (!title) continue; // Skip if no title
      
      // Extract numeric price
      const priceValue = parseFloat(price.replace(/[^\d.]/g, '')) || 0;
      
      // Determine age range based on title/description
      let ageRange = 'Adultos';
      const lowerTitle = title.toLowerCase();
      const lowerDesc = description.toLowerCase();
      
      if (lowerTitle.includes('infantil') || lowerTitle.includes('criança') || 
          lowerDesc.includes('infantil') || lowerDesc.includes('criança')) {
        ageRange = 'Infantil (4-6 anos)';
      } else if (lowerTitle.includes('jovem') || lowerTitle.includes('adolescente') ||
                 lowerDesc.includes('jovem') || lowerDesc.includes('adolescente')) {
        ageRange = 'Jovens (13-17 anos)';
      } else if (lowerTitle.includes('juvenil') || lowerDesc.includes('juvenil')) {
        ageRange = 'Juvenis (11-12 anos)';
      }

      // Insert revista
      const { data: revista, error: revistaError } = await supabaseClient
        .from('ebd_revistas')
        .insert({
          titulo: title,
          sinopse: description.substring(0, 1000), // Limit to 1000 chars
          autor: brand || 'Editora Central Gospel',
          preco_cheio: priceValue,
          imagem_url: imageLink,
          faixa_etaria_alvo: ageRange,
          num_licoes: 13
        })
        .select()
        .single();

      if (revistaError) {
        console.error('Error inserting revista:', revistaError);
        continue;
      }

      // Create 13 generic lessons for this revista
      const lessons = [];
      const startDate = new Date();
      
      for (let j = 1; j <= 13; j++) {
        const lessonDate = new Date(startDate);
        lessonDate.setDate(lessonDate.getDate() + (j - 1) * 7); // Weekly intervals
        
        lessons.push({
          revista_id: revista.id,
          titulo: `Lição ${j}`,
          numero_licao: j,
          data_aula: lessonDate.toISOString().split('T')[0],
          publicada: true,
          conteudo: `Conteúdo da Lição ${j} - ${title}`,
          church_id: null // Global lesson
        });
      }

      const { error: licoesError } = await supabaseClient
        .from('ebd_licoes')
        .insert(lessons);

      if (licoesError) {
        console.error('Error inserting lessons:', licoesError);
      }

      imported.push({
        revista: title,
        licoes: 13,
        preco: priceValue
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Importadas ${imported.length} revistas com suas lições`,
        total: imported.length,
        sample: imported.slice(0, 5) // Show first 5
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
