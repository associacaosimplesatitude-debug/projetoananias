import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LABELS_INTERESSE = [
  "Quero ver as novidades",
  "Quero ver novidades",
  "Tenho interesse",
];

function normalizePhone(p: string) { return (p || "").replace(/\D/g, ""); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supaUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await supaUser.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
    const ok = (roles || []).some((r: any) => ["admin", "gerente_ebd"].includes(r.role));
    if (!ok) return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers: corsHeaders });

    // Buscar webhooks dos últimos 14 dias com botão de interesse
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const orFilter = LABELS_INTERESSE.map((l) => `payload.cs.${l}`).join(",");
    // Simpler: filter via like across payload text
    const { data: hooks } = await supabase
      .from("whatsapp_webhooks")
      .select("telefone, created_at, payload")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);

    const candidates = (hooks || []).filter((h: any) => {
      const s = JSON.stringify(h.payload || {});
      return LABELS_INTERESSE.some((l) => s.includes(l));
    });

    // Dedup por telefone (pega o mais recente)
    const seen = new Map<string, { telefone: string; created_at: string; texto: string }>();
    for (const h of candidates) {
      const tel = normalizePhone(h.telefone || "");
      if (!tel || seen.has(tel)) continue;
      const s = JSON.stringify(h.payload || {});
      const label = LABELS_INTERESSE.find((l) => s.includes(l)) || "Tenho interesse";
      seen.set(tel, { telefone: tel, created_at: h.created_at, texto: label });
    }
    const pendentes = Array.from(seen.values());

    let sucesso = 0, jaTinha = 0, semCliente = 0, falha = 0;
    const detalhes: any[] = [];

    for (const it of pendentes) {
      const tel = it.telefone;
      const sufs = [tel, tel.slice(-11), tel.slice(-10)];
      let cliente: any = null;
      for (const sf of sufs) {
        const { data } = await supabase
          .from("ebd_clientes")
          .select("id, vendedor_id, nome_igreja, email_superintendente, telefone, updated_at")
          .or(`telefone.ilike.%${sf}`)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (data && data.length > 0) { cliente = data[0]; break; }
      }
      if (!cliente) { semCliente++; continue; }

      // Já tem registro de interesse posterior?
      const { data: jaInt } = await supabase
        .from("ebd_retencao_contatos")
        .select("id")
        .eq("cliente_id", cliente.id)
        .eq("resultado", "interessado")
        .gte("data_contato", it.created_at)
        .limit(1);
      if (jaInt && jaInt.length > 0) { jaTinha++; continue; }

      // Inserir histórico + resposta
      await supabase.from("ebd_retencao_contatos").insert({
        cliente_id: cliente.id,
        vendedor_id: cliente.vendedor_id,
        tipo_contato: "whatsapp",
        resultado: "interessado",
        observacao: `[Backfill] Botão: ${it.texto}`,
      });
      await supabase.from("retencao_respostas").insert({
        cliente_id: cliente.id,
        telefone: tel,
        tipo: "interesse",
        mensagem_recebida: it.texto,
      });

      // Vendedor nome
      let vendNome = "seu consultor";
      if (cliente.vendedor_id) {
        const { data: v } = await supabase.from("vendedores").select("nome").eq("id", cliente.vendedor_id).maybeSingle();
        if (v?.nome) vendNome = v.nome;
      }

      // Disparar oferta de presente (skip_delay)
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/responder-interesse-novidades`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            cliente_id: cliente.id,
            telefone: tel,
            nome: cliente.nome_igreja,
            vendedor_nome: vendNome,
            skip_delay: true,
          }),
        });
        if (!r.ok) throw new Error(await r.text());
        sucesso++;
        detalhes.push({ cliente: cliente.nome_igreja, telefone: tel, status: "ok" });
      } catch (e: any) {
        falha++;
        detalhes.push({ cliente: cliente.nome_igreja, telefone: tel, status: "erro", erro: e.message });
      }

      // Pausa curta entre envios
      await new Promise((res) => setTimeout(res, 1500));
    }

    return new Response(
      JSON.stringify({ total: pendentes.length, sucesso, jaTinha, semCliente, falha, detalhes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[backfill-cliques-novidades] error", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
