import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('Bling callback received:', { code: code ? code.substring(0, 10) + '...' : null, state, error });

    if (error) {
      console.error('Bling OAuth error:', error);
      return new Response(
        `<html><body><h1>Erro na autenticação</h1><p>${error}</p><script>setTimeout(() => window.close(), 3000);</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code) {
      return new Response(
        '<html><body><h1>Código de autorização não recebido</h1><script>setTimeout(() => window.close(), 3000);</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Buscar configurações do Bling
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config) {
      console.error('Erro ao buscar config:', configError);
      return new Response(
        '<html><body><h1>Configuração não encontrada</h1><script>setTimeout(() => window.close(), 3000);</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('Config loaded - client_id:', config.client_id?.substring(0, 10) + '...');
    console.log('Config loaded - client_secret length:', config.client_secret?.length || 0);

    // Trocar code por tokens - usar credenciais do banco
    const clientId = config.client_id;
    const clientSecret = config.client_secret;
    
    if (!clientId || !clientSecret) {
      console.error('Client ID ou Client Secret não configurado');
      return new Response(
        '<html><body><h1>Erro de configuração</h1><p>Client ID ou Client Secret não configurado</p><script>setTimeout(() => window.close(), 3000);</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);
    console.log('Making token request with credentials length:', credentials.length);
    
    const tokenResponse = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status);
    console.log('Token response body:', JSON.stringify(tokenData));

    if (!tokenResponse.ok || tokenData.error) {
      console.error('Erro ao obter token:', tokenData);
      return new Response(
        `<html><body><h1>Erro ao obter token</h1><p>${JSON.stringify(tokenData)}</p><script>setTimeout(() => window.close(), 5000);</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Calcular expiração do token
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600)); // 6 horas padrão

    // Salvar tokens no banco
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
      return new Response(
        '<html><body><h1>Erro ao salvar tokens</h1><script>setTimeout(() => window.close(), 3000);</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('Tokens salvos com sucesso!');

    return new Response(
      `<html>
        <head>
          <style>
            body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f9ff; }
            .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            h1 { color: #10b981; }
            p { color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ Conectado com sucesso!</h1>
            <p>A integração com o Bling foi realizada.</p>
            <p>Esta janela será fechada automaticamente...</p>
          </div>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('Erro no callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      `<html><body><h1>Erro interno</h1><p>${errorMessage}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
