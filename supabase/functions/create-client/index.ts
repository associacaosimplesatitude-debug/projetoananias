import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify that the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado: token de autenticação não fornecido' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado: token inválido' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem criar clientes' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      );
    }

    const { churchData, password } = await req.json();

    // Validação dos dados obrigatórios
    if (!churchData.church_name || !churchData.pastor_email || !password) {
      return new Response(
        JSON.stringify({ error: 'Dados obrigatórios não fornecidos: nome, email e senha são requeridos' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Validar client_type
    if (!churchData.client_type || !['igreja', 'associacao'].includes(churchData.client_type)) {
      churchData.client_type = 'igreja'; // Default
    }

    console.log('Creating user with email:', churchData.pastor_email);

    // Create user with admin API (doesn't change current session)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: churchData.pastor_email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: churchData.pastor_name || '',
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      
      // Tratar erro de email já existente
      if (createError.message?.includes('already registered') || createError.message?.includes('already been registered')) {
        return new Response(
          JSON.stringify({ error: 'Este email já está cadastrado no sistema. Use um email diferente.' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Erro ao criar usuário: ${createError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'Falha ao criar usuário: resposta inválida da API' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log('User created successfully, creating church record');

    // Create church with conditional status based on has_cnpj
    const { data: church, error: churchError } = await supabaseAdmin
      .from('churches')
      .insert({
        church_name: churchData.church_name,
        pastor_email: churchData.pastor_email,
        pastor_name: churchData.pastor_name,
        pastor_rg: churchData.pastor_rg,
        pastor_cpf: churchData.pastor_cpf,
        pastor_whatsapp: churchData.pastor_whatsapp,
        cnpj: churchData.cnpj,
        city: churchData.city,
        state: churchData.state,
        address: churchData.address,
        neighborhood: churchData.neighborhood,
        postal_code: churchData.postal_code,
        monthly_fee: churchData.monthly_fee,
        payment_due_day: churchData.payment_due_day,
        client_type: churchData.client_type || 'igreja',
        user_id: newUser.user.id,
        process_status: churchData.has_cnpj ? 'completed' : 'in_progress',
        current_stage: churchData.has_cnpj ? 6 : 1,
      })
      .select()
      .single();

    if (churchError) {
      console.error('Error creating church:', churchError);
      // Rollback: delete the created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: `Erro ao criar registro da igreja: ${churchError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    if (!church || !church.id) {
      console.error('Church created but no ID returned');
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar igreja: ID não retornado' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log('Church created successfully, creating profile');

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        email: churchData.pastor_email,
        full_name: churchData.pastor_name || '',
        church_id: church.id,
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      await supabaseAdmin.from('churches').delete().eq('id', church.id);
      return new Response(
        JSON.stringify({ error: `Erro ao criar perfil do usuário: ${profileError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    console.log('Profile created successfully, creating role');

    // Create client role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: 'client',
      });

    if (roleError) {
      console.error('Error creating role:', roleError);
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      await supabaseAdmin.from('churches').delete().eq('id', church.id);
      await supabaseAdmin.from('profiles').delete().eq('id', newUser.user.id);
      return new Response(
        JSON.stringify({ error: `Erro ao atribuir papel de cliente: ${roleError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    console.log('Client created successfully:', church.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUser.user.id,
        churchId: church.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error creating client:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        error: `Erro ao criar cliente: ${errorMessage}`,
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
