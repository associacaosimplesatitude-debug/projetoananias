import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: uerr } = await supabaseUser.auth.getUser();
  if (uerr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userData.user.id);
  const ok = (roles || []).some((r: any) => ["admin", "gerente_ebd"].includes(r.role));
  if (!ok) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  // Buscar pendentes
  const { data: pendentes, error } = await supabaseAdmin
    .from("retencao_respostas")
    .select("id, cliente_id, telefone, created_at, ebd_clientes:cliente_id(nome_igreja, email_superintendente, vendedor_id)")
    .eq("tipo", "aceitar_presente")
    .is("licenca_concedida_em", null)
    .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  const total = pendentes?.length || 0;
  if (!total) {
    return new Response(JSON.stringify({ total: 0, sucesso: 0, falha: 0, erros: [] }), { headers: corsHeaders });
  }

  // Background
  const proc = async () => {
    let sucesso = 0, falha = 0;
    const erros: any[] = [];
    for (const p of pendentes!) {
      const c: any = (p as any).ebd_clientes || {};
      let vendedor_nome = "seu consultor";
      if (c.vendedor_id) {
        const { data: v } = await supabaseAdmin.from("vendedores").select("nome").eq("id", c.vendedor_id).maybeSingle();
        if (v?.nome) vendedor_nome = v.nome;
      }
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/liberar-presente-cartas-prisao`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            cliente_id: p.cliente_id,
            telefone: p.telefone,
            nome: c.nome_igreja,
            email: c.email_superintendente,
            vendedor_nome,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j?.error) { falha++; erros.push({ cliente_id: p.cliente_id, error: j?.error || r.status }); }
        else sucesso++;
      } catch (e: any) {
        falha++; erros.push({ cliente_id: p.cliente_id, error: e.message });
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    console.log("[reprocessar-presentes] done", { total, sucesso, falha, erros });
  };

  // @ts-ignore
  (globalThis as any).EdgeRuntime?.waitUntil ? (globalThis as any).EdgeRuntime.waitUntil(proc()) : proc();

  return new Response(JSON.stringify({ enqueued: true, total }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
