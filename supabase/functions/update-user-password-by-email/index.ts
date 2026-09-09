import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isInternalCall, requireRole, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { oldEmail, newEmail, newPassword } = await req.json();

    // Internal server-to-server calls must present a shared secret header.
    // A body flag is attacker-controlled and is never trusted.
    if (!isInternalCall(req)) {
      try {
        await requireRole(req, ["admin", "superadmin", "gerente_ebd"], supabaseAdmin);
      } catch (authErr) {
        return authErrorResponse(authErr, corsHeaders);
      }
    }

    const emailCandidates = [oldEmail, newEmail]
      .filter(Boolean)
      .map((e: string) => e.toLowerCase().trim());

    if (emailCandidates.length === 0) throw new Error("Email é obrigatório");

    const shouldUpdatePassword = Boolean(newPassword && String(newPassword).length >= 6);
    const shouldUpdateEmail = Boolean(newEmail && oldEmail && newEmail.toLowerCase().trim() !== oldEmail.toLowerCase().trim());

    if (!shouldUpdatePassword && !shouldUpdateEmail) {
      throw new Error("Nada para atualizar (informe nova senha e/ou novo email)");
    }

    // Localiza o usuário pelo email (paginando)
    let targetUser: { id: string; email?: string | null } | null = null;
    let page = 1;
    const perPage = 1000;

    while (!targetUser) {
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listError) throw listError;

      targetUser = usersData.users.find((u) => {
        const uEmail = (u.email ?? "").toLowerCase().trim();
        return emailCandidates.includes(uEmail);
      }) ?? null;

      if (targetUser || usersData.users.length < perPage) break;
      page++;
    }

    if (!targetUser) {
      // Se não encontrou usuário e temos senha para criar, criamos o usuário
      if (!shouldUpdatePassword) {
        throw new Error(`Usuário com email ${emailCandidates[0]} não encontrado no sistema de autenticação`);
      }

      const emailToUse = (newEmail || oldEmail).toLowerCase().trim();

      console.log("[UPDATE-PASSWORD] Usuário não encontrado, criando novo usuário para:", emailToUse);

      // Criar usuário no auth
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailToUse,
        password: newPassword,
        email_confirm: true,
      });

      if (createError) throw createError;

      // Criar/atualizar profile
      await supabaseAdmin.from("profiles").upsert({
        id: newAuthUser.user.id,
        email: emailToUse,
      });

      console.log("[UPDATE-PASSWORD] Usuário criado com sucesso:", newAuthUser.user.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Usuário criado e credenciais definidas com sucesso",
          created: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[UPDATE-PASSWORD] Usuário encontrado", { id: targetUser.id, email: targetUser.email });

    const payload: Record<string, unknown> = {};
    if (shouldUpdatePassword) payload.password = newPassword;
    if (shouldUpdateEmail && newEmail) payload.email = String(newEmail).trim();

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, payload);
    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Credenciais atualizadas com sucesso",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[UPDATE-PASSWORD] Erro:", errorMessage);

    const status = errorMessage === "Unauthorized"
      ? 401
      : errorMessage.includes("Sem permissão")
        ? 403
        : 200; // erros de negócio (ex: usuário não encontrado) retornam 200 para não quebrar o front

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
