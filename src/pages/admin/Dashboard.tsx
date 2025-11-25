import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Users, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    receivable: 0,
    payable: 0,
    totalClients: 0,
    totalIgrejas: 0,
    totalAssociacoes: 0,
    overdueReceivable: 0,
    receivableIgrejas: 0,
    receivableAssociacoes: 0,
  });
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);

  useEffect(() => {
    fetchStats();
    fetchFunnelData();
    fetchRevenueData();
  }, []);

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const [
      { data: receivableData },
      { data: payableData },
      { count: clientCount },
      { data: overdueData },
      { data: churchesData },
    ] = await Promise.all([
      supabase
        .from('accounts_receivable')
        .select('amount, due_date, churches!inner(client_type)')
        .eq('status', 'open'),
      supabase
        .from('accounts_payable')
        .select('amount')
        .eq('status', 'open'),
      supabase
        .from('churches')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('accounts_receivable')
        .select('amount, due_date')
        .eq('status', 'open')
        .lt('due_date', today),
      supabase
        .from('churches')
        .select('client_type'),
    ]);

    const totalReceivable = receivableData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const totalPayable = payableData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const totalOverdue = overdueData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

    // Calcular totais por tipo
    const totalIgrejas = churchesData?.filter(c => c.client_type === 'igreja').length || 0;
    const totalAssociacoes = churchesData?.filter(c => c.client_type === 'associacao').length || 0;

    // Calcular contas a receber por tipo
    const receivableIgrejas = receivableData
      ?.filter((item: any) => item.churches?.client_type === 'igreja')
      .reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    
    const receivableAssociacoes = receivableData
      ?.filter((item: any) => item.churches?.client_type === 'associacao')
      .reduce((sum, item) => sum + Number(item.amount), 0) || 0;

    setStats({
      receivable: totalReceivable,
      payable: totalPayable,
      totalClients: clientCount || 0,
      totalIgrejas,
      totalAssociacoes,
      overdueReceivable: totalOverdue,
      receivableIgrejas,
      receivableAssociacoes,
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
      .select('amount, due_date')
      .order('due_date', { ascending: true });
    
    const { data: payableData } = await supabase
      .from('accounts_payable')
      .select('amount, due_date')
      .order('due_date', { ascending: true });

    // Criar um mapa com os últimos 12 meses
    const monthlyData: Record<string, { receitas: number; despesas: number; order: number }> = {};
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    
    // Inicializar os últimos 12 meses
    const currentDate = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = `${months[date.getMonth()]}/${date.getFullYear().toString().slice(-2)}`;
      monthlyData[monthKey] = { receitas: 0, despesas: 0, order: 11 - i };
    }
    
    receivableData?.forEach(item => {
      const date = new Date(item.due_date);
      const monthKey = `${months[date.getMonth()]}/${date.getFullYear().toString().slice(-2)}`;
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].receitas += Number(item.amount);
      }
    });

    payableData?.forEach(item => {
      const date = new Date(item.due_date);
      const monthKey = `${months[date.getMonth()]}/${date.getFullYear().toString().slice(-2)}`;
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].despesas += Number(item.amount);
      }
    });

    const formatted = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        receitas: data.receitas,
        despesas: data.despesas,
        order: data.order,
      }))
      .sort((a, b) => a.order - b.order);

    setRevenueData(formatted);
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--destructive))', 'hsl(var(--success))'];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Painel Administrativo</h1>
      
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">Cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Igrejas</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalIgrejas}</div>
              <p className="text-xs text-muted-foreground">Igrejas cadastradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Associações</CardTitle>
              <Users className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAssociacoes}</div>
              <p className="text-xs text-muted-foreground">Associações cadastradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contas a Receber - Igrejas</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.receivableIgrejas)}
              </div>
              <p className="text-xs text-muted-foreground">Em aberto</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contas a Receber - Associações</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.receivableAssociacoes)}
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

          <Card className="border-destructive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contas Atrasadas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.overdueReceivable)}
              </div>
              <Button 
                variant="link" 
                className="p-0 h-auto text-xs text-muted-foreground hover:text-destructive"
                onClick={() => navigate('/admin/receivable')}
              >
                Ver clientes →
              </Button>
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
