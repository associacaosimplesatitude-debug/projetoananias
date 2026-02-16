import { createClient } from "npm:@supabase/supabase-js@2";

const PANEL_URL = "https://gestaoebd.com.br";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const clienteId = url.searchParams.get("c");
    const fase = url.searchParams.get("f");
    const redirect = url.searchParams.get("r") || "/login/ebd";

    if (!clienteId) {
      return new Response("Parâmetro inválido", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Registrar o clique no tracking
    const updateData: Record<string, unknown> = {};
    if (fase === "1") {
      updateData.fase1_link_clicado = true;
      updateData.fase1_link_clicado_em = new Date().toISOString();
    } else if (fase === "2") {
      updateData.fase2_link_clicado = true;
      updateData.fase2_link_clicado_em = new Date().toISOString();
    }

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from("funil_posv_tracking")
        .update(updateData)
        .eq("cliente_id", clienteId);
    }

    // Redirecionar para o painel
    const finalUrl = `${PANEL_URL}${redirect}`;
    return new Response(null, {
      status: 302,
      headers: { Location: finalUrl },
    });
  } catch (error) {
    console.error("Erro no link tracker:", error);
    return new Response(null, {
      status: 302,
      headers: { Location: PANEL_URL },
    });
  }
});
