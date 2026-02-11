import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function refreshBlingToken(supabase: any, config: any, configId: string): Promise<string> {
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  const response = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refresh_token,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} - ${errorText}`);
  }

  const tokenData = await response.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase
    .from("bling_config")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", configId);

  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get Bling config
    const { data: configData, error: configError } = await supabase
      .from("bling_config")
      .select("*")
      .limit(1)
      .single();

    if (configError || !configData) {
      return new Response(
        JSON.stringify({ error: "Bling não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check/refresh token
    let accessToken = configData.access_token;
    const expiresAt = new Date(configData.token_expires_at);
    if (new Date() >= new Date(expiresAt.getTime() - 5 * 60 * 1000)) {
      accessToken = await refreshBlingToken(supabase, configData, configData.id);
    }

    // Fetch books missing codigo_bling
    const { data: books, error: booksError } = await supabase
      .from("royalties_livros")
      .select("id, titulo, bling_produto_id, codigo_bling")
      .not("bling_produto_id", "is", null);

    if (booksError) throw booksError;

    const booksToUpdate = (books || []).filter((b: any) => !b.codigo_bling);
    console.log(`[Backfill] ${booksToUpdate.length} livros sem codigo_bling de ${(books || []).length} total`);

    if (booksToUpdate.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Todos os livros já possuem SKU", updated: 0, total: (books || []).length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updated = 0;
    let errors = 0;
    const details: any[] = [];

    for (const book of booksToUpdate) {
      try {
        await delay(400); // Rate limit

        const response = await fetch(`https://www.bling.com.br/Api/v3/produtos/${book.bling_produto_id}`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/json",
          },
        });

        if (response.status === 429) {
          console.log(`[Bling] Rate limited, waiting 3s...`);
          await delay(3000);
          const retryResponse = await fetch(`https://www.bling.com.br/Api/v3/produtos/${book.bling_produto_id}`, {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Accept": "application/json",
            },
          });
          if (!retryResponse.ok) {
            throw new Error(`Retry failed: ${retryResponse.status}`);
          }
          const retryData = await retryResponse.json();
          const codigo = retryData.data?.codigo;
          if (codigo) {
            await supabase
              .from("royalties_livros")
              .update({ codigo_bling: codigo })
              .eq("id", book.id);
            updated++;
            details.push({ titulo: book.titulo, codigo });
            console.log(`[OK] ${book.titulo} -> SKU: ${codigo}`);
          }
          continue;
        }

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const codigo = data.data?.codigo;

        if (codigo) {
          await supabase
            .from("royalties_livros")
            .update({ codigo_bling: codigo })
            .eq("id", book.id);
          updated++;
          details.push({ titulo: book.titulo, codigo });
          console.log(`[OK] ${book.titulo} -> SKU: ${codigo}`);
        } else {
          console.log(`[Skip] ${book.titulo} - sem codigo no Bling`);
          errors++;
        }
      } catch (err) {
        console.error(`[Error] ${book.titulo}:`, err);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${updated} SKUs preenchidos de ${booksToUpdate.length} pendentes`,
        updated,
        errors,
        total: (books || []).length,
        details,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Error]", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
