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

    // Verify admin role
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
      .single();

    if (roleData?.role !== 'admin') {
      throw new Error('Only admins can create lead accounts');
    }

    // Get leads without accounts created
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from('ebd_leads_reativacao')
      .select('*')
      .eq('conta_criada', false)
      .not('email', 'is', null);

    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum lead para criar conta',
          created: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

        // Create/update profile with senha_padrao_usada = true
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email: lead.email,
            full_name: lead.nome_responsavel || lead.nome_igreja,
            senha_padrao_usada: true,
          });

        if (profileError) {
          console.error('Profile error:', profileError);
        }

        // Assign superintendente role
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role: 'superintendente',
          });

        if (roleError) {
          console.error('Role error:', roleError);
        }

        // Update lead with conta_criada = true
        const { error: updateLeadError } = await supabaseAdmin
          .from('ebd_leads_reativacao')
          .update({ conta_criada: true })
          .eq('id', lead.id);

        if (updateLeadError) {
          console.error('Update lead error:', updateLeadError);
        }

        results.created++;
        console.log(`Created account for lead: ${lead.nome_igreja}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Lead ${lead.nome_igreja}: ${errorMessage}`);
      }
    }

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
