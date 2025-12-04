import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para renovar o token do Bling
async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log('Renovando token do Bling...');
  
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

  if (!tokenResponse.ok || tokenData.error) {
    console.error('Erro ao renovar token:', tokenData);
    throw new Error(tokenData.error_description || 'Erro ao renovar token do Bling');
  }

  // Calcular nova expiração
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  // Atualizar tokens no banco
  const { error: updateError } = await supabase
    .from('bling_config')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', config.id);

  if (updateError) {
    console.error('Erro ao salvar tokens:', updateError);
    throw new Error('Erro ao salvar tokens renovados');
  }

  console.log('Token renovado com sucesso! Expira em:', expiresAt.toISOString());
  return tokenData.access_token;
}

// Função para verificar se o token está expirado ou próximo de expirar
function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  // Considera expirado se faltam menos de 5 minutos
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Suporta tanto produto único quanto array de produtos
    const produtos = body.produtos || (body.produto_id ? [{ bling_produto_id: body.produto_id, quantidade: 1 }] : null);

    if (!produtos || produtos.length === 0) {
      throw new Error('produtos ou produto_id é obrigatório');
    }

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

    // Verificar se o token está expirado e renovar se necessário
    let accessToken = config.access_token;
    if (isTokenExpired(config.token_expires_at)) {
      console.log('Token expirado ou próximo de expirar, renovando...');
      accessToken = await refreshBlingToken(supabase, config);
    }

    // Filtrar produtos com bling_produto_id válido
    const produtosValidos = produtos.filter((p: any) => p.bling_produto_id && p.bling_produto_id > 0);
    
    if (produtosValidos.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          estoqueDisponivel: true,
          produtos: [],
          message: 'Nenhum produto com ID Bling válido para verificar'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar estoque de cada produto individualmente para garantir precisão
    const resultados = [];
    
    for (const produto of produtosValidos) {
      const produtoId = produto.bling_produto_id;
      const quantidadeSolicitada = produto.quantidade || 1;
      
      console.log(`Verificando estoque do produto ID: ${produtoId}`);
      
      // Primeiro, buscar informações do produto para confirmar que existe
      const productResponse = await fetch(
        `https://www.bling.com.br/Api/v3/produtos/${produtoId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        }
      );
      
      if (!productResponse.ok) {
        console.error(`Produto ${produtoId} não encontrado no Bling:`, productResponse.status);
        resultados.push({
          bling_produto_id: produtoId,
          titulo: produto.titulo || '',
          estoque_disponivel: 0,
          quantidade_solicitada: quantidadeSolicitada,
          tem_estoque: false,
          erro: 'Produto não encontrado no Bling'
        });
        continue;
      }
      
      const productData = await productResponse.json();
      console.log(`Produto encontrado: ${productData.data?.nome || 'sem nome'}`);
      
      // Agora buscar o estoque do produto
      const stockResponse = await fetch(
        `https://www.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${produtoId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!stockResponse.ok) {
        const errorText = await stockResponse.text();
        console.error(`Erro ao buscar estoque do produto ${produtoId}:`, stockResponse.status, errorText);
        
        // Tentar usar o estoque do próprio produto
        const estoqueFromProduct = productData.data?.estoque?.saldoVirtualTotal || 0;
        console.log(`Usando estoque do produto: ${estoqueFromProduct}`);
        
        resultados.push({
          bling_produto_id: produtoId,
          titulo: produto.titulo || productData.data?.nome || '',
          estoque_disponivel: estoqueFromProduct,
          quantidade_solicitada: quantidadeSolicitada,
          tem_estoque: estoqueFromProduct >= quantidadeSolicitada,
        });
        continue;
      }

      const stockData = await stockResponse.json();
      console.log(`Resposta de estoque para ${produtoId}:`, JSON.stringify(stockData));
      
      // Calcular estoque total
      let estoqueTotal = 0;
      const estoques = stockData.data || [];
      
      for (const item of estoques) {
        if (item.produto?.id === produtoId || item.produto?.id === Number(produtoId)) {
          if (item.saldos && Array.isArray(item.saldos)) {
            for (const saldo of item.saldos) {
              estoqueTotal += (saldo.saldoFisicoTotal || 0);
            }
          }
        }
      }
      
      // Se não encontrou no endpoint de estoques, usar o estoque do produto
      if (estoqueTotal === 0 && productData.data?.estoque) {
        estoqueTotal = productData.data.estoque.saldoVirtualTotal || 
                       productData.data.estoque.saldoFisicoTotal || 0;
        console.log(`Usando estoque alternativo do produto: ${estoqueTotal}`);
      }
      
      console.log(`Produto ${produtoId}: estoque=${estoqueTotal}, solicitado=${quantidadeSolicitada}`);
      
      resultados.push({
        bling_produto_id: produtoId,
        titulo: produto.titulo || productData.data?.nome || '',
        estoque_disponivel: estoqueTotal,
        quantidade_solicitada: quantidadeSolicitada,
        tem_estoque: estoqueTotal >= quantidadeSolicitada,
      });
    }

    const todosTemEstoque = resultados.every((r: any) => r.tem_estoque);
    const produtosSemEstoque = resultados.filter((r: any) => !r.tem_estoque);

    console.log(`Resultado final: todosTemEstoque=${todosTemEstoque}, produtosSemEstoque=${produtosSemEstoque.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        estoqueDisponivel: todosTemEstoque,
        produtos: resultados,
        produtosSemEstoque: produtosSemEstoque,
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
