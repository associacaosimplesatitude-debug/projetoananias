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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      throw new Error('Unauthorized');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error in create-autor-user:', authError);
      throw new Error('Unauthorized');
    }

    const { email, password, fullName } = await req.json();

    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios');
    }

    console.log(`Creating/updating autor user for email: ${email}`);

    let userId: string;

    // Try to create the user first
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      // If user already exists, find them by email and update password
      if (createError.code === 'email_exists') {
        console.log('User already exists, finding by email...');
        
        // Use listUsers with email filter instead of loading all users
        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 50,
          filter: email.toLowerCase(),
        });

        if (listError) {
          console.error('Error listing users:', listError);
          throw listError;
        }

        const foundUser = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (foundUser) {
          userId = foundUser.id;
          console.log(`Found existing user with id: ${userId}, updating password...`);

          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            {
              password,
              email_confirm: true,
            }
          );

          if (updateError) {
            console.error('Error updating existing user:', updateError);
            throw updateError;
          }
          console.log('Updated existing user password');
        } else {
          console.error('User exists but could not be found with filter');
          throw new Error('Usuário existe mas não foi encontrado');
        }
      } else {
        console.error('Error creating auth user:', createError);
        throw createError;
      }
    } else {
      userId = authData.user.id;
      console.log(`Created new user with id: ${userId}`);
    }

    // Create or update profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          email,
          full_name: fullName,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      console.error('Error creating/updating profile:', profileError);
      // Don't throw - profile might already exist
    }

    // Add 'autor' role if not exists
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'autor')
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: 'autor' });

      if (roleError) {
        console.error('Error adding autor role:', roleError);
        // Don't throw - role might already exist
      } else {
        console.log('Added autor role to user');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-autor-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
