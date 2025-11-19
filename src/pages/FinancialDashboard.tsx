import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, LayoutDashboard, CalendarClock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { useChurchData } from '@/hooks/useChurchData';

const FinancialDashboard = () => {
  const { user } = useAuth();
  const { churchId } = useChurchData();
  const [mandateEndDate, setMandateEndDate] = useState<string | null>(null);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);
  const [entries, setEntries] = useState<Array<{ tipo: string; valor: number }>>([]);
  const [expenses, setExpenses] = useState<Array<{ categoria: string; valor: number }>>([]);

  useEffect(() => {
    const fetchMandate = async () => {
      if (!user) return;

      // Buscar o perfil do usuário para obter a igreja vinculada
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('church_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile?.church_id) {
        return;
      }

      // Buscar o mandato da igreja
      const { data: mandate } = await supabase
        .from('board_mandates')
        .select('end_date')
        .eq('church_id', profile.church_id)
        .maybeSingle();

      if (mandate) {
        setMandateEndDate(mandate.end_date);
        
        // Calcular dias até o vencimento
        const endDate = new Date(mandate.end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setDaysUntilExpiry(diffDays);
      }
    };

    fetchMandate();
  }, [user]);

  // Buscar dados financeiros do banco
  useEffect(() => {
    const fetchFinancialData = async () => {
      if (!churchId) return;

      // Buscar entradas
      const { data: entriesData } = await supabase
        .from('financial_entries')
        .select('tipo, valor')
        .eq('church_id', churchId);

      if (entriesData && entriesData.length > 0) {
        // Agrupar por tipo
        const groupedEntries = entriesData.reduce((acc: Record<string, number>, entry) => {
          acc[entry.tipo] = (acc[entry.tipo] || 0) + Number(entry.valor);
          return acc;
        }, {});

        setEntries(Object.entries(groupedEntries).map(([tipo, valor]) => ({ tipo, valor })));
      } else {
        setEntries([]);
      }

      // Buscar despesas
      const { data: expensesData } = await supabase
        .from('financial_expenses')
        .select('categoria_main, valor')
        .eq('church_id', churchId);

      if (expensesData && expensesData.length > 0) {
        // Agrupar por categoria principal
        const groupedExpenses = expensesData.reduce((acc: Record<string, number>, expense) => {
          acc[expense.categoria_main] = (acc[expense.categoria_main] || 0) + Number(expense.valor);
          return acc;
        }, {});

        setExpenses(Object.entries(groupedExpenses).map(([categoria, valor]) => ({ categoria, valor })));
      } else {
        setExpenses([]);
      }
    };

    fetchFinancialData();
  }, [churchId]);

  const totalEntries = useMemo(() => entries.reduce((sum, e) => sum + e.valor, 0), [entries]);
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.valor, 0), [expenses]);
  const balance = totalEntries - totalExpenses;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const COLORS_ENTRIES = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'];
  const COLORS_EXPENSES = ['#ef4444', '#f97316', '#f59e0b', '#dc2626'];

  const entriesData = entries.map((entry, index) => ({
    ...entry,
    percentage: ((entry.valor / totalEntries) * 100).toFixed(1),
    fill: COLORS_ENTRIES[index],
  }));

  const expensesData = expenses.map((expense, index) => ({
    ...expense,
    percentage: ((expense.valor / totalExpenses) * 100).toFixed(1),
    fill: COLORS_EXPENSES[index],
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary text-primary-foreground">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Dashboard Financeiro</h1>
              <p className="text-muted-foreground">Visão geral das finanças da igreja</p>
            </div>
          </div>
        </div>

        {/* Mandate Expiry Alert */}
        {mandateEndDate && (
          <Card className="mb-8 border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary text-primary-foreground">
                    <CalendarClock className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Vencimento do Mandato da Diretoria
                    </h3>
                    <p className="text-4xl font-bold">
                      {new Date(mandateEndDate).toLocaleDateString('pt-BR', { 
                        day: '2-digit', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
                {daysUntilExpiry !== null && (
                  <Badge 
                    variant={daysUntilExpiry <= 30 ? "destructive" : daysUntilExpiry <= 90 ? "secondary" : "default"}
                    className="text-lg px-4 py-2"
                  >
                    {daysUntilExpiry > 0 
                      ? `Faltam ${daysUntilExpiry} dias` 
                      : daysUntilExpiry === 0
                      ? 'Vence hoje!'
                      : `Vencido há ${Math.abs(daysUntilExpiry)} dias`
                    }
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Indicators */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card className={balance >= 0 ? 'border-success/50 bg-success/5' : 'border-destructive/50 bg-destructive/5'}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
              <Wallet className={`h-5 w-5 ${balance >= 0 ? 'text-success' : 'text-destructive'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(balance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Referente ao mês atual
              </p>
            </CardContent>
          </Card>

          <Card className="border-success/50 bg-success/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Entradas</CardTitle>
              <TrendingUp className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{formatCurrency(totalEntries)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                No mês atual
              </p>
            </CardContent>
          </Card>

          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Saídas</CardTitle>
              <TrendingDown className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                {formatCurrency(totalExpenses)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                No mês atual
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Entries Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Entradas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={entriesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ tipo, percentage }) => `${tipo}: ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="valor"
                  >
                    {entriesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                {entriesData.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: entry.fill }}
                      />
                      <span>{entry.tipo}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(entry.valor)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Expenses Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={expensesData}>
                  <XAxis dataKey="categoria" hide />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Bar dataKey="valor" fill="#ef4444" radius={[8, 8, 0, 0]}>
                    {expensesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                {expensesData.map((expense, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: expense.fill }}
                      />
                      <span className="text-xs">{expense.categoria}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(expense.valor)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;
