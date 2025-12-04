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
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      throw new Error('Only admins can create vendedores');
    }

    const { email, password, nome, foto_url, comissao_percentual, status, meta_mensal_valor } = await req.json();

    if (!email || !password || !nome) {
      throw new Error('Email, senha e nome são obrigatórios');
    }

    // Create auth user
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: nome,
      },
    });

    if (createError) throw createError;

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
      // Rollback: delete the created user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw vendedorError;
    }

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
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
