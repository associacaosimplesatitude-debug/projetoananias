import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      { auth: { persistSession: false } }
    );

    const { nomeIgreja, nomeResponsavel, email, telefone } = await req.json();

    if (!email || !nomeIgreja || !nomeResponsavel || !telefone) {
      throw new Error('Dados incompletos');
    }

    console.log(`[ebd-instant-signup] Creating instant account for: ${email}`);

    // Get the EBD module ID
    const { data: ebdModule, error: moduleError } = await supabaseAdmin
      .from('modulos')
      .select('id')
      .eq('nome_modulo', 'REOBOTE EBD')
      .single();

    if (moduleError || !ebdModule) {
      console.error('[ebd-instant-signup] Could not find REOBOTE EBD module:', moduleError);
      throw new Error('REOBOTE EBD module not found');
    }

    // Generate a temporary password
    const tempPassword = 'mudar123';

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;
    let userAlreadyExists = false;

    if (existingUser) {
      console.log(`[ebd-instant-signup] User already exists for ${email}`);
      userId = existingUser.id;
      userAlreadyExists = true;
    } else {
      // Create user in auth
      const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: nomeResponsavel || nomeIgreja,
        }
      });

      if (createUserError) {
        console.error('[ebd-instant-signup] Error creating user:', createUserError);
        throw new Error(`Erro ao criar usuário: ${createUserError.message}`);
      }

      if (!authData.user) {
        throw new Error('Usuário não foi criado');
      }

      userId = authData.user.id;
      console.log(`[ebd-instant-signup] Created auth user: ${userId}`);

      // Create profile with senha_padrao_usada = true
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email: email,
          full_name: nomeResponsavel || nomeIgreja,
          senha_padrao_usada: true,
        });

      if (profileError) {
        console.error('[ebd-instant-signup] Profile error:', profileError);
      }

      // Assign client role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: 'client',
        }, { onConflict: 'user_id,role' });

      if (roleError) {
        console.error('[ebd-instant-signup] Role error:', roleError);
      }
    }

    // Check if church already exists for this user
    const { data: existingChurch } = await supabaseAdmin
      .from('churches')
      .select('id')
      .eq('user_id', userId)
      .single();

    let churchId: string;

    if (existingChurch) {
      churchId = existingChurch.id;
      console.log(`[ebd-instant-signup] Using existing church: ${churchId}`);
    } else {
      // Create church record
      const { data: churchData, error: churchError } = await supabaseAdmin
        .from('churches')
        .insert({
          user_id: userId,
          church_name: nomeIgreja,
          pastor_email: email,
          pastor_name: nomeResponsavel,
          pastor_whatsapp: telefone,
          client_type: 'igreja',
          process_status: 'active',
        })
        .select('id')
        .single();

      if (churchError) {
        console.error('[ebd-instant-signup] Church creation error:', churchError);
        throw new Error(`Erro ao criar igreja: ${churchError.message}`);
      }

      churchId = churchData.id;
      console.log(`[ebd-instant-signup] Created church: ${churchId}`);
    }

    // Check if subscription already exists
    const { data: existingSubscription } = await supabaseAdmin
      .from('assinaturas')
      .select('id')
      .eq('cliente_id', churchId)
      .eq('modulo_id', ebdModule.id)
      .single();

    if (!existingSubscription) {
      // Create subscription for REOBOTE EBD module
      const { error: subscriptionError } = await supabaseAdmin
        .from('assinaturas')
        .insert({
          cliente_id: churchId,
          modulo_id: ebdModule.id,
          status: 'Ativo',
        });

      if (subscriptionError) {
        console.error('[ebd-instant-signup] Subscription error:', subscriptionError);
      } else {
        console.log(`[ebd-instant-signup] Created EBD subscription for church: ${churchId}`);
      }
    }

    // Also save to leads table for tracking
    await supabaseAdmin.from('ebd_leads_reativacao').insert({
      nome_igreja: nomeIgreja,
      nome_responsavel: nomeResponsavel,
      email: email,
      telefone: telefone,
      status_lead: 'convertido',
      lead_score: 'quente',
      conta_criada: true
    });

    console.log(`[ebd-instant-signup] Successfully created instant account for: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: userAlreadyExists ? 'Conta já existe' : 'Conta criada com sucesso',
        email: email,
        password: userAlreadyExists ? null : tempPassword,
        userAlreadyExists
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error in ebd-instant-signup:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
