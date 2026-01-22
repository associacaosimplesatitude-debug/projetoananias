import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { churchId, nome, email, senha, telefone, dataNascimento, turmaId } = await req.json();

    console.log("Recebida solicitação de cadastro público de aluno:", { churchId, nome, email });

    // Validações básicas
    if (!churchId) {
      return new Response(
        JSON.stringify({ error: "ID da igreja é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!nome || nome.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Nome deve ter pelo menos 3 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!senha || senha.length < 6) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter pelo menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se a igreja existe e está ativa
    const { data: igreja, error: igrejaError } = await supabaseAdmin
      .from("ebd_clientes")
      .select("id, nome_igreja, status_ativacao_ebd")
      .eq("id", churchId)
      .single();

    if (igrejaError || !igreja) {
      console.error("Igreja não encontrada:", igrejaError);
      return new Response(
        JSON.stringify({ error: "Igreja não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!igreja.status_ativacao_ebd) {
      return new Response(
        JSON.stringify({ error: "Esta igreja não está ativa para cadastros" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se a turma pertence à igreja (se informada)
    if (turmaId) {
      const { data: turma, error: turmaError } = await supabaseAdmin
        .from("ebd_turmas")
        .select("id")
        .eq("id", turmaId)
        .eq("church_id", churchId)
        .eq("is_active", true)
        .single();

      if (turmaError || !turma) {
        console.error("Turma inválida:", turmaError);
        return new Response(
          JSON.stringify({ error: "Turma selecionada não é válida para esta igreja" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verificar se já existe aluno com este email nesta igreja
    const { data: alunoExistente } = await supabaseAdmin
      .from("ebd_alunos")
      .select("id")
      .eq("church_id", churchId)
      .eq("email", email.toLowerCase())
      .single();

    if (alunoExistente) {
      return new Response(
        JSON.stringify({ error: "Já existe um aluno cadastrado com este email nesta igreja" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar usuário no Auth
    let userId: string | null = null;

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: senha,
      email_confirm: true,
      user_metadata: {
        full_name: nome,
        role: "aluno",
      },
    });

    if (authError) {
      // Se o email já existe, buscar o usuário existente
      if (authError.message?.includes("already been registered") || authError.message?.includes("email_exists")) {
        console.log("Email já existe, buscando usuário existente...");
        
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (existingUser) {
          userId = existingUser.id;
          
          // Atualizar senha do usuário existente
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: senha,
          });
          
          console.log("Usuário existente atualizado:", userId);
        } else {
          return new Response(
            JSON.stringify({ error: "Email já cadastrado em outra conta" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        console.error("Erro ao criar usuário:", authError);
        return new Response(
          JSON.stringify({ error: authError.message || "Erro ao criar conta" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      userId = authUser.user.id;
      console.log("Novo usuário criado:", userId);
    }

    // Criar registro do aluno
    const { data: aluno, error: alunoError } = await supabaseAdmin
      .from("ebd_alunos")
      .insert({
        church_id: churchId,
        nome_completo: nome.trim(),
        email: email.toLowerCase(),
        telefone: telefone || null,
        data_nascimento: dataNascimento || null,
        turma_id: turmaId || null,
        user_id: userId,
        is_active: true,
      })
      .select("id")
      .single();

    if (alunoError) {
      console.error("Erro ao criar aluno:", alunoError);
      return new Response(
        JSON.stringify({ error: alunoError.message || "Erro ao cadastrar aluno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Aluno cadastrado com sucesso:", aluno.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alunoId: aluno.id,
        userId: userId,
        message: "Cadastro realizado com sucesso!" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro inesperado:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
