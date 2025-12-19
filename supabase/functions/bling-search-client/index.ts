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

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

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

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf_cnpj } = await req.json();

    if (!cpf_cnpj) {
      throw new Error('CPF/CNPJ é obrigatório');
    }

    // Remove formatação do documento
    const documentoLimpo = cpf_cnpj.replace(/\D/g, '');
    
    if (documentoLimpo.length !== 11 && documentoLimpo.length !== 14) {
      throw new Error('CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos');
    }

    console.log(`Buscando cliente no Bling com documento: ${documentoLimpo}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar configuração do Bling
    const { data: blingConfig, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !blingConfig) {
      throw new Error('Configuração do Bling não encontrada');
    }

    // Verificar se o token está expirado e renovar se necessário
    let accessToken = blingConfig.access_token;
    if (isTokenExpired(blingConfig.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, blingConfig);
    }

    // Buscar cliente no Bling por CPF/CNPJ
    // Endpoint: GET /contatos?pesquisa={cpfCnpj}
    const searchUrl = `https://www.bling.com.br/Api/v3/contatos?pesquisa=${documentoLimpo}&criterio=1`;
    
    console.log(`Chamando API do Bling: ${searchUrl}`);

    const blingResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const blingData = await blingResponse.json();

    console.log('Resposta do Bling:', JSON.stringify(blingData, null, 2));

    if (!blingResponse.ok) {
      console.error('Erro na busca do Bling:', blingData);
      
      // Se for erro de autenticação, tentar renovar token e buscar novamente
      if (blingResponse.status === 401) {
        console.log('Token expirado, renovando...');
        accessToken = await refreshBlingToken(supabase, blingConfig);
        
        const retryResponse = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });
        
        const retryData = await retryResponse.json();
        
        if (!retryResponse.ok) {
          return new Response(JSON.stringify({ 
            found: false, 
            error: 'Erro ao buscar cliente no Bling após renovação do token' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        if (retryData.data && retryData.data.length > 0) {
          const cliente = retryData.data[0];
          return new Response(JSON.stringify({
            found: true,
            cliente: mapBlingClientToLocal(cliente),
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      return new Response(JSON.stringify({ 
        found: false, 
        error: 'Cliente não encontrado no Bling' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se encontrou cliente
    if (blingData.data && blingData.data.length > 0) {
      // Filtrar para encontrar o cliente com o documento exato
      const clienteEncontrado = blingData.data.find((c: any) => {
        const docBling = (c.numeroDocumento || '').replace(/\D/g, '');
        return docBling === documentoLimpo;
      });

      if (clienteEncontrado) {
        console.log('Cliente encontrado no Bling:', clienteEncontrado.nome);
        
        return new Response(JSON.stringify({
          found: true,
          cliente: mapBlingClientToLocal(clienteEncontrado),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('Cliente não encontrado no Bling');
    return new Response(JSON.stringify({ 
      found: false,
      message: 'Cliente não encontrado no Bling' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro na busca de cliente:', error);
    return new Response(JSON.stringify({ 
      found: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Mapeia os dados do cliente do Bling para o formato do sistema local
function mapBlingClientToLocal(clienteBling: any) {
  const endereco = clienteBling.endereco || {};
  
  return {
    bling_cliente_id: clienteBling.id,
    nome: clienteBling.nome || '',
    fantasia: clienteBling.fantasia || '',
    tipo_pessoa: clienteBling.tipo || 'J', // J = Jurídica, F = Física
    cpf_cnpj: (clienteBling.numeroDocumento || '').replace(/\D/g, ''),
    ie_rg: clienteBling.ie || '',
    email: clienteBling.email || '',
    telefone: clienteBling.telefone || clienteBling.celular || '',
    celular: clienteBling.celular || '',
    // Endereço
    endereco_cep: (endereco.cep || '').replace(/\D/g, ''),
    endereco_rua: endereco.endereco || '',
    endereco_numero: endereco.numero || '',
    endereco_complemento: endereco.complemento || '',
    endereco_bairro: endereco.bairro || '',
    endereco_cidade: endereco.municipio || '',
    endereco_estado: endereco.uf || '',
  };
}
