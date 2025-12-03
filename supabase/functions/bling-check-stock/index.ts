import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Buscar estoque de todos os produtos em uma única chamada
    const produtoIds = produtosValidos.map((p: any) => p.bling_produto_id);
    const idsQuery = produtoIds.map((id: number) => `idsProdutos[]=${id}`).join('&');
    
    console.log(`Verificando estoque dos produtos: ${produtoIds.join(', ')}`);

    const stockResponse = await fetch(
      `https://www.bling.com.br/Api/v3/estoques/saldos?${idsQuery}`,
      {
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!stockResponse.ok) {
      const errorText = await stockResponse.text();
      console.error('Erro na API Bling:', stockResponse.status, errorText);
      throw new Error(`Erro ao verificar estoque: ${stockResponse.status}`);
    }

    const data = await stockResponse.json();
    const estoques = data.data || [];

    // Mapear estoque por produto
    const estoqueMap: { [key: number]: number } = {};
    for (const item of estoques) {
      const produtoId = item.produto?.id;
      if (produtoId) {
        // Calcular estoque geral (soma de todos os depósitos)
        let estoqueGeral = 0;
        if (item.saldos) {
          estoqueGeral = item.saldos.reduce((acc: number, saldo: any) => {
            return acc + (saldo.saldoFisicoTotal || 0);
          }, 0);
        }
        estoqueMap[produtoId] = estoqueGeral;
      }
    }

    // Verificar se todos os produtos têm estoque suficiente
    const resultados = produtosValidos.map((p: any) => {
      const estoqueDisponivel = estoqueMap[p.bling_produto_id] || 0;
      const quantidadeSolicitada = p.quantidade || 1;
      const temEstoque = estoqueDisponivel >= quantidadeSolicitada;
      
      console.log(`Produto ${p.bling_produto_id}: estoque=${estoqueDisponivel}, solicitado=${quantidadeSolicitada}, ok=${temEstoque}`);
      
      return {
        bling_produto_id: p.bling_produto_id,
        titulo: p.titulo || '',
        estoque_disponivel: estoqueDisponivel,
        quantidade_solicitada: quantidadeSolicitada,
        tem_estoque: temEstoque,
      };
    });

    const todosTemEstoque = resultados.every((r: any) => r.tem_estoque);
    const produtosSemEstoque = resultados.filter((r: any) => !r.tem_estoque);

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
