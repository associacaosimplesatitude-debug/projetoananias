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

// Extrai valor string de forma segura (evita [object Object])
function safeString(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  // Se for objeto, tenta pegar campos comuns
  if (typeof val === 'object') {
    return (val.nome || val.value || val.descricao || val.endereco || val.logradouro || '').toString().trim();
  }
  return '';
}

function extractEmailFromBlingContato(contato: any): string {
  if (!contato) return '';

  const direct = safeString(contato.email || contato.emailNfe || contato.emailNF || contato.emailNFe || contato.emailPrincipal);
  if (direct) return direct;

  const emails = contato.emails;
  if (Array.isArray(emails) && emails.length > 0) {
    const first = safeString(emails[0]?.email || emails[0]?.endereco || emails[0]?.value);
    if (first) return first;
  }

  return '';
}

async function fetchBlingContatoDetalhado(accessToken: string, contatoId: number): Promise<any | null> {
  const detailUrl = `https://www.bling.com.br/Api/v3/contatos/${contatoId}`;
  console.log(`Buscando detalhes do contato no Bling: ${detailUrl}`);

  const resp = await fetch(detailUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  const json = await resp.json();

  if (!resp.ok) {
    console.warn('Falha ao buscar detalhes do contato no Bling:', resp.status, JSON.stringify(json));
    return null;
  }

  // Alguns endpoints retornam { data: {...} }
  return json?.data ?? json;
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
    // Observação: o endpoint de lista (/contatos) pode vir com dados reduzidos.
    // Quando encontrar, buscamos os detalhes em /contatos/{id} para trazer email/endereço.
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
          const detalhado = await fetchBlingContatoDetalhado(accessToken, Number(cliente.id));

          return new Response(JSON.stringify({
            found: true,
            cliente: mapBlingClientToLocal(detalhado || cliente),
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

        const detalhado = await fetchBlingContatoDetalhado(accessToken, Number(clienteEncontrado.id));

        return new Response(JSON.stringify({
          found: true,
          cliente: mapBlingClientToLocal(detalhado || clienteEncontrado),
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
  console.log('Dados detalhados do Bling para mapeamento:', JSON.stringify(clienteBling, null, 2));

  const endereco = clienteBling?.endereco || clienteBling?.enderecoGeral || clienteBling?.enderecoEntrega || {};

  // O Bling pode retornar o endereço de várias formas diferentes
  const enderecoGeral = endereco?.geral || endereco;

  return {
    bling_cliente_id: clienteBling?.id,
    nome: safeString(clienteBling?.nome),
    fantasia: safeString(clienteBling?.fantasia),
    tipo_pessoa: safeString(clienteBling?.tipo) || 'J', // J = Jurídica, F = Física
    cpf_cnpj: safeString(clienteBling?.numeroDocumento).replace(/\D/g, ''),
    ie_rg: safeString(clienteBling?.ie || clienteBling?.rg || clienteBling?.ieRg),
    email: extractEmailFromBlingContato(clienteBling),
    telefone: safeString(clienteBling?.telefone || clienteBling?.celular),
    celular: safeString(clienteBling?.celular),

    // Endereço - tenta múltiplas estruturas possíveis do Bling
    endereco_cep: safeString(enderecoGeral?.cep || endereco?.cep || clienteBling?.cep).replace(/\D/g, ''),
    endereco_rua: safeString(enderecoGeral?.endereco || enderecoGeral?.logradouro || endereco?.logradouro || clienteBling?.logradouro),
    endereco_numero: safeString(enderecoGeral?.numero || endereco?.numero || clienteBling?.numero),
    endereco_complemento: safeString(enderecoGeral?.complemento || endereco?.complemento || clienteBling?.complemento),
    endereco_bairro: safeString(enderecoGeral?.bairro || endereco?.bairro || clienteBling?.bairro),
    endereco_cidade: safeString(enderecoGeral?.municipio || enderecoGeral?.cidade || endereco?.municipio || endereco?.cidade || clienteBling?.cidade),
    endereco_estado: safeString(enderecoGeral?.uf || endereco?.uf || clienteBling?.uf),
  };
}
