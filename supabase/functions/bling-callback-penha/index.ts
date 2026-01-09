import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    console.log("Bling callback Penha received:", { code: code?.substring(0, 10) + "...", state, error });

    if (error) {
      console.error("Bling OAuth error:", error, errorDescription);
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Erro na Conexão</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
              .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #ef4444; }
              .badge { background: #fbbf24; color: #000; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="container">
              <span class="badge">Polo Penha / RJ</span>
              <h1>❌ Erro na Conexão</h1>
              <p>${errorDescription || error}</p>
              <p>Feche esta janela e tente novamente.</p>
            </div>
          </body>
        </html>
        `,
        { headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    if (!code) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Erro</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
              .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #ef4444; }
              .badge { background: #fbbf24; color: #000; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="container">
              <span class="badge">Polo Penha / RJ</span>
              <h1>❌ Código não recebido</h1>
              <p>Não foi possível obter o código de autorização.</p>
            </div>
          </body>
        </html>
        `,
        { headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    // Get credentials from environment
    const clientId = Deno.env.get("BLING_CLIENT_ID_PENHA");
    const clientSecret = Deno.env.get("BLING_CLIENT_SECRET_PENHA");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!clientId || !clientSecret) {
      console.error("Missing BLING_CLIENT_ID_PENHA or BLING_CLIENT_SECRET_PENHA");
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Erro de Configuração</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
              .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #ef4444; }
              .badge { background: #fbbf24; color: #000; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="container">
              <span class="badge">Polo Penha / RJ</span>
              <h1>❌ Configuração Incompleta</h1>
              <p>Credenciais do Bling não configuradas para Polo Penha.</p>
            </div>
          </body>
        </html>
        `,
        { headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Get or create config entry
    const { data: existingConfig } = await supabase
      .from("bling_config_penha")
      .select("*")
      .limit(1)
      .single();

    let configId = existingConfig?.id;

    if (!configId) {
      const { data: newConfig, error: insertError } = await supabase
        .from("bling_config_penha")
        .insert({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${supabaseUrl}/functions/v1/bling-callback-penha`,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating config:", insertError);
        throw new Error("Failed to create config entry");
      }
      configId = newConfig.id;
    }

    // Exchange code for tokens
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log("Token response status:", tokenResponse.status);

    if (!tokenResponse.ok || tokenData.error) {
      console.error("Token exchange failed:", tokenData);
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Erro na Autenticação</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
              .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #ef4444; }
              .badge { background: #fbbf24; color: #000; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="container">
              <span class="badge">Polo Penha / RJ</span>
              <h1>❌ Falha na Autenticação</h1>
              <p>${tokenData.error_description || tokenData.error || "Erro desconhecido"}</p>
            </div>
          </body>
        </html>
        `,
        { headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    // Save tokens to database
    const { error: updateError } = await supabase
      .from("bling_config_penha")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId);

    if (updateError) {
      console.error("Error saving tokens:", updateError);
      throw new Error("Failed to save tokens");
    }

    console.log("Bling Penha connected successfully!");

    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Conectado com Sucesso</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #22c55e; }
            .badge { background: #fbbf24; color: #000; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 1rem; display: inline-block; }
          </style>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </head>
        <body>
          <div class="container">
            <span class="badge">Polo Penha / RJ</span>
            <h1>✅ Conectado com Sucesso!</h1>
            <p>A integração com o Bling foi estabelecida para o Polo Penha.</p>
            <p><small>Esta janela fechará automaticamente...</small></p>
          </div>
        </body>
      </html>
      `,
      { headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("Callback error:", error);
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Erro</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #ef4444; }
            .badge { background: #fbbf24; color: #000; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <span class="badge">Polo Penha / RJ</span>
            <h1>❌ Erro Inesperado</h1>
            <p>${error instanceof Error ? error.message : "Erro desconhecido"}</p>
          </div>
        </body>
      </html>
      `,
      { headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );
  }
});
