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

    const { email, password, fullName, role } = await req.json();

    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios');
    }

    console.log('Creating user:', email, 'with role:', role);

    // Check if auth user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    let authUserId: string;

    if (existingUser) {
      console.log('Auth user already exists:', existingUser.id);
      authUserId = existingUser.id;
      
      // Update user metadata and password
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { full_name: fullName || email },
        password: password,
      });
    } else {
      // Create auth user
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || email,
        },
      });

      if (createError) {
        console.error('Create user error:', createError);
        throw new Error(createError.message || 'Erro ao criar usuário');
      }

      console.log('Auth user created:', authData.user.id);
      authUserId = authData.user.id;
    }

    // Create or update profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUserId,
        email,
        full_name: fullName || email,
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
    }

    // Create or update user role
    if (role) {
      // Delete existing role if any
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', authUserId);

      // Insert new role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: authUserId,
          role: role,
        });

      if (roleError) {
        console.error('Role creation error:', roleError);
        throw new Error(roleError.message || 'Erro ao atribuir role');
      }

      console.log('Role assigned:', role);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        userId: authUserId,
        email,
        role,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
