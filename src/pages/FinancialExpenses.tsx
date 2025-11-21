import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Receipt, History, Repeat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useChurchData } from '@/hooks/useChurchData';
import { BillsToPayList } from '@/components/expenses/BillsToPayList';
import { RecurringExpensesList } from '@/components/expenses/RecurringExpensesList';
import { ExpenseHistoryList } from '@/components/expenses/ExpenseHistoryList';
import { RecurringExpenseDialog } from '@/components/expenses/RecurringExpenseDialog';
import { PaymentDialog } from '@/components/expenses/PaymentDialog';

interface ExpenseAccount {
  codigo_conta: string;
  nome_conta: string;
}

interface Bill {
  id: string;
  description: string;
  amount: number;
  category_main: string;
  category_sub: string;
  due_date: string;
  status: string;
  paid_date?: string;
  paid_amount?: number;
  receipt_path?: string;
  is_recurring: boolean;
}

interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  category_main: string;
  category_sub: string;
  frequency: string;
  due_day: number;
  end_date?: string;
  is_active: boolean;
}

const FinancialExpenses = () => {
  const { toast } = useToast();
  const { churchId } = useChurchData();
  const [bills, setBills] = useState<Bill[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [paidBills, setPaidBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  useEffect(() => {
    if (churchId) {
      fetchData();
    }
  }, [churchId]);

  const fetchData = async () => {
    if (!churchId) return;

    setLoading(true);
    try {
      // Buscar contas pendentes
      const { data: billsData, error: billsError } = await supabase
        .from('bills_to_pay')
        .select('*')
        .eq('church_id', churchId)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true });

      if (billsError) throw billsError;

      // Buscar despesas recorrentes
      const { data: recurringData, error: recurringError } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('church_id', churchId)
        .order('due_day', { ascending: true });

      if (recurringError) throw recurringError;

      // Buscar histórico (contas pagas)
      const { data: paidData, error: paidError } = await supabase
        .from('bills_to_pay')
        .select('*')
        .eq('church_id', churchId)
        .eq('status', 'paid')
        .order('paid_date', { ascending: false })
        .limit(100);

      if (paidError) throw paidError;

      // Atualizar status baseado na data
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const updatedBills = (billsData || []).map(bill => {
        const dueDate = new Date(bill.due_date);
        dueDate.setHours(0, 0, 0, 0);

        let status = 'pending';
        if (dueDate < today) {
          status = 'overdue';
        } else if (dueDate.getTime() === today.getTime()) {
          status = 'due_today';
        }

        return { ...bill, status };
      });

      setBills(updatedBills);
      setRecurringExpenses(recurringData || []);
      setPaidBills(paidData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as informações.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = (bill: Bill) => {
    setSelectedBill(bill);
    setPaymentDialogOpen(true);
  };

  const handlePaymentConfirm = async (
    paidDate: string,
    paidAmount: number,
    receiptFile?: File,
    pagoComConta?: string
  ) => {
    if (!selectedBill || !churchId) return;

    try {
      let receiptPath = null;

      // Upload do comprovante se fornecido
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${selectedBill.id}-${Date.now()}.${fileExt}`;
        const filePath = `${churchId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('payment-receipts')
          .upload(filePath, receiptFile);

        if (uploadError) throw uploadError;
        receiptPath = filePath;
      }

      // Atualizar a conta
      const { error: updateError } = await supabase
        .from('bills_to_pay')
        .update({
          status: 'paid',
          paid_date: paidDate,
          paid_amount: paidAmount,
          receipt_path: receiptPath,
        })
        .eq('id', selectedBill.id);

      if (updateError) throw updateError;

      // Criar lançamento contábil (partidas dobradas)
      // Débito: Conta de Despesa (aumenta despesa)
      // Crédito: Caixa/Banco (diminui ativo)
      if (pagoComConta) {
        // Mapear categoria para código do plano de contas
        const categoryMap: Record<string, Record<string, string>> = {
          'DESPESAS COM PESSOAL': {
            'Salários e Ordenados': '4.1.1.01',
            'Encargos Sociais': '4.1.1.02',
          },
          'DESPESAS ADMINISTRATIVAS': {
            'Aluguel': '4.2.2.03',
            'Água e Esgoto': '4.2.2.04',
            'Energia Elétrica': '4.2.2.05',
            'Telefone e Internet': '4.2.2.06',
            'Material de Escritório': '4.2.2.01',
          },
          'DESPESAS OPERACIONAIS': {
            'Manutenção do Templo': '4.2.2.02',
            'Missões e Evangelismo': '4.2.1.01',
            'Eventos e Congressos': '4.2.3.01',
          },
          'DESPESAS FINANCEIRAS': {
            'Juros e Multas': '4.3.1.01',
            'Tarifas Bancárias': '4.3.1.02',
          },
        };

        const contaDebito = categoryMap[selectedBill.category_main]?.[selectedBill.category_sub] || '4.2.9.99';
        
        // Mapear conta de pagamento para código do plano de contas
        let contaCredito = '1.1.1.01'; // Caixa Geral (Dinheiro) por padrão
        if (pagoComConta !== 'Caixa Geral (Dinheiro)') {
          contaCredito = '1.1.2.01'; // Contas Correntes para qualquer conta bancária
        }

        await supabase
          .from('lancamentos_contabeis')
          .insert({
            church_id: churchId,
            data: paidDate,
            historico: `Pagamento: ${selectedBill.description}`,
            conta_debito: contaDebito,
            conta_credito: contaCredito,
            valor: paidAmount,
            documento: selectedBill.id,
            expense_id: selectedBill.id,
          });
      }

      toast({
        title: 'Pagamento registrado!',
        description: 'A conta foi marcada como paga com sucesso.',
      });

      fetchData();
      setPaymentDialogOpen(false);
      setSelectedBill(null);
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast({
        title: 'Erro ao registrar pagamento',
        description: 'Não foi possível marcar a conta como paga.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveRecurring = async (data: Omit<RecurringExpense, 'id' | 'is_active'>) => {
    if (!churchId) return;

    try {
      // Inserir a despesa recorrente
      const { data: recurringData, error } = await supabase
        .from('recurring_expenses')
        .insert({
          church_id: churchId,
          ...data,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Gerar a primeira conta a pagar imediatamente
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      // Calcular a data de vencimento para este mês
      const dueDate = new Date(currentYear, currentMonth, data.due_day);
      
      // Se a data já passou neste mês, gerar para o próximo mês
      if (dueDate < today) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }

      // Criar a primeira conta a pagar
      const { error: billError } = await supabase.from('bills_to_pay').insert({
        church_id: churchId,
        description: data.description,
        amount: data.amount,
        category_main: data.category_main,
        category_sub: data.category_sub,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending',
        recurring_expense_id: recurringData.id,
        is_recurring: true,
      });

      if (billError) throw billError;

      toast({
        title: 'Despesa recorrente criada!',
        description: 'A despesa foi cadastrada e a primeira conta foi gerada.',
      });

      fetchData();
    } catch (error) {
      console.error('Error saving recurring expense:', error);
      toast({
        title: 'Erro ao criar despesa',
        description: 'Não foi possível cadastrar a despesa recorrente.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Despesa desativada!',
        description: 'A despesa recorrente foi desativada.',
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting recurring expense:', error);
      toast({
        title: 'Erro ao desativar despesa',
        description: 'Não foi possível desativar a despesa recorrente.',
        variant: 'destructive',
      });
    }
  };

  const handleViewReceipt = async (receiptPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(receiptPath, 60);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing receipt:', error);
      toast({
        title: 'Erro ao abrir comprovante',
        description: 'Não foi possível acessar o comprovante.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Contas a Pagar</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas despesas e contas recorrentes
          </p>
        </div>
      </div>

      <Tabs defaultValue="bills" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bills" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Contas a Pagar
          </TabsTrigger>
          <TabsTrigger value="recurring" className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            Despesas Recorrentes
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contas Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <BillsToPayList
                bills={bills}
                onMarkAsPaid={handleMarkAsPaid}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurring" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setRecurringDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Despesa Recorrente
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Despesas Recorrentes</CardTitle>
            </CardHeader>
            <CardContent>
              <RecurringExpensesList
                expenses={recurringExpenses}
                onDelete={handleDeleteRecurring}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpenseHistoryList
                bills={paidBills}
                onViewReceipt={handleViewReceipt}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecurringExpenseDialog
        open={recurringDialogOpen}
        onOpenChange={setRecurringDialogOpen}
        onSave={handleSaveRecurring}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        bill={selectedBill}
        onConfirm={handlePaymentConfirm}
      />
    </div>
  );
};

export default FinancialExpenses;