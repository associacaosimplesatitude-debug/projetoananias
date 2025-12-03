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

    // Buscar configuração
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config) {
      throw new Error('Configuração não encontrada');
    }

    if (!config.refresh_token) {
      throw new Error('Refresh token não disponível');
    }

    // Renovar token
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
      throw new Error(tokenData.error_description || 'Erro ao renovar token');
    }

    // Calcular nova expiração
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

    // Atualizar tokens
    const { error: updateError } = await supabase
      .from('bling_config')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', config.id);

    if (updateError) {
      throw new Error('Erro ao salvar tokens');
    }

    console.log('Token renovado com sucesso!');

    return new Response(
      JSON.stringify({ success: true, expires_at: expiresAt.toISOString() }),
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
