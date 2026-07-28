// Altera o email de acesso (auth.users + profiles + ebd_clientes.email_superintendente)
// de um cliente EBD de forma sincronizada. Somente admin ou gerente_ebd.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return json({ error: "Não autenticado" }, 401);

    // Autorização: admin ou gerente_ebd
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowed = (roles ?? []).some((r: { role: string }) =>
      r.role === "admin" || r.role === "gerente_ebd" || r.role === "superadmin"
    );
    if (!allowed) return json({ error: "Sem permissão para alterar email de acesso" }, 403);

    const body = await req.json().catch(() => ({}));
    const cliente_id: string | undefined = body?.cliente_id;
    const novo_email: string | undefined = body?.novo_email?.trim?.().toLowerCase();

    if (!cliente_id || !novo_email) {
      return json({ error: "cliente_id e novo_email são obrigatórios" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(novo_email) || novo_email.length > 255) {
      return json({ error: "Email inválido" }, 400);
    }

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from("ebd_clientes")
      .select("id, nome_igreja, email_superintendente, superintendente_user_id")
      .eq("id", cliente_id)
      .maybeSingle();

    if (clienteError) return json({ error: clienteError.message }, 400);
    if (!cliente) return json({ error: "Cliente não encontrado" }, 404);
    if (!cliente.superintendente_user_id) {
      return json({ error: "Cliente ainda não tem conta de acesso criada" }, 400);
    }

    const userId = cliente.superintendente_user_id as string;

    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: novo_email,
      email_confirm: true,
    });
    if (updateAuthError) {
      console.error("Erro ao atualizar auth.users:", updateAuthError.message);
      return json({ error: updateAuthError.message }, 400);
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ email: novo_email })
      .eq("id", userId);
    if (profileError) console.error("Erro ao atualizar profiles:", profileError.message);

    const { error: clienteUpdateError } = await supabaseAdmin
      .from("ebd_clientes")
      .update({ email_superintendente: novo_email })
      .eq("id", cliente_id);
    if (clienteUpdateError) {
      console.error("Erro ao atualizar ebd_clientes:", clienteUpdateError.message);
      return json({ error: clienteUpdateError.message }, 400);
    }

    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: user.id,
      action: "update_cliente_email",
      table_name: "ebd_clientes",
      record_id: cliente_id,
      old_values: { email_superintendente: cliente.email_superintendente },
      new_values: { email_superintendente: novo_email, auth_user_id: userId },
    });

    console.log(
      `Email do cliente ${cliente_id} (${cliente.nome_igreja}) alterado de ${cliente.email_superintendente} para ${novo_email} por ${user.email}`,
    );

    return json({ success: true, novo_email });
  } catch (e) {
    console.error("Erro inesperado:", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
