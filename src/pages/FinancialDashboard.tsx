import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, LayoutDashboard, CalendarClock, Users, Cake, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { useChurchData } from '@/hooks/useChurchData';
import { useClientType } from '@/hooks/useClientType';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const FinancialDashboard = () => {
  const { user } = useAuth();
  const { churchId } = useChurchData();
  const { clientType } = useClientType();
  const [mandateEndDate, setMandateEndDate] = useState<string | null>(null);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);
  const [entries, setEntries] = useState<Array<{ tipo: string; valor: number }>>([]);
  const [expenses, setExpenses] = useState<Array<{ categoria: string; valor: number }>>([]);
  const [totalEntriesAllTime, setTotalEntriesAllTime] = useState(0);
  const [totalExpensesAllTime, setTotalExpensesAllTime] = useState(0);
  const [members, setMembers] = useState<Array<{
    id: string;
    nome_completo: string;
    sexo: string;
    cargo: string;
    data_aniversario: string;
  }>>([]);

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

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      // Buscar entradas do mês atual
      const { data: entriesData } = await supabase
        .from('financial_entries')
        .select('tipo, valor, data')
        .eq('church_id', churchId);

      if (entriesData && entriesData.length > 0) {
        // Total acumulado de entradas (todas as datas)
        const totalAllTime = entriesData.reduce((sum, entry) => sum + Number(entry.valor), 0);
        setTotalEntriesAllTime(totalAllTime);

        // Filtrar por mês atual para os gráficos e cartões mensais
        const currentMonthEntries = entriesData.filter((entry) => {
          const entryDate = new Date(entry.data);
          return (
            entryDate.getMonth() + 1 === currentMonth &&
            entryDate.getFullYear() === currentYear
          );
        });

        // Buscar nomes das contas do plano de contas
        const { data: contasData } = await supabase
          .from('plano_de_contas')
          .select('codigo_conta, nome_conta');

        const contasMap = new Map(contasData?.map((c) => [c.codigo_conta, c.nome_conta]) || []);

        // Agrupar por tipo
        const groupedEntries = currentMonthEntries.reduce(
          (acc: Record<string, number>, entry) => {
            const nomeConta = contasMap.get(entry.tipo) || entry.tipo;
            acc[nomeConta] = (acc[nomeConta] || 0) + Number(entry.valor);
            return acc;
          },
          {},
        );

        setEntries(Object.entries(groupedEntries).map(([tipo, valor]) => ({ tipo, valor })));
      } else {
        setEntries([]);
        setTotalEntriesAllTime(0);
      }

      // Buscar despesas pagas do mês atual
      const { data: expensesData } = await supabase
        .from('bills_to_pay')
        .select('category_main, paid_amount, paid_date')
        .eq('church_id', churchId)
        .eq('status', 'paid')
        .not('paid_date', 'is', null);

      if (expensesData && expensesData.length > 0) {
        // Total acumulado de despesas pagas (todas as datas)
        const totalAllTimeExpenses = expensesData.reduce(
          (sum, expense) => sum + Number(expense.paid_amount || 0),
          0,
        );
        setTotalExpensesAllTime(totalAllTimeExpenses);

        // Filtrar por mês atual
        const currentMonthExpenses = expensesData.filter((expense) => {
          if (!expense.paid_date) return false;
          const expenseDate = new Date(expense.paid_date);
          return (
            expenseDate.getMonth() + 1 === currentMonth &&
            expenseDate.getFullYear() === currentYear
          );
        });

        // Agrupar por categoria principal
        const groupedExpenses = currentMonthExpenses.reduce(
          (acc: Record<string, number>, expense) => {
            acc[expense.category_main] =
              (acc[expense.category_main] || 0) + Number(expense.paid_amount || 0);
            return acc;
          },
          {},
        );

        setExpenses(Object.entries(groupedExpenses).map(([categoria, valor]) => ({ categoria, valor })));
      } else {
        setExpenses([]);
        setTotalExpensesAllTime(0);
      }
    };

    fetchFinancialData();
  }, [churchId]);

  // Buscar membros
  useEffect(() => {
    const fetchMembers = async () => {
      if (!churchId) return;

      const { data: membersData } = await supabase
        .from('church_members')
        .select('id, nome_completo, sexo, cargo, data_aniversario')
        .eq('church_id', churchId);

      if (membersData) {
        setMembers(membersData);
      }
    };

    fetchMembers();
  }, [churchId]);

  const totalEntries = useMemo(() => entries.reduce((sum, e) => sum + e.valor, 0), [entries]);
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + e.valor, 0),
    [expenses],
  );
  const balance = useMemo(
    () => totalEntriesAllTime - totalExpensesAllTime,
    [totalEntriesAllTime, totalExpensesAllTime],
  );

  // Estatísticas de membros
  const totalMembers = members.length;
  const totalMen = members.filter(m => m.sexo === 'Masculino').length;
  const totalWomen = members.filter(m => m.sexo === 'Feminino').length;

  // Aniversariantes de hoje
  const todayBirthdays = useMemo(() => {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    return members.filter(member => {
      const birthDate = new Date(member.data_aniversario);
      return birthDate.getMonth() + 1 === todayMonth && birthDate.getDate() === todayDay;
    });
  }, [members]);

  // Aniversariantes do mês
  const monthBirthdays = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;

    return members
      .filter(member => {
        const birthDate = new Date(member.data_aniversario);
        return birthDate.getMonth() + 1 === currentMonth;
      })
      .sort((a, b) => {
        const dateA = new Date(a.data_aniversario).getDate();
        const dateB = new Date(b.data_aniversario).getDate();
        return dateA - dateB;
      });
  }, [members]);

  // Distribuição por cargo
  const cargoDistribution = useMemo(() => {
    const distribution = members.reduce((acc: Record<string, number>, member) => {
      acc[member.cargo] = (acc[member.cargo] || 0) + 1;
      return acc;
    }, {});

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
    return Object.entries(distribution).map(([cargo, count], index) => ({
      cargo,
      count,
      fill: colors[index % colors.length],
      percentage: ((count / totalMembers) * 100).toFixed(1)
    }));
  }, [members, totalMembers]);

  // Distribuição por faixa etária
  const ageDistribution = useMemo(() => {
    const today = new Date();
    const ranges = {
      '0-12': 0,
      '13-18': 0,
      '19-30': 0,
      '31-50': 0,
      '51+': 0
    };

    members.forEach(member => {
      const birthDate = new Date(member.data_aniversario);
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age <= 12) ranges['0-12']++;
      else if (age <= 18) ranges['13-18']++;
      else if (age <= 30) ranges['19-30']++;
      else if (age <= 50) ranges['31-50']++;
      else ranges['51+']++;
    });

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
    return Object.entries(ranges).map(([faixa, count], index) => ({
      faixa,
      count,
      fill: colors[index]
    }));
  }, [members]);

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
              <p className="text-muted-foreground">Visão geral das finanças da {clientType === 'associacao' ? 'associação' : 'igreja'}</p>
            </div>
          </div>
        </div>

        {/* Key Indicators - Grid com 4 colunas */}
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card className={balance >= 0 ? 'border-success/50 bg-success/5' : 'border-destructive/50 bg-destructive/5'}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
              <Wallet className={`h-5 w-5 ${balance >= 0 ? 'text-success' : 'text-destructive'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
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
              <div className="text-2xl font-bold text-success">{formatCurrency(totalEntries)}</div>
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
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(totalExpenses)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                No mês atual
              </p>
            </CardContent>
          </Card>

          {mandateEndDate && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Vencimento do Mandato</CardTitle>
                <CalendarClock className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Date(mandateEndDate).toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                  })}
                </div>
                {daysUntilExpiry !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {daysUntilExpiry > 0 
                      ? `Faltam ${daysUntilExpiry} dias` 
                      : daysUntilExpiry === 0
                      ? 'Vence hoje!'
                      : `Vencido há ${Math.abs(daysUntilExpiry)} dias`
                    }
                  </p>
                )}
              </CardContent>
            </Card>
          )}
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
              {expensesData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={expensesData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ categoria, percentage }) => `${categoria}: ${percentage}%`}
                        outerRadius={80}
                        fill="#ef4444"
                        dataKey="valor"
                      >
                        {expensesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="mt-4 space-y-2">
                    {expensesData.map((expense, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: expense.fill }}
                          />
                          <span>{expense.categoria}</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(expense.valor)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhuma despesa paga no período
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Painel de Membros */}
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-6">
            <Users className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Painel de {clientType === 'associacao' ? 'Associados' : 'Membros'}</h2>
          </div>

          {/* Cards de Resumo de Membros */}
          <div className="grid gap-6 md:grid-cols-3 mb-6">
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total de {clientType === 'associacao' ? 'Associados' : 'Membros'}</CardTitle>
                <Users className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{totalMembers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {clientType === 'associacao' ? 'Associados' : 'Membros'} cadastrados
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/50 bg-blue-500/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total de Homens</CardTitle>
                <User className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-500">{totalMen}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((totalMen / totalMembers) * 100 || 0).toFixed(1)}% do total
                </p>
              </CardContent>
            </Card>

            <Card className="border-pink-500/50 bg-pink-500/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total de Mulheres</CardTitle>
                <User className="h-5 w-5 text-pink-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-pink-500">{totalWomen}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((totalWomen / totalMembers) * 100 || 0).toFixed(1)}% do total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Aniversariantes de Hoje - Destacado */}
          {todayBirthdays.length > 0 && (
            <Card className="mb-6 border-amber-500 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Cake className="h-6 w-6 text-amber-500" />
                  <CardTitle className="text-xl">🎉 Aniversariantes de Hoje!</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {todayBirthdays.map(member => (
                    <div key={member.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                      <Avatar className="h-12 w-12 border-2 border-amber-500">
                        <AvatarFallback className="bg-amber-500 text-white font-semibold">
                          {member.nome_completo.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{member.nome_completo}</p>
                        <p className="text-sm text-muted-foreground">{member.cargo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {todayBirthdays.length === 0 && (
            <Card className="mb-6 border-muted">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Cake className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Aniversariantes de Hoje</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Nenhum aniversariante hoje</p>
              </CardContent>
            </Card>
          )}

          {/* Gráficos de Membros */}
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            {/* Distribuição de Cargos - Apenas para Igrejas */}
            {clientType !== 'associacao' && (
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição de Cargos</CardTitle>
                </CardHeader>
                <CardContent>
                  {cargoDistribution.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={cargoDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ cargo, percentage }) => `${cargo}: ${percentage}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {cargoDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="mt-4 space-y-2">
                        {cargoDistribution.map((entry, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: entry.fill }}
                              />
                              <span>{entry.cargo}</span>
                            </div>
                            <span className="font-semibold">{entry.count} ({entry.percentage}%)</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">Nenhum membro cadastrado</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Distribuição por Faixa Etária */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Faixa Etária</CardTitle>
              </CardHeader>
              <CardContent>
                {ageDistribution.some(d => d.count > 0) ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={ageDistribution}>
                        <XAxis dataKey="faixa" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                          {ageDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="mt-4 space-y-2">
                      {ageDistribution.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: entry.fill }}
                            />
                            <span>{entry.faixa} anos</span>
                          </div>
                          <span className="font-semibold">{entry.count} membros</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-8">Nenhum membro cadastrado</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Aniversariantes do Mês */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cake className="h-5 w-5 text-primary" />
                <CardTitle>Aniversariantes do Mês</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {monthBirthdays.length > 0 ? (
                <div className="space-y-3">
                  {monthBirthdays.map(member => {
                    const birthDate = new Date(member.data_aniversario);
                    const day = birthDate.getDate();
                    const isToday = todayBirthdays.some(b => b.id === member.id);
                    
                    return (
                      <div 
                        key={member.id} 
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isToday ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className={isToday ? 'bg-amber-500 text-white' : ''}>
                              {member.nome_completo.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{member.nome_completo}</p>
                            <p className="text-sm text-muted-foreground">{member.cargo}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={isToday ? "default" : "secondary"}>
                            Dia {day}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Nenhum aniversariante este mês</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;
