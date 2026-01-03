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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('Checking admin/gerente role for user:', user.id);

    // Check if user is admin or gerente_ebd
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'gerente_ebd'])
      .maybeSingle();

    if (roleError) {
      console.error('Role check error:', roleError);
      throw new Error('Erro ao verificar permissões');
    }

    if (!roleData) {
      console.log('User is not admin or gerente_ebd');
      throw new Error('Apenas administradores e gerentes podem criar vendedores/representantes');
    }

    console.log('User has permission, proceeding with creation');

    const { 
      email, 
      password, 
      nome, 
      foto_url, 
      comissao_percentual, 
      status, 
      meta_mensal_valor,
      tipo_perfil = 'vendedor' // Default to vendedor if not specified
    } = await req.json();

    if (!email || !password || !nome) {
      throw new Error('Email, senha e nome são obrigatórios');
    }

    // Validate tipo_perfil
    if (!['vendedor', 'representante'].includes(tipo_perfil)) {
      throw new Error('Tipo de perfil inválido. Use "vendedor" ou "representante"');
    }

    // Check if email already exists in vendedores table
    const { data: existingVendedor } = await supabaseAdmin
      .from('vendedores')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingVendedor) {
      throw new Error('Já existe um vendedor/representante com este email');
    }

    console.log('Creating auth user for:', email);

    // Check if auth user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    let authUserId: string;

    if (existingUser) {
      console.log('Auth user already exists:', existingUser.id);
      authUserId = existingUser.id;
      
      // Update user metadata
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { full_name: nome },
        password: password,
      });
    } else {
      // Create auth user
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: nome,
        },
      });

      if (createError) {
        console.error('Create user error:', createError);
        throw new Error(createError.message || 'Erro ao criar usuário');
      }

      console.log('Auth user created:', authData.user.id);
      authUserId = authData.user.id;
    }

    // Create vendedor with tipo_perfil
    const { data: vendedorData, error: vendedorError } = await supabaseAdmin
      .from('vendedores')
      .insert({
        nome,
        email,
        foto_url: foto_url || null,
        comissao_percentual: comissao_percentual || 5,
        status: status || 'Ativo',
        meta_mensal_valor: meta_mensal_valor || 0,
        tipo_perfil: tipo_perfil,
      })
      .select()
      .single();

    if (vendedorError) {
      console.error('Vendedor creation error:', vendedorError);
      // Rollback: delete the created user only if we created a new one
      if (!existingUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      
      if (vendedorError.message?.includes('duplicate key')) {
        throw new Error('Já existe um vendedor/representante com este email');
      }
      throw new Error(vendedorError.message || 'Erro ao criar vendedor/representante');
    }

    console.log('Vendedor/Representante created:', vendedorData.id);

    // Create or update profile linking to vendedor
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUserId,
        email,
        full_name: nome,
        avatar_url: foto_url || null,
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Not critical, continue anyway
    }

    // Create user_role based on tipo_perfil
    // For representante, we use the 'representante' role
    // For vendedor, we don't create a specific role (they access via vendedores table)
    if (tipo_perfil === 'representante') {
      const { error: roleInsertError } = await supabaseAdmin
        .from('user_roles')
        .upsert({
          user_id: authUserId,
          role: 'representante',
        });

      if (roleInsertError) {
        console.error('Role creation error:', roleInsertError);
        // Not critical for operation, continue
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        userId: authUserId,
        vendedor: vendedorData,
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