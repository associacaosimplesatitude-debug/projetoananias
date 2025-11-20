import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    console.log('Starting recurring bills generation...');

    // Buscar todas as despesas recorrentes ativas
    const { data: recurringExpenses, error: fetchError } = await supabaseClient
      .from('recurring_expenses')
      .select('*')
      .eq('is_active', true);

    if (fetchError) {
      console.error('Error fetching recurring expenses:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${recurringExpenses?.length || 0} active recurring expenses`);

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    let generatedCount = 0;

    for (const expense of recurringExpenses || []) {
      // Verificar se já existe uma conta para este mês
      const dueDate = new Date(currentYear, currentMonth - 1, expense.due_day);
      
      // Se a data de vencimento já passou, pular
      if (dueDate < new Date(today.getFullYear(), today.getMonth(), 1)) {
        continue;
      }

      // Verificar se end_date foi definido e já passou
      if (expense.end_date) {
        const endDate = new Date(expense.end_date);
        if (dueDate > endDate) {
          console.log(`Expense ${expense.id} end date has passed, deactivating...`);
          await supabaseClient
            .from('recurring_expenses')
            .update({ is_active: false })
            .eq('id', expense.id);
          continue;
        }
      }

      // Verificar se já existe uma conta para este mês
      const { data: existingBill } = await supabaseClient
        .from('bills_to_pay')
        .select('id')
        .eq('recurring_expense_id', expense.id)
        .gte('due_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
        .lt('due_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
        .maybeSingle();

      if (existingBill) {
        console.log(`Bill already exists for expense ${expense.id} in month ${currentMonth}`);
        continue;
      }

      // Criar nova conta a pagar
      const { error: insertError } = await supabaseClient
        .from('bills_to_pay')
        .insert({
          church_id: expense.church_id,
          description: expense.description,
          amount: expense.amount,
          category_main: expense.category_main,
          category_sub: expense.category_sub,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'pending',
          recurring_expense_id: expense.id,
          is_recurring: true,
        });

      if (insertError) {
        console.error(`Error creating bill for expense ${expense.id}:`, insertError);
      } else {
        generatedCount++;
        console.log(`Created bill for expense ${expense.id}`);
      }
    }

    console.log(`Generated ${generatedCount} recurring bills`);

    return new Response(
      JSON.stringify({
        success: true,
        generatedCount,
        message: `Successfully generated ${generatedCount} recurring bills`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in generate-recurring-bills function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});