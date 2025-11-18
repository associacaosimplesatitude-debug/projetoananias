import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, DollarSign, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface FunnelData {
  stage: string;
  count: number;
}

interface RevenueData {
  month: string;
  receitas: number;
  despesas: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    pendingTasks: 0,
    receivable: 0,
    payable: 0,
    totalClients: 0,
    completedFunnels: 0,
  });
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);

  useEffect(() => {
    fetchStats();
    fetchFunnelData();
    fetchRevenueData();
  }, []);

  const fetchStats = async () => {
    const [
      { count: pendingCount },
      { data: receivableData },
      { data: payableData },
      { count: clientCount },
      { count: completedCount },
    ] = await Promise.all([
      supabase
        .from('church_stage_progress')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'completed'),
      supabase
        .from('accounts_receivable')
        .select('amount')
        .eq('status', 'open'),
      supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'open'),
      supabase
        .from('churches')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('churches')
        .select('*', { count: 'exact', head: true })
        .eq('current_stage', 6),
    ]);

    const totalReceivable = receivableData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const totalPayable = payableData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

    setStats({
      pendingTasks: pendingCount || 0,
      receivable: totalReceivable,
      payable: totalPayable,
      totalClients: clientCount || 0,
      completedFunnels: completedCount || 0,
    });
  };

  const fetchFunnelData = async () => {
    const { data } = await supabase
      .from('churches')
      .select('current_stage');
    
    const stageCounts = [0, 0, 0, 0, 0, 0];
    data?.forEach(church => {
      if (church.current_stage && church.current_stage >= 1 && church.current_stage <= 6) {
        stageCounts[church.current_stage - 1]++;
      }
    });

    const formattedData = stageCounts.map((count, index) => ({
      stage: `Etapa ${index + 1}`,
      count,
    }));

    setFunnelData(formattedData);
  };

  const fetchRevenueData = async () => {
    const { data: receivableData } = await supabase
      .from('accounts_receivable')
      .select('amount, created_at');
    
    const { data: payableData } = await supabase
      .from('accounts_payable')
      .select('amount, created_at');

    const monthlyData: Record<string, { receitas: number; despesas: number }> = {};
    
    receivableData?.forEach(item => {
      const month = new Date(item.created_at).toLocaleDateString('pt-BR', { month: 'short' });
      if (!monthlyData[month]) monthlyData[month] = { receitas: 0, despesas: 0 };
      monthlyData[month].receitas += Number(item.amount);
    });

    payableData?.forEach(item => {
      const month = new Date(item.created_at).toLocaleDateString('pt-BR', { month: 'short' });
      if (!monthlyData[month]) monthlyData[month] = { receitas: 0, despesas: 0 };
      monthlyData[month].despesas += Number(item.amount);
    });

    const formatted = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
    }));

    setRevenueData(formatted);
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--destructive))', 'hsl(var(--success))'];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Painel Administrativo</h1>
      
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">Igrejas cadastradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tarefas Pendentes</CardTitle>
              <AlertCircle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingTasks}</div>
              <p className="text-xs text-muted-foreground">Sub-tarefas para concluir</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contas a Receber</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.receivable)}
              </div>
              <p className="text-xs text-muted-foreground">Em aberto</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contas a Pagar</CardTitle>
              <DollarSign className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.payable)}
              </div>
              <p className="text-xs text-muted-foreground">Em aberto</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Funis Concluídos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedFunnels}</div>
              <p className="text-xs text-muted-foreground">CNPJs emitidos</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição do Funil</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={funnelData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ stage, count }) => `${stage}: ${count}`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="count"
                  >
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clientes por Etapa</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={funnelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="stage" stroke="hsl(var(--foreground))" />
                  <YAxis stroke="hsl(var(--foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Receitas x Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--foreground))" />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Line type="monotone" dataKey="receitas" stroke="hsl(var(--success))" strokeWidth={2} name="Receitas" />
                <Line type="monotone" dataKey="despesas" stroke="hsl(var(--destructive))" strokeWidth={2} name="Despesas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
