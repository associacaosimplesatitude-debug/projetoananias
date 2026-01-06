import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para remover tags HTML e limpar o texto
function stripHtmlTags(html: string | null | undefined): string | null {
  if (!html) return null;
  
  // Remove todas as tags HTML
  let text = html.replace(/<[^>]*>/g, '');
  
  // Decodifica entidades HTML comuns
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
  
  // Remove espaços múltiplos e quebras de linha extras
  text = text.replace(/\s+/g, ' ').trim();
  
  // Se o texto resultante for vazio ou muito curto, retorna null
  if (!text || text.length < 3) return null;
  
  return text;
}

// Função para extrair faixa etária do título do produto
function extractFaixaEtaria(titulo: string): string {
  const tituloLower = titulo.toLowerCase();
  
  // Mapeamento de padrões para faixas etárias
  const patterns = [
    { regex: /maternal|2\s*a\s*3\s*anos|02\s*a\s*03/i, faixa: 'Maternal: 2 a 3 Anos' },
    { regex: /jardim|4\s*a\s*6\s*anos|04\s*a\s*06/i, faixa: 'Jardim de Infância: 4 a 6 Anos' },
    { regex: /primári|7\s*a\s*8\s*anos|07\s*a\s*08/i, faixa: 'Primários: 7 a 8 Anos' },
    { regex: /junior|juniores|9\s*a\s*11\s*anos|09\s*a\s*11/i, faixa: 'Juniores: 9 a 11 Anos' },
    { regex: /adolescentes?\+|15\s*a\s*17\s*anos/i, faixa: 'Adolescentes+: 15 a 17 Anos' },
    { regex: /adolescente|12\s*a\s*14\s*anos/i, faixa: 'Adolescentes: 12 a 14 Anos' },
    { regex: /jovens?\s*(e|&)?\s*adultos?|adulto/i, faixa: 'Jovens e Adultos' },
    { regex: /infantil|criança|kids/i, faixa: 'Infantil' },
  ];
  
  for (const pattern of patterns) {
    if (pattern.regex.test(titulo)) {
      return pattern.faixa;
    }
  }
  
  return 'Geral';
}

// Função para extrair categoria do produto
function extractCategoria(titulo: string, tipoCategoria: string | undefined): string {
  const tituloLower = titulo.toLowerCase();
  
  // Prioridade para identificar pelo título
  if (tituloLower.includes('kit')) return 'Kits';
  if (tituloLower.includes('devocional')) return 'Devocionais';
  if (tituloLower.includes('revista') || tituloLower.includes('rev ') || tituloLower.includes('ebd')) return 'Revista EBD';
  if (tituloLower.includes('livro') || tituloLower.includes('comentário') || tituloLower.includes('comentario')) return 'Livros';
  
  // Se tem "P" como tipo e parece ser revista pelo contexto
  if (tipoCategoria === 'P') {
    if (tituloLower.includes('aluno') || tituloLower.includes('professor') || 
        tituloLower.includes('estudo bíblico') || tituloLower.includes('estudo biblico') ||
        tituloLower.includes('lições') || tituloLower.includes('licoes')) {
      return 'Revista EBD';
    }
  }
  
  // Fallback pela categoria do Bling
  if (tipoCategoria === 'Livros' || tipoCategoria === 'livros') return 'Livros';
  if (tipoCategoria === 'Revista EBD' || tipoCategoria === 'revistas') return 'Revista EBD';
  
  return 'Outros';
}

async function refreshTokenIfNeeded(supabase: any, config: any, forceRefresh: boolean = false) {
  const now = new Date();
  const expiresAt = config.token_expires_at ? new Date(config.token_expires_at) : null;
  
  // Renova se: forçado, token expirado, ou expira em menos de 30 minutos
  const isExpired = !expiresAt || expiresAt.getTime() <= now.getTime();
  const isNearExpiration = expiresAt && expiresAt.getTime() - now.getTime() < 30 * 60 * 1000;
  
  if (forceRefresh || isExpired || isNearExpiration) {
    console.log('Renovando token Bling...');
    console.log('Token próximo de expirar, renovando...');
    
    const credentials = btoa(`${config.client_id}:${config.client_secret}`);
    
    const tokenResponse = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: config.refresh_token,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('Resposta do refresh token:', JSON.stringify(tokenData));

    if (tokenResponse.ok && !tokenData.error) {
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + (tokenData.expires_in || 21600));

      await supabase
        .from('bling_config')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: newExpiresAt.toISOString(),
        })
        .eq('id', config.id);

      console.log('Token renovado com sucesso!');
      return tokenData.access_token;
    } else {
      console.error('Erro ao renovar token:', JSON.stringify(tokenData));
      throw new Error(`Falha ao renovar token: ${tokenData.error?.message || tokenData.error_description || 'Token inválido. Reconecte ao Bling.'}`);
    }
  }
  
  return config.access_token;
}

