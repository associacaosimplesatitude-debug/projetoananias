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

    const { email, password, fullName, clienteId } = await req.json();

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    console.log(`Creating user for email: ${email}, clienteId: ${clienteId || 'not provided'}`);

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    let userId: string;
    
    if (existingUser) {
      console.log(`User already exists with id: ${existingUser.id}`);
      userId = existingUser.id;
      
      // Update password if provided
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
      });
      
      if (updateError) {
        console.error('Error updating existing user:', updateError);
        throw updateError;
      }
    } else {
      // Create new auth user
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

      if (createError) {
        console.error('Error creating auth user:', createError);
        throw createError;
      }
      
      userId = authData.user.id;
      console.log(`Created new user with id: ${userId}`);

      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email,
          full_name: fullName,
        }, { onConflict: 'id' });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // Rollback: delete the created user
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw profileError;
      }
    }

    // If clienteId is provided, update the ebd_clientes table
    if (clienteId) {
      console.log(`Updating ebd_clientes with superintendente_user_id: ${userId}`);
      const { error: updateClienteError } = await supabaseAdmin
        .from('ebd_clientes')
        .update({ 
          superintendente_user_id: userId,
          status_ativacao_ebd: true,
          senha_temporaria: password,
        })
        .eq('id', clienteId);

      if (updateClienteError) {
        console.error('Error updating ebd_clientes:', updateClienteError);
        throw updateClienteError;
      }
      console.log('Successfully updated ebd_clientes');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        userId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-ebd-user:', error);
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
