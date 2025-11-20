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
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      throw new Error('Only admins can create clients');
    }

    const { churchData, password } = await req.json();

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
      throw createError;
    }

    if (!newUser.user) {
      throw new Error('Failed to create user');
    }

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
        user_id: newUser.user.id,
        process_status: churchData.has_cnpj ? 'completed' : 'in_progress',
        current_stage: churchData.has_cnpj ? 6 : 1,
      })
      .select()
      .single();

    if (churchError) {
      // Rollback: delete the created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw churchError;
    }

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
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      await supabaseAdmin.from('churches').delete().eq('id', church.id);
      throw profileError;
    }

    // Create client role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: 'client',
      });

    if (roleError) {
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      await supabaseAdmin.from('churches').delete().eq('id', church.id);
      await supabaseAdmin.from('profiles').delete().eq('id', newUser.user.id);
      throw roleError;
    }

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