async function getProductStock(accessToken: string, productId: number, retryCount = 0): Promise<number> {
  try {
    const response = await fetch(
      `https://www.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${productId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    // Se for rate limit, tenta novamente após delay
    if (response.status === 429 && retryCount < 3) {
      console.log(`Rate limit no estoque, tentativa ${retryCount + 1}/3...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return getProductStock(accessToken, productId, retryCount + 1);
    }

    if (!response.ok) {
      console.log(`Erro ao buscar estoque do produto ${productId}: ${response.status}`);
      return 0;
    }

    const data = await response.json();
    const stockData = data.data || [];
    
    // Soma o saldo de todos os depósitos
    let totalStock = 0;
    for (const item of stockData) {
      totalStock += item.saldoFisicoTotal || 0;
    }
    
    return totalStock;
  } catch (error) {
    console.error(`Erro ao buscar estoque do produto ${productId}:`, error);
    return 0;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar configuração
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config) {
      throw new Error('Configuração não encontrada');
    }

    if (!config.access_token) {
      throw new Error('Token de acesso não configurado');
    }

    // Renovar token - sempre força refresh para garantir token válido
    const accessToken = await refreshTokenIfNeeded(supabase, config, true);

    // Buscar produtos do Bling (sem filtro) - com delay para evitar rate limit
    let allProducts: any[] = [];
    let page = 1;
    let hasMore = true;

    // Função helper para delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    while (hasMore) {
      console.log(`Buscando página ${page} de produtos...`);
      
      // Delay de 400ms entre requisições para respeitar rate limit (3 req/s)
      if (page > 1) {
        await delay(400);
      }
      
      const productsResponse = await fetch(
        `https://www.bling.com.br/Api/v3/produtos?pagina=${page}&limite=100`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!productsResponse.ok) {
        const errorText = await productsResponse.text();
        console.error('Erro na API Bling:', productsResponse.status, errorText);
        
        // Se for rate limit, espera e tenta novamente
        if (productsResponse.status === 429) {
          console.log('Rate limit atingido, aguardando 2 segundos...');
          await delay(2000);
          continue;
        }
        
        throw new Error(`Erro ao buscar produtos: ${productsResponse.status}`);
      }

      const data = await productsResponse.json();
      const products = data.data || [];
      
      allProducts = [...allProducts, ...products];
      
      // Verificar se há mais páginas
      hasMore = products.length === 100;
      page++;

      // Limite de segurança
      if (page > 50) {
        console.log('Limite de páginas atingido');
        break;
      }
    }

    console.log(`Total de produtos encontrados: ${allProducts.length}`);

    const syncTimestamp = new Date().toISOString();
    let updatedCount = 0;
    let processedCount = 0;

    for (const product of allProducts) {
      // Por enquanto, sincroniza todos os produtos
      const isRevista = product.nome?.toLowerCase().includes('revista') || 
                        product.tipo === 'P' || 
                        true;

      if (isRevista) {
        // Delay para respeitar rate limit (a cada 3 produtos)
        if (processedCount > 0 && processedCount % 3 === 0) {
          await delay(400);
        }
        processedCount++;
        
        // Buscar estoque do produto
        const estoque = await getProductStock(accessToken, product.id);

        // Verificar se já existe pelo bling_produto_id
        const { data: existingById } = await supabase
          .from('ebd_revistas')
          .select('id')
          .eq('bling_produto_id', product.id)
          .maybeSingle();

        // Buscar pelo título usando ILIKE para match mais flexível
        let existingByTitle = null;
        if (!existingById && product.nome) {
          const { data: byTitle } = await supabase
            .from('ebd_revistas')
            .select('id')
            .ilike('titulo', product.nome)
            .maybeSingle();
          existingByTitle = byTitle;
          
          // Se não achou exato, tentar buscar parcial (primeiras 50 chars)
          if (!existingByTitle) {
            const searchTerm = product.nome.substring(0, 50);
            const { data: byPartialTitle } = await supabase
              .from('ebd_revistas')
              .select('id')
              .ilike('titulo', `%${searchTerm}%`)
              .maybeSingle();
            existingByTitle = byPartialTitle;
          }
        }

        const existing = existingById || existingByTitle;

        // Extrair categoria e faixa etária do título do produto
        const titulo = product.nome || 'Sem título';
        const faixaEtaria = extractFaixaEtaria(titulo);
        const categoria = extractCategoria(titulo, product.tipo || product.categoria?.descricao);

        const revistaData = {
          titulo: titulo,
          preco_cheio: product.preco || 0,
          faixa_etaria_alvo: faixaEtaria,
          imagem_url: product.imagemURL || null,
          sinopse: stripHtmlTags(product.descricaoCurta),
          estoque: estoque,
          categoria: categoria,
          bling_produto_id: product.id,
          last_sync_at: syncTimestamp,
          peso_bruto: product.pesoBruto || product.peso || 0,
        };

        if (existing) {
          // Atualizar
          await supabase
            .from('ebd_revistas')
            .update(revistaData)
            .eq('id', existing.id);
        } else {
          // Inserir
          await supabase
            .from('ebd_revistas')
            .insert(revistaData);
        }
        
        updatedCount++;
      }
    }

    console.log(`Produtos atualizados: ${updatedCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: updatedCount,
        total_bling: allProducts.length,
        sync_timestamp: syncTimestamp
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
