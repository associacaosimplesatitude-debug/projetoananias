// v3 - CORS fix 2026-02-06
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  'https://gestaoebd.com.br',
  'https://www.gestaoebd.com.br',
  'http://localhost:5173',
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  };
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight - return 200 immediately
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') || '';

    const tokenPrefix = accessToken.startsWith('TEST-')
      ? 'TEST-'
      : accessToken.startsWith('APP_USR-')
        ? 'APP_USR-'
        : 'OTHER';

    const ambiente = tokenPrefix === 'TEST-' ? 'sandbox' : 'production';

    console.log('[mp-checkout-init] MP ambiente:', { ambiente, token_prefix: tokenPrefix });

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

    // Se houver usuário logado e for admin, expor debug do ambiente no response
    let mp_debug: { ambiente: string; token_prefix: string } | null = null;
    try {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
      const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

      if (jwt) {
        const { data: userData } = await supabase.auth.getUser(jwt);
        if (userData?.user?.id) {
          const { data: roleRow } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userData.user.id)
            .single();

          if (roleRow?.role === 'admin') {
            mp_debug = { ambiente, token_prefix: tokenPrefix };
          }
        }
      }
    } catch (e) {
      console.warn('[mp-checkout-init] Falha ao verificar admin para mp_debug');
    }

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
      ...(mp_debug ? { mp_debug } : {}),
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
