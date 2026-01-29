import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, DollarSign, ShoppingCart, Calendar, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AutorDashboard() {
  const { autorId } = useRoyaltiesAuth();

  const { data: stats } = useQuery({
    queryKey: ["autor-stats", autorId],
    queryFn: async () => {
      if (!autorId) return null;

      // Get books count
      const { count: livrosCount } = await supabase
        .from("royalties_livros")
        .select("*", { count: "exact", head: true })
        .eq("autor_id", autorId)
        .eq("is_active", true);

      // Get total earnings
      const { data: livros } = await supabase
        .from("royalties_livros")
        .select("id")
        .eq("autor_id", autorId);

      const livroIds = livros?.map((l) => l.id) || [];

      let totalGanhos = 0;
      let vendasMes = 0;
      let totalPago = 0;

      if (livroIds.length > 0) {
        const { data: vendas } = await supabase
          .from("royalties_vendas")
          .select("valor_comissao_total, quantidade, data_venda, pagamento_id")
          .in("livro_id", livroIds);

        totalGanhos = vendas?.reduce((acc, v) => acc + Number(v.valor_comissao_total || 0), 0) || 0;
        totalPago = vendas?.filter(v => v.pagamento_id).reduce((acc, v) => acc + Number(v.valor_comissao_total || 0), 0) || 0;

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        vendasMes = vendas?.filter(
          (v) => new Date(v.data_venda) >= startOfMonth
        ).reduce((acc, v) => acc + (v.quantidade || 0), 0) || 0;
      }

      // Get pending payments
      const { data: pagamentosPendentes } = await supabase
        .from("royalties_pagamentos")
        .select("valor_total, data_prevista")
        .eq("autor_id", autorId)
        .eq("status", "pendente")
        .order("data_prevista")
        .limit(1);

      const proximoPagamento = pagamentosPendentes?.[0] || null;

      return {
        livrosCount: livrosCount || 0,
        totalGanhos,
        totalPago,
        totalPendente: totalGanhos - totalPago,
        vendasMes,
        proximoPagamento,
      };
    },
    enabled: !!autorId,
  });

  // Vendas recentes
  const { data: vendasRecentes = [] } = useQuery({
    queryKey: ["autor-vendas-recentes", autorId],
    queryFn: async () => {
      if (!autorId) return [];

      const { data: livros } = await supabase
        .from("royalties_livros")
        .select("id")
        .eq("autor_id", autorId);

      const livroIds = livros?.map((l) => l.id) || [];
      if (!livroIds.length) return [];

      const { data: vendas } = await supabase
        .from("royalties_vendas")
        .select(`
          id,
          data_venda,
          quantidade,
          valor_comissao_total,
          pagamento_id,
          royalties_livros (titulo)
        `)
        .in("livro_id", livroIds)
        .order("data_venda", { ascending: false })
        .limit(5);

      return vendas || [];
    },
    enabled: !!autorId,
  });

  // Dados mensais para gráfico
  const { data: dadosMensais = [] } = useQuery({
    queryKey: ["autor-dados-mensais", autorId],
    queryFn: async () => {
      if (!autorId) return [];

      const { data: livros } = await supabase
        .from("royalties_livros")
        .select("id")
        .eq("autor_id", autorId);

      const livroIds = livros?.map((l) => l.id) || [];
      if (!livroIds.length) return [];

      const { data: vendas } = await supabase
        .from("royalties_vendas")
        .select("data_venda, valor_comissao_total")
        .in("livro_id", livroIds)
        .order("data_venda", { ascending: true });

      if (!vendas?.length) return [];

      // Group by month
      const monthlyData: Record<string, { mes: string; ganhos: number }> = {};
      
      vendas.forEach((venda) => {
        const date = new Date(venda.data_venda);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { mes: monthLabel, ganhos: 0 };
        }
        monthlyData[monthKey].ganhos += Number(venda.valor_comissao_total || 0);
      });

      return Object.values(monthlyData).slice(-6);
    },
    enabled: !!autorId,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meu Dashboard</h1>
        <p className="text-muted-foreground">
          Acompanhe suas vendas e royalties
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meus Livros</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.livrosCount || 0}</div>
            <p className="text-xs text-muted-foreground">Livros ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ganhos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.totalGanhos || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats?.totalPago || 0)} já recebido
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{stats?.vendasMes || 0}</div>
              {(stats?.vendasMes || 0) > 0 && <TrendingUp className="h-4 w-4 text-green-500" />}
            </div>
            <p className="text-xs text-muted-foreground">Unidades vendidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximo Pagamento</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.proximoPagamento
                ? formatCurrency(stats.proximoPagamento.valor_total)
                : formatCurrency(stats?.totalPendente || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.proximoPagamento
                ? `Previsto: ${new Date(stats.proximoPagamento.data_prevista).toLocaleDateString("pt-BR")}`
                : "Pendente de liberação"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolução dos Ganhos</CardTitle>
            <CardDescription>Royalties nos últimos meses</CardDescription>
          </CardHeader>
          <CardContent>
            {dadosMensais.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={dadosMensais}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" fontSize={12} />
                  <YAxis 
                    fontSize={12}
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), "Ganhos"]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="ganhos" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Nenhum dado disponível ainda.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendas Recentes</CardTitle>
            <CardDescription>Últimas vendas dos seus livros</CardDescription>
          </CardHeader>
          <CardContent>
            {vendasRecentes.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Livro</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendasRecentes.map((venda: any) => (
                    <TableRow key={venda.id}>
                      <TableCell className="font-medium max-w-[150px] truncate">
                        {venda.royalties_livros?.titulo || "-"}
                      </TableCell>
                      <TableCell className="text-right">{venda.quantidade}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(venda.valor_comissao_total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={venda.pagamento_id ? "default" : "secondary"} className="text-xs">
                          {venda.pagamento_id ? "Pago" : "Pendente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm py-4 text-center">
                Nenhuma venda recente.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
