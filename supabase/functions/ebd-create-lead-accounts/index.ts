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

    // Check if called by cron (no auth header) or by admin user
    const authHeader = req.headers.get('Authorization');
    const isCronJob = !authHeader || authHeader === `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`;
    
    if (!isCronJob) {
      // Verify admin role for manual calls
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError || !user) {
        throw new Error('Unauthorized');
      }

      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleData?.role !== 'admin') {
        throw new Error('Only admins can create lead accounts');
      }
    }

    console.log(`[ebd-create-lead-accounts] Starting account creation. Is cron job: ${isCronJob}`);

    // Get the EBD module ID
    const { data: ebdModule, error: moduleError } = await supabaseAdmin
      .from('modulos')
      .select('id')
      .eq('nome_modulo', 'REOBOTE EBD')
      .single();

    if (moduleError || !ebdModule) {
      console.error('[ebd-create-lead-accounts] Could not find REOBOTE EBD module:', moduleError);
      throw new Error('REOBOTE EBD module not found');
    }

    console.log(`[ebd-create-lead-accounts] Found EBD module: ${ebdModule.id}`);

    // Get leads without accounts created
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from('ebd_leads_reativacao')
      .select('*')
      .eq('conta_criada', false)
      .not('email', 'is', null);

    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      console.log('[ebd-create-lead-accounts] No leads to create accounts for');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum lead para criar conta',
          created: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ebd-create-lead-accounts] Found ${leads.length} leads to process`);

    const results = {
      created: 0,
      errors: [] as string[],
    };

    for (const lead of leads) {
      try {
        if (!lead.email) {
          results.errors.push(`Lead ${lead.nome_igreja}: sem e-mail`);
          continue;
        }

        console.log(`[ebd-create-lead-accounts] Processing lead: ${lead.nome_igreja} (${lead.email})`);

        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === lead.email.toLowerCase());

        let userId: string;

        if (existingUser) {
          console.log(`[ebd-create-lead-accounts] User already exists for ${lead.email}, using existing user`);
          userId = existingUser.id;
        } else {
          // Create user in auth
          const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email: lead.email,
            password: 'mudar123',
            email_confirm: true,
            user_metadata: {
              full_name: lead.nome_responsavel || lead.nome_igreja,
            }
          });

          if (createUserError) {
            results.errors.push(`Lead ${lead.nome_igreja}: ${createUserError.message}`);
            continue;
          }

          if (!authData.user) {
            results.errors.push(`Lead ${lead.nome_igreja}: usuário não criado`);
            continue;
          }

          userId = authData.user.id;
          console.log(`[ebd-create-lead-accounts] Created auth user: ${userId}`);
        }

        // Create/update profile with senha_padrao_usada = true
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            email: lead.email,
            full_name: lead.nome_responsavel || lead.nome_igreja,
            senha_padrao_usada: true,
          });

        if (profileError) {
          console.error('[ebd-create-lead-accounts] Profile error:', profileError);
        }

        // Assign client role (upsert to avoid duplicates)
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .upsert({
            user_id: userId,
            role: 'client',
          }, { onConflict: 'user_id,role' });

        if (roleError) {
          console.error('[ebd-create-lead-accounts] Role error:', roleError);
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
          console.log(`[ebd-create-lead-accounts] Using existing church: ${churchId}`);
        } else {
          // Create church record for the lead
          const { data: churchData, error: churchError } = await supabaseAdmin
            .from('churches')
            .insert({
              user_id: userId,
              church_name: lead.nome_igreja,
              pastor_email: lead.email,
              pastor_name: lead.nome_responsavel,
              pastor_whatsapp: lead.telefone,
              cnpj: lead.cnpj,
              address: lead.endereco_rua ? `${lead.endereco_rua}, ${lead.endereco_numero || 'S/N'}` : null,
              neighborhood: lead.endereco_bairro,
              city: lead.endereco_cidade,
              state: lead.endereco_estado,
              postal_code: lead.endereco_cep,
              client_type: 'igreja',
              process_status: 'active',
            })
            .select('id')
            .single();

          if (churchError) {
            console.error('[ebd-create-lead-accounts] Church creation error:', churchError);
            results.errors.push(`Lead ${lead.nome_igreja}: erro ao criar igreja - ${churchError.message}`);
            continue;
          }

          churchId = churchData.id;
          console.log(`[ebd-create-lead-accounts] Created church: ${churchId}`);
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
            console.error('[ebd-create-lead-accounts] Subscription error:', subscriptionError);
          } else {
            console.log(`[ebd-create-lead-accounts] Created EBD subscription for church: ${churchId}`);
          }
        } else {
          console.log(`[ebd-create-lead-accounts] Subscription already exists for church: ${churchId}`);
        }

        // Update lead with conta_criada = true and lead_score = 'Quente'
        const { error: updateLeadError } = await supabaseAdmin
          .from('ebd_leads_reativacao')
          .update({ 
            conta_criada: true,
            lead_score: 'Quente',
          })
          .eq('id', lead.id);

        if (updateLeadError) {
          console.error('[ebd-create-lead-accounts] Update lead error:', updateLeadError);
        }

        results.created++;
        console.log(`[ebd-create-lead-accounts] Successfully processed lead: ${lead.nome_igreja} (user: ${userId}, church: ${churchId})`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Lead ${lead.nome_igreja}: ${errorMessage}`);
        console.error(`[ebd-create-lead-accounts] Error processing lead ${lead.nome_igreja}:`, errorMessage);
      }
    }

    console.log(`[ebd-create-lead-accounts] Finished. Created: ${results.created}, Errors: ${results.errors.length}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${results.created} contas criadas com sucesso`,
        created: results.created,
        errors: results.errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error in ebd-create-lead-accounts:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
