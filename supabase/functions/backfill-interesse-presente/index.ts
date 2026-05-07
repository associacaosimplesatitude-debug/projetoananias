import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: admin/gerente_ebd
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabaseUser.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const ok = (roles || []).some((r: any) => ["admin", "gerente_ebd"].includes(r.role));
    if (!ok) return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers: corsHeaders });

    // Carregar dashboard para identificar coluna 'interessado'
    const { data: dash } = await supabase.rpc("get_retencao_dashboard", { p_vendedor_id: null });
    const clientes: any[] = (dash as any)?.kanban_clientes || [];
    const interessados = clientes.filter((c) => c.coluna_kanban === "interessado");

    // Filtrar quem ainda NÃO tem auto_replied_em
    const ids = interessados.map((c) => c.cliente_id);
    const { data: jaResp } = await supabase
      .from("retencao_respostas")
      .select("cliente_id")
      .in("cliente_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .not("auto_replied_em", "is", null);
    const jaSet = new Set((jaResp || []).map((r: any) => r.cliente_id));
    const pendentes = interessados.filter((c) => !jaSet.has(c.cliente_id));

    // Lotes de 5, pausa 30s
    const batchSize = 5;
    let sucesso = 0, falha = 0;
    for (let i = 0; i < pendentes.length; i += batchSize) {
      const batch = pendentes.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((c) =>
          fetch(`${supabaseUrl}/functions/v1/responder-interesse-novidades`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({
              cliente_id: c.cliente_id,
              telefone: c.telefone,
              nome: c.nome_igreja,
              vendedor_nome: c.vendedor_nome,
              skip_delay: true,
            }),
          }).then(async (r) => {
            if (!r.ok) throw new Error(await r.text());
            return r.json();
          })
        )
      );
      results.forEach((r) => { if (r.status === "fulfilled") sucesso++; else falha++; });
      if (i + batchSize < pendentes.length) {
        await new Promise((res) => setTimeout(res, 30000));
      }
    }

    return new Response(JSON.stringify({ total: pendentes.length, sucesso, falha }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[backfill-interesse] error", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
