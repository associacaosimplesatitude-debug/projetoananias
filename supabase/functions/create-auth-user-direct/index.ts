import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      { auth: { persistSession: false } }
    );

    const { email, password, full_name } = await req.json();

    if (!email || !password) {
      throw new Error("Email e senha são obrigatórios");
    }

    console.log("[CREATE-AUTH-USER-DIRECT] Criando usuário para:", email);

    // Check if user exists
    let page = 1;
    const perPage = 1000;
    let existingUser = null;

    while (true) {
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listError) throw listError;

      existingUser = usersData.users.find(
        (u) => (u.email ?? "").toLowerCase().trim() === email.toLowerCase().trim()
      );

      if (existingUser || usersData.users.length < perPage) break;
      page++;
    }

    let userId: string;

    if (existingUser) {
      console.log("[CREATE-AUTH-USER-DIRECT] Usuário já existe, atualizando senha:", existingUser.id);
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
      });

      if (updateError) throw updateError;
      userId = existingUser.id;
    } else {
      console.log("[CREATE-AUTH-USER-DIRECT] Criando novo usuário");
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || email,
        },
      });

      if (createError) throw createError;
      userId = newUser.user.id;
    }

    // Upsert profile
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: email.toLowerCase().trim(),
      full_name: full_name || null,
    });

    if (profileError) {
      console.error("[CREATE-AUTH-USER-DIRECT] Erro ao criar profile:", profileError);
    }

    console.log("[CREATE-AUTH-USER-DIRECT] Sucesso! userId:", userId);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        message: existingUser ? "Senha atualizada com sucesso" : "Usuário criado com sucesso",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[CREATE-AUTH-USER-DIRECT] Erro:", errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
