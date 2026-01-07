import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { email, newPassword } = await req.json();
    
    // Check authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) {
      throw new Error('Unauthorized');
    }

    // Check if caller is admin or gerente_ebd
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id);
    
    const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'gerente_ebd');
    if (!isAdmin) {
      throw new Error('Sem permissão para alterar senhas');
    }

    if (!email || !newPassword) {
      throw new Error('Email e nova senha são obrigatórios');
    }

    if (newPassword.length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres');
    }

    // Find user by email - paginate through all users
    const emailLower = email.toLowerCase();
    let targetUser = null;
    let page = 1;
    const perPage = 1000; // Max allowed per page

    while (!targetUser) {
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listError) throw listError;

      targetUser = usersData.users.find(u => u.email?.toLowerCase() === emailLower);
      
      // If we found the user or there are no more users to check, break
      if (targetUser || usersData.users.length < perPage) {
        break;
      }
      page++;
    }

    if (!targetUser) {
      throw new Error(`Usuário com email ${email} não encontrado no sistema de autenticação`);
    }

    console.log(`[UPDATE-PASSWORD] Usuário encontrado: ${targetUser.id} para email: ${email}`);

    // Update the user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    console.log(`[UPDATE-PASSWORD] Senha atualizada para usuário: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Senha atualizada com sucesso',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[UPDATE-PASSWORD] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
