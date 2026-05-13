import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "no token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Cliente que herda o JWT do usuário chamador (executa sob a RLS dele)
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();

  // Tenta a função custom criada na migration
  const { data: vendedorId, error: rpcErr } = await userClient.rpc("current_vendedor_id");

  // Tenta ler vendedores (testa RLS lateral de vendedores)
  const { data: meuVendedor, error: vendErr } = await userClient
    .from("vendedores")
    .select("id, email, nome")
    .limit(5);

  // Tenta exatamente o que o front faz
  const { data: conversas, error: convErr, status: convStatus } = await userClient
    .from("agente_ia_conversas")
    .select("id, telefone, vendedor_atribuido_id, status, agente_pausado, atribuida_em")
    .not("vendedor_atribuido_id", "is", null);

  // Tenta filtrando explicitamente pelo vendedor_id (caso a RLS bloqueie só algumas linhas)
  const { data: conversasFiltradas, error: convFiltErr } = vendedorId
    ? await userClient
        .from("agente_ia_conversas")
        .select("id, telefone, vendedor_atribuido_id")
        .eq("vendedor_atribuido_id", vendedorId)
    : { data: null, error: null };

  return new Response(
    JSON.stringify(
      {
        auth: {
          uid: userData?.user?.id,
          email: userData?.user?.email,
          error: userErr?.message,
        },
        current_vendedor_id_rpc: {
          result: vendedorId,
          error: rpcErr?.message,
        },
        vendedores_visiveis_via_rls: {
          count: meuVendedor?.length ?? 0,
          data: meuVendedor,
          error: vendErr?.message,
        },
        agente_ia_conversas_atribuidas: {
          status: convStatus,
          count: conversas?.length ?? 0,
          sample: conversas?.slice(0, 5),
          error: convErr?.message,
        },
        agente_ia_conversas_filtradas_por_vendedor: {
          count: conversasFiltradas?.length ?? 0,
          data: conversasFiltradas,
          error: convFiltErr?.message,
        },
      },
      null,
      2,
    ),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
