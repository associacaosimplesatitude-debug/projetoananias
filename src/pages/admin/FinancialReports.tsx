import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, PieChart, Pie, LineChart, Line, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, Calendar, Search } from 'lucide-react';

interface Church {
  id: string;
  church_name: string;
}

interface AccountData {
  id: string;
  church_id: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  payment_type: string;
  churches: { church_name: string };
}

export default function FinancialReports() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [selectedChurch, setSelectedChurch] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchChurches();
    // Definir datas padrão: últimos 6 meses
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    setStartDate(sixMonthsAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchAccounts();
    }
  }, [selectedChurch, startDate, endDate]);

  const fetchChurches = async () => {
    const { data } = await supabase
      .from('churches')
      .select('id, church_name')
      .order('church_name');
    setChurches(data || []);
  };

  const fetchAccounts = async () => {
    setLoading(true);
    let query = supabase
      .from('accounts_receivable')
      .select(`
        id,
        church_id,
        amount,
        due_date,
        payment_date,
        status,
        payment_type,
        churches (church_name)
      `)
      .gte('due_date', startDate)
      .lte('due_date', endDate);

    if (selectedChurch !== 'all') {
      query = query.eq('church_id', selectedChurch);
    }

    const { data } = await query;
    setAccounts(data || []);
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Função para calcular quantos meses entre duas datas
  const getMonthsBetween = (start: Date, end: Date): number => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                   (endDate.getMonth() - startDate.getMonth()) + 1;
    return Math.max(0, months);
  };

  // Calcular métricas considerando pagamentos recorrentes
  const calculateRecurringValue = (acc: AccountData): number => {
    if (acc.payment_type === 'recorrente') {
      // Para recorrentes, calcular quantos meses dentro do período
      const dueDate = new Date(acc.due_date);
      const filterStart = new Date(startDate);
      const filterEnd = new Date(endDate);
      
      // A cobrança recorrente começa na data de vencimento
      const recurringStart = dueDate < filterStart ? filterStart : dueDate;
      const recurringEnd = filterEnd;
      
      const monthsInPeriod = getMonthsBetween(recurringStart, recurringEnd);
      return acc.amount * monthsInPeriod;
    }
    return acc.amount;
  };

  const totalReceivable = accounts.reduce((sum, acc) => sum + calculateRecurringValue(acc), 0);
  const totalPaid = accounts
    .filter(acc => acc.status === 'paid')
    .reduce((sum, acc) => sum + calculateRecurringValue(acc), 0);
  const totalOpen = accounts
    .filter(acc => acc.status === 'open')
    .reduce((sum, acc) => sum + calculateRecurringValue(acc), 0);
  const totalOverdue = accounts
    .filter(acc => acc.status === 'open' && new Date(acc.due_date) < new Date())
    .reduce((sum, acc) => sum + calculateRecurringValue(acc), 0);

  // Dados por igreja
  const dataByChurch = Object.values(
    accounts.reduce((acc, curr) => {
      const churchName = (curr.churches as any)?.church_name || 'Sem nome';
      const value = calculateRecurringValue(curr);
      if (!acc[churchName]) {
        acc[churchName] = {
          name: churchName,
          total: 0,
          pago: 0,
          aberto: 0,
        };
      }
      acc[churchName].total += value;
      if (curr.status === 'paid') {
        acc[churchName].pago += value;
      } else {
        acc[churchName].aberto += value;
      }
      return acc;
    }, {} as Record<string, any>)
  );

  // Dados por status
  const statusData = [
    { name: 'Pago', value: totalPaid, color: '#22c55e' },
    { name: 'Aberto', value: totalOpen - totalOverdue, color: '#3b82f6' },
    { name: 'Atrasado', value: totalOverdue, color: '#ef4444' },
  ].filter(item => item.value > 0);

  // Dados por mês - para recorrentes, distribuir pelos meses
  const monthlyData = Object.values(
    accounts.reduce((acc, curr) => {
      if (curr.payment_type === 'recorrente') {
        // Para recorrentes, criar uma entrada para cada mês dentro do período
        const dueDate = new Date(curr.due_date);
        const filterStart = new Date(startDate);
        const filterEnd = new Date(endDate);
        
        const recurringStart = dueDate < filterStart ? filterStart : dueDate;
        const monthsInPeriod = getMonthsBetween(recurringStart, filterEnd);
        
        for (let i = 0; i < monthsInPeriod; i++) {
          const monthDate = new Date(recurringStart);
          monthDate.setMonth(monthDate.getMonth() + i);
          const month = monthDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          
          if (!acc[month]) {
            acc[month] = {
              mes: month,
              total: 0,
              pago: 0,
              aberto: 0,
            };
          }
          acc[month].total += curr.amount;
          if (curr.status === 'paid') {
            acc[month].pago += curr.amount;
          } else {
            acc[month].aberto += curr.amount;
          }
        }
      } else {
        // Para não-recorrentes, processar normalmente
        const month = new Date(curr.due_date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        if (!acc[month]) {
          acc[month] = {
            mes: month,
            total: 0,
            pago: 0,
            aberto: 0,
          };
        }
        acc[month].total += curr.amount;
        if (curr.status === 'paid') {
          acc[month].pago += curr.amount;
        } else {
          acc[month].aberto += curr.amount;
        }
      }
      return acc;
    }, {} as Record<string, any>)
  ).sort((a, b) => {
    // Ordenar por data
    const dateA = new Date(a.mes.split('/').reverse().join('-'));
    const dateB = new Date(b.mes.split('/').reverse().join('-'));
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Relatórios Financeiros</h1>
          <p className="text-muted-foreground">Análise detalhada de contas a receber</p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Igreja</Label>
                <Select value={selectedChurch} onValueChange={setSelectedChurch}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Igrejas</SelectItem>
                    {churches.map((church) => (
                      <SelectItem key={church.id} value={church.id}>
                        {church.church_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button onClick={fetchAccounts} disabled={loading} className="w-full">
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalReceivable)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {accounts.length} cobrança(s)
                {accounts.some(acc => acc.payment_type === 'recorrente') && 
                  ` (${accounts.filter(acc => acc.payment_type === 'recorrente').length} recorrente${accounts.filter(acc => acc.payment_type === 'recorrente').length > 1 ? 's' : ''})`
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((totalPaid / totalReceivable) * 100).toFixed(1)}% do total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Aberto</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalOpen)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((totalOpen / totalReceivable) * 100).toFixed(1)}% do total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atrasado</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalOverdue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalReceivable > 0 ? ((totalOverdue / totalReceivable) * 100).toFixed(1) : 0}% do total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Status */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Status</CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico por Igreja */}
          <Card>
            <CardHeader>
              <CardTitle>Valores por Igreja</CardTitle>
            </CardHeader>
            <CardContent>
              {dataByChurch.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dataByChurch}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="pago" fill="#22c55e" name="Pago" />
                    <Bar dataKey="aberto" fill="#3b82f6" name="Em Aberto" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de Evolução Mensal */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Evolução Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#8b5cf6" name="Total" strokeWidth={2} />
                    <Line type="monotone" dataKey="pago" stroke="#22c55e" name="Pago" strokeWidth={2} />
                    <Line type="monotone" dataKey="aberto" stroke="#3b82f6" name="Em Aberto" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
