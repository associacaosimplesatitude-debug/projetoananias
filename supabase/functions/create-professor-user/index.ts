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
      console.error('Auth error in create-professor-user:', authError);
      throw new Error('Unauthorized');
    }

    const { email, password, fullName, churchId } = await req.json();

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (!churchId) {
      throw new Error('Church ID is required');
    }

    console.log(`Creating professor user for email: ${email}, churchId: ${churchId}`);

    let userId: string;

    // Try to create the user first
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'professor',
        church_id: churchId,
      },
    });

    if (createError) {
      // If user already exists, find them and update their password
      if (createError.code === 'email_exists') {
        console.log('User already exists, searching for existing user...');
        
        // Use listUsers with proper pagination to find the user
        let foundUser = null;
        let page = 1;
        const perPage = 1000;
        
        while (!foundUser) {
          const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
          });
          
          if (listError) {
            console.error('Error listing users:', listError);
            throw listError;
          }
          
          foundUser = usersPage?.users?.find(
            (u) => u.email?.toLowerCase() === email.toLowerCase(),
          );
          
          if (foundUser || !usersPage?.users?.length || usersPage.users.length < perPage) {
            break;
          }
          page++;
        }
        
        if (foundUser) {
          console.log(`Found existing user with id: ${foundUser.id}`);
          userId = foundUser.id;
          
          // Update password for existing user
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            foundUser.id,
            {
              password,
              email_confirm: true,
              user_metadata: {
                full_name: fullName,
                role: 'professor',
                church_id: churchId,
              },
            },
          );

          if (updateError) {
            console.error('Error updating existing user:', updateError);
            throw updateError;
          }
          console.log('Updated existing user password');
        } else {
          console.error('User exists but could not be found in listing');
          throw new Error('Usuário com este email já existe em outra igreja');
        }
      } else {
        console.error('Error creating auth user:', createError);
        throw createError;
      }
    } else {
      userId = authData.user.id;
      console.log(`Created new professor user with id: ${userId}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in create-professor-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
