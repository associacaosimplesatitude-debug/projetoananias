import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, LayoutDashboard } from 'lucide-react';

const FinancialDashboard = () => {
  // Dados de exemplo (em produção viriam do backend)
  const [entries] = useState([
    { tipo: 'Dízimo', valor: 15000 },
    { tipo: 'Oferta', valor: 8000 },
    { tipo: 'Venda de Produtos', valor: 3500 },
    { tipo: 'Outros', valor: 2500 },
  ]);

  const [expenses] = useState([
    { categoria: 'DESPESAS COM PESSOAL', valor: 12000 },
    { categoria: 'DESPESAS ADMINISTRATIVAS', valor: 5000 },
    { categoria: 'DESPESAS OPERACIONAIS', valor: 7500 },
    { categoria: 'DESPESAS FINANCEIRAS', valor: 500 },
  ]);

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
