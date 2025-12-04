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

    console.log('Checking admin role for user:', user.id);

    // Check if user is admin using the has_role function via RPC or direct query
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('Role check error:', roleError);
      throw new Error('Erro ao verificar permissões');
    }

    if (!roleData) {
      console.log('User is not admin');
      throw new Error('Apenas administradores podem criar vendedores');
    }

    console.log('User is admin, proceeding with vendedor creation');

    const { email, password, nome, foto_url, comissao_percentual, status, meta_mensal_valor } = await req.json();

    if (!email || !password || !nome) {
      throw new Error('Email, senha e nome são obrigatórios');
    }

    // Check if email already exists in vendedores table
    const { data: existingVendedor } = await supabaseAdmin
      .from('vendedores')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingVendedor) {
      throw new Error('Já existe um vendedor com este email');
    }

    console.log('Creating auth user for:', email);

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
      if (createError.message?.includes('already been registered')) {
        throw new Error('Este email já está cadastrado no sistema');
      }
      throw new Error(createError.message || 'Erro ao criar usuário');
    }

    console.log('Auth user created:', authData.user.id);

    // Create vendedor
    const { data: vendedorData, error: vendedorError } = await supabaseAdmin
      .from('vendedores')
      .insert({
        nome,
        email,
        foto_url: foto_url || null,
        comissao_percentual: comissao_percentual || 5,
        status: status || 'Ativo',
        meta_mensal_valor: meta_mensal_valor || 0,
      })
      .select()
      .single();

    if (vendedorError) {
      console.error('Vendedor creation error:', vendedorError);
      // Rollback: delete the created user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      if (vendedorError.message?.includes('duplicate key')) {
        throw new Error('Já existe um vendedor com este email');
      }
      throw new Error(vendedorError.message || 'Erro ao criar vendedor');
    }

    console.log('Vendedor created:', vendedorData.id);

    // Create profile linking to vendedor
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: nome,
        avatar_url: foto_url || null,
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Not critical, continue anyway
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        userId: authData.user.id,
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
