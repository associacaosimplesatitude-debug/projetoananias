import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { resgate_id } = await req.json();

    if (!resgate_id) {
      throw new Error('resgate_id é obrigatório');
    }

    console.log('[APROVAR-RESGATE] Iniciando aprovação do resgate:', resgate_id);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar o resgate com dados do autor
    const { data: resgate, error: resgateError } = await supabase
      .from('royalties_resgates')
      .select(`
        *,
        autor:royalties_autores(
          id,
          nome_completo,
          email,
          telefone,
          endereco_cep,
          endereco_rua,
          endereco_numero,
          endereco_complemento,
          endereco_bairro,
          endereco_cidade,
          endereco_estado,
          cpf,
          cnpj
        )
      `)
      .eq('id', resgate_id)
      .single();

    if (resgateError || !resgate) {
      console.error('[APROVAR-RESGATE] Erro ao buscar resgate:', resgateError);
      throw new Error('Resgate não encontrado');
    }

    if (resgate.status !== 'pendente') {
      throw new Error(`Resgate já foi processado. Status atual: ${resgate.status}`);
    }

    const autor = resgate.autor;
    if (!autor) {
      throw new Error('Autor não encontrado para este resgate');
    }

    console.log('[APROVAR-RESGATE] Resgate encontrado:', {
      id: resgate.id,
      autor: autor.nome_completo,
      valor_total: resgate.valor_total,
      itens: resgate.itens?.length || 0
    });

    // 2. Preparar itens para o Bling
    const itensResgate = resgate.itens as Array<{
      produto_id: string;
      variant_id: string;
      titulo: string;
      quantidade: number;
      valor_unitario: number;
      desconto_aplicado: number;
      sku?: string;
    }>;

    if (!itensResgate || itensResgate.length === 0) {
      throw new Error('Resgate não possui itens');
    }

    // Preparar itens no formato do bling-create-order
    const itensParaBling = itensResgate.map(item => {
      // Calcular valor com desconto
      const valorComDesconto = item.valor_unitario * (1 - (item.desconto_aplicado || 0) / 100);
      
      return {
        codigo: item.sku || '', // SKU do produto Shopify
        descricao: item.titulo,
        unidade: 'UN',
        quantidade: item.quantidade,
        valor: valorComDesconto, // Preço com desconto
        preco_cheio: item.valor_unitario, // Preço original
        descontoItem: item.desconto_aplicado || 0,
      };
    });

    // Verificar se todos os itens têm SKU
    const itensSemSku = itensParaBling.filter(i => !i.codigo);
    if (itensSemSku.length > 0) {
      console.warn('[APROVAR-RESGATE] Itens sem SKU:', itensSemSku.map(i => i.descricao));
      // Não bloquear, pois o Bling pode aceitar por descrição
    }

    // 3. Montar dados do cliente (autor)
    const documento = autor.cpf || autor.cnpj || '';
    const isPessoaFisica = !autor.cnpj;

    // 4. Montar observações do pedido
    const observacoes = [
      `** RESGATE DE ROYALTIES - AUTOR **`,
      `Autor: ${autor.nome_completo}`,
      `Email: ${autor.email}`,
      resgate.observacoes ? `Obs Admin: ${resgate.observacoes}` : '',
      `Valor em Royalties: R$ ${resgate.valor_total.toFixed(2)}`,
      '',
      '--- ITENS ---',
      ...itensResgate.map(i => 
        `${i.quantidade}x ${i.titulo} - R$ ${(i.valor_unitario * (1 - (i.desconto_aplicado || 0) / 100)).toFixed(2)}${i.desconto_aplicado ? ` (${i.desconto_aplicado}% OFF)` : ''}`
      )
    ].filter(Boolean).join('\n');

    // 5. Montar endereço de entrega
    const enderecoEntrega = resgate.endereco_entrega as {
      cep?: string;
      rua?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
    } | null;

    // Usar endereço do resgate ou do autor
    const endereco = {
      cep: enderecoEntrega?.cep || autor.endereco_cep || '',
      endereco: enderecoEntrega?.rua || autor.endereco_rua || '',
      numero: enderecoEntrega?.numero || autor.endereco_numero || '',
      complemento: enderecoEntrega?.complemento || autor.endereco_complemento || '',
      bairro: enderecoEntrega?.bairro || autor.endereco_bairro || '',
      cidade: enderecoEntrega?.cidade || autor.endereco_cidade || '',
      uf: enderecoEntrega?.estado || autor.endereco_estado || '',
    };

    // 6. Chamar bling-create-order
    console.log('[APROVAR-RESGATE] Criando pedido no Bling...');

    const blingPayload = {
      cliente: {
        nome: autor.nome_completo,
        email: autor.email,
        telefone: autor.telefone || '',
        documento: documento,
        tipoPessoa: isPessoaFisica ? 'F' : 'J',
        endereco: endereco,
      },
      itens: itensParaBling,
      observacoes: observacoes,
      // Configurações específicas para resgate (sem gerar cobrança)
      formaPagamento: 'cortesia', // Indica que é resgate/permuta
      tipo_frete: 'proprio', // Frete por conta da empresa
      valor_frete: 0,
      // Depósito padrão (será resolvido pela função bling-create-order)
      depositoOrigem: 'matriz',
    };

    console.log('[APROVAR-RESGATE] Payload para Bling:', JSON.stringify(blingPayload, null, 2));

    // Invocar a edge function bling-create-order
    const { data: blingResult, error: blingError } = await supabase.functions.invoke('bling-create-order', {
      body: blingPayload
    });

    if (blingError) {
      console.error('[APROVAR-RESGATE] Erro ao chamar bling-create-order:', blingError);
      throw new Error(`Erro ao criar pedido no Bling: ${blingError.message}`);
    }

    if (!blingResult?.success) {
      console.error('[APROVAR-RESGATE] Bling retornou erro:', blingResult);
      throw new Error(blingResult?.error || 'Erro desconhecido ao criar pedido no Bling');
    }

    console.log('[APROVAR-RESGATE] Pedido criado no Bling:', {
      bling_order_id: blingResult.blingOrderId,
      bling_order_number: blingResult.blingOrderNumber
    });

    // 7. Atualizar resgate com dados do Bling e status aprovado
    const { error: updateError } = await supabase
      .from('royalties_resgates')
      .update({
        status: 'aprovado',
        bling_order_id: String(blingResult.blingOrderId),
        bling_order_number: String(blingResult.blingOrderNumber || blingResult.blingOrderId),
      })
      .eq('id', resgate_id);

    if (updateError) {
      console.error('[APROVAR-RESGATE] Erro ao atualizar resgate:', updateError);
      // Não falhar, pois o pedido já foi criado no Bling
      console.warn('[APROVAR-RESGATE] Pedido criado no Bling, mas falha ao atualizar resgate no DB');
    }

    console.log('[APROVAR-RESGATE] Resgate aprovado com sucesso!');

    // 8. Enviar email automático de aprovação
    const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const itensResumo = itensResgate.map(i => `${i.quantidade}x ${i.titulo}`).join(', ');

    supabase.functions.invoke('send-royalties-email', {
      body: {
        autorId: resgate.autor_id,
        templateCode: 'resgate_aprovado',
        tipoEnvio: 'automatico',
        dados: {
          valor_total: formatCurrency(resgate.valor_total),
          numero_pedido: String(blingResult.blingOrderNumber || blingResult.blingOrderId),
          itens: itensResumo,
        },
      },
    }).then(() => console.log('[APROVAR-RESGATE] Email de aprovação enviado'))
      .catch((e: any) => console.error('[APROVAR-RESGATE] Erro ao enviar email:', e));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Resgate aprovado e pedido criado no Bling',
        bling_order_id: blingResult.blingOrderId,
        bling_order_number: blingResult.blingOrderNumber || blingResult.blingOrderId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao aprovar resgate';
    console.error('[APROVAR-RESGATE] Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
