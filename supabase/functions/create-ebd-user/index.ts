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
      console.error('Auth error in create-ebd-user:', authError);
      throw new Error('Unauthorized');
    }

    const { email, password, fullName, clienteId } = await req.json();

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    console.log(`Creating/updating user for email: ${email}, clienteId: ${clienteId || 'not provided'}`);

    // If we have a clienteId, try to get the existing superintendente_user_id first
    let existingUserIdFromCliente: string | null = null;
    if (clienteId) {
      const { data: clienteRow, error: clienteError } = await supabaseAdmin
        .from('ebd_clientes')
        .select('superintendente_user_id')
        .eq('id', clienteId)
        .single();

      if (clienteError) {
        console.error('Error fetching ebd_clientes row:', clienteError);
      } else if (clienteRow?.superintendente_user_id) {
        existingUserIdFromCliente = clienteRow.superintendente_user_id;
        console.log(`Found existing superintendente_user_id: ${existingUserIdFromCliente}`);
      }
    }

    let userId: string;

    if (existingUserIdFromCliente) {
      // Update the existing auth user by id (email and password)
      const { error: updateByIdError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUserIdFromCliente,
        {
          email,
          password,
          email_confirm: true,
        },
      );

      if (updateByIdError) {
        console.error('Error updating existing user by id:', updateByIdError);
        throw updateByIdError;
      }

      userId = existingUserIdFromCliente;
      console.log(`Updated existing user by id: ${userId}`);
    } else {
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
              },
            );

            if (updateError) {
              console.error('Error updating existing user:', updateError);
              throw updateError;
            }
            console.log('Updated existing user password');
          } else {
            console.error('User exists but could not be found in listing');
            throw new Error('User exists but could not be found');
          }
        } else {
          console.error('Error creating auth user:', createError);
          throw createError;
        }
      } else {
        userId = authData.user.id;
        console.log(`Created new user with id: ${userId}`);

        // Create or update profile
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert(
            {
              id: userId,
              email,
              full_name: fullName,
            },
            { onConflict: 'id' },
          );

        if (profileError) {
          console.error('Error creating/updating profile:', profileError);
          // Rollback: delete the created user
          await supabaseAdmin.auth.admin.deleteUser(userId);
          throw profileError;
        }
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
          email_superintendente: email,
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in create-ebd-user:', error);
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
