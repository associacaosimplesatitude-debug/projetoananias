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

    console.log('[PE] Bling callback received:', { code: code ? code.substring(0, 10) + '...' : null, state, error });

    if (error) {
      console.error('[PE] Bling OAuth error:', error);
      return new Response(
        `<html><body><h1>Erro na autenticação (PE)</h1><p>${error}</p><script>setTimeout(() => window.close(), 3000);</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code) {
      return new Response(
        '<html><body><h1>Código de autorização não recebido (PE)</h1><script>setTimeout(() => window.close(), 3000);</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Buscar configurações do Bling PE
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar credenciais dos secrets
    const clientId = Deno.env.get('BLING_CLIENT_ID_PE');
    const clientSecret = Deno.env.get('BLING_CLIENT_SECRET_PE');

    if (!clientId || !clientSecret) {
      console.error('[PE] Client ID ou Client Secret não configurado nos secrets');
      return new Response(
        '<html><body><h1>Erro de configuração (PE)</h1><p>BLING_CLIENT_ID_PE ou BLING_CLIENT_SECRET_PE não configurado</p><script>setTimeout(() => window.close(), 3000);</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Buscar config existente
    const { data: config, error: configError } = await supabase
      .from('bling_config_pe')
      .select('*')
      .single();

    if (configError) {
      console.error('[PE] Erro ao buscar config:', configError);
      // Criar registro se não existir
      const { data: newConfig, error: insertError } = await supabase
        .from('bling_config_pe')
        .insert({})
        .select()
        .single();
      
      if (insertError) {
        return new Response(
          '<html><body><h1>Erro ao criar configuração PE</h1><script>setTimeout(() => window.close(), 3000);</script></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      }
    }

    console.log('[PE] Config loaded - client_id:', clientId.substring(0, 10) + '...');

    const credentials = btoa(`${clientId}:${clientSecret}`);
    console.log('[PE] Making token request with credentials length:', credentials.length);
    
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
    console.log('[PE] Token response status:', tokenResponse.status);
    console.log('[PE] Token response body:', JSON.stringify(tokenData));

    if (!tokenResponse.ok || tokenData.error) {
      console.error('[PE] Erro ao obter token:', tokenData);
      return new Response(
        `<html><body><h1>Erro ao obter token (PE)</h1><p>${JSON.stringify(tokenData)}</p><script>setTimeout(() => window.close(), 5000);</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Calcular expiração do token
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600)); // 6 horas padrão

    // Salvar tokens no banco - atualizar todos os registros (deveria ter só 1)
    const { error: updateError } = await supabase
      .from('bling_config_pe')
      .update({
        client_id: clientId,
        client_secret: clientSecret,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt.toISOString(),
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Atualizar todos

    if (updateError) {
      console.error('[PE] Erro ao salvar tokens:', updateError);
      return new Response(
        '<html><body><h1>Erro ao salvar tokens (PE)</h1><script>setTimeout(() => window.close(), 3000);</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('[PE] Tokens salvos com sucesso!');

    return new Response(
      `<html>
        <head>
          <style>
            body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fef3c7; }
            .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            h1 { color: #f59e0b; }
            p { color: #64748b; }
            .badge { background: #fef3c7; color: #92400e; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.875rem; margin-top: 0.5rem; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ Conectado com sucesso!</h1>
            <span class="badge">Pernambuco / Norte-Nordeste</span>
            <p>A integração com o Bling PE foi realizada.</p>
            <p>Esta janela será fechada automaticamente...</p>
          </div>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('[PE] Erro no callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      `<html><body><h1>Erro interno (PE)</h1><p>${errorMessage}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
