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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { proposta_id, proposta_token } = await req.json();

    if (!proposta_id && !proposta_token) {
      return new Response(
        JSON.stringify({ error: 'proposta_id ou proposta_token é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[mp-checkout-init] Buscando proposta:', { proposta_id, proposta_token });

    // Buscar proposta
    let query = supabase
      .from('vendedor_propostas')
      .select('id, cliente_id, cliente_nome, cliente_cnpj, cliente_endereco, valor_produtos, valor_frete, metodo_frete, frete_tipo, itens, desconto_percentual, vendedor_id, vendedor_email, vendedor_nome, token');

    if (proposta_id) {
      query = query.eq('id', proposta_id);
    } else {
      query = query.eq('token', proposta_token);
    }

    const { data: proposta, error: propostaError } = await query.single();

    if (propostaError || !proposta) {
      console.error('[mp-checkout-init] Proposta não encontrada:', propostaError);
      return new Response(
        JSON.stringify({ error: 'Proposta não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('[mp-checkout-init] Proposta encontrada:', proposta.id, 'cliente_id:', proposta.cliente_id);

    // Buscar dados do cliente se houver cliente_id
    let cliente = null;
    if (proposta.cliente_id) {
      const { data: clienteData, error: clienteError } = await supabase
        .from('ebd_clientes')
        .select('email_superintendente, telefone, cnpj, cpf, nome_superintendente, nome_responsavel, nome_igreja')
        .eq('id', proposta.cliente_id)
        .single();

      if (clienteError) {
        console.warn('[mp-checkout-init] Erro ao buscar cliente:', clienteError);
      } else {
        cliente = clienteData;
      }
    }

    console.log('[mp-checkout-init] Cliente encontrado:', cliente ? 'sim' : 'não', 'email:', cliente?.email_superintendente);

    // Parse itens e endereço
    const itens = typeof proposta.itens === 'string' ? JSON.parse(proposta.itens) : proposta.itens;
    const endereco = typeof proposta.cliente_endereco === 'string' 
      ? JSON.parse(proposta.cliente_endereco) 
      : proposta.cliente_endereco || {};

    // Montar resposta com dados para preencher o formulário
    const response = {
      proposta_id: proposta.id,
      token: proposta.token,
      cliente_nome: proposta.cliente_nome || cliente?.nome_superintendente || cliente?.nome_responsavel || '',
      cliente_cnpj: proposta.cliente_cnpj || cliente?.cnpj || cliente?.cpf || '',
      email: cliente?.email_superintendente || '',
      telefone: cliente?.telefone || '',
      endereco: {
        cep: endereco.cep || '',
        rua: endereco.rua || '',
        numero: endereco.numero || '',
        complemento: endereco.complemento || '',
        bairro: endereco.bairro || '',
        cidade: endereco.cidade || '',
        estado: endereco.estado || '',
      },
      valor_produtos: proposta.valor_produtos || 0,
      valor_frete: proposta.valor_frete || 0,
      metodo_frete: proposta.metodo_frete || proposta.frete_tipo || 'pac',
      desconto_percentual: proposta.desconto_percentual || 0,
      itens: itens || [],
      vendedor: {
        id: proposta.vendedor_id,
        email: proposta.vendedor_email,
        nome: proposta.vendedor_nome,
      },
    };

    console.log('[mp-checkout-init] Resposta montada, email:', response.email, 'telefone:', response.telefone);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[mp-checkout-init] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
