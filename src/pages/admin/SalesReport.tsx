import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, subDays, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Truck, 
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Trophy
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Link } from "react-router-dom";

type Order = {
  id: string;
  church_id: string;
  created_at: string | null;
  approved_at: string | null;
  status: string;
  payment_status: string | null;
  status_logistico: string | null;
  valor_total: number;
  valor_produtos: number;
  valor_frete: number;
  metodo_frete: string | null;
  codigo_rastreio: string | null;
  nome_cliente: string | null;
  endereco_estado: string;
  church: {
    church_name: string;
    vendedor_id: string | null;
  } | null;
  ebd_pedidos_itens: {
    quantidade: number;
    preco_total: number;
  }[] | null;
};

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  foto_url: string | null;
  comissao_percentual: number;
  status: string;
  meta_mensal_valor: number;
}

const COLORS = {
  primary: "hsl(var(--primary))",
  success: "hsl(142, 76%, 36%)",
  warning: "hsl(38, 92%, 50%)",
  danger: "hsl(0, 84%, 60%)",
  muted: "hsl(var(--muted-foreground))",
  chart1: "hsl(221, 83%, 53%)",
  chart2: "hsl(142, 76%, 36%)",
  chart3: "hsl(38, 92%, 50%)",
  chart4: "hsl(280, 67%, 50%)",
  chart5: "hsl(0, 84%, 60%)",
};

const PIE_COLORS = [COLORS.chart1, COLORS.chart2, COLORS.chart3, COLORS.chart4, COLORS.chart5];

export default function SalesReport() {
  const [period, setPeriod] = useState("thisMonth");
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { data: orders, isLoading } = useQuery({
    queryKey: ["sales-report-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_pedidos")
        .select(`
          id,
          church_id,
          created_at,
          approved_at,
          status,
          payment_status,
          status_logistico,
          valor_total,
          valor_produtos,
          valor_frete,
          metodo_frete,
          codigo_rastreio,
          nome_cliente,
          endereco_estado,
          church:churches(church_name, vendedor_id),
          ebd_pedidos_itens(quantidade, preco_total)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
  });

  const { data: vendedores } = useQuery({
    queryKey: ['vendedores-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores')
        .select('*')
        .eq('status', 'Ativo')
        .order('nome');
      if (error) throw error;
      return data as Vendedor[];
    },
  });

  const { data: assinaturas } = useQuery({
    queryKey: ['assinaturas-ebd'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assinaturas')
        .select(`
          cliente_id,
          modulos!inner(nome_modulo)
        `)
        .eq('status', 'Ativo');
      if (error) throw error;
      return data;
    },
  });

  const dateRange = useMemo(() => {
    const end = new Date();
    let start: Date;
    
    switch (period) {
      case "7":
        start = subDays(end, 7);
        break;
      case "30":
        start = subDays(end, 30);
        break;
      case "90":
        start = subDays(end, 90);
        break;
      case "thisMonth":
        start = startOfMonth(end);
        break;
      case "lastMonth":
        start = startOfMonth(subMonths(end, 1));
        return { start, end: endOfMonth(subMonths(end, 1)) };
      case "custom":
        if (customStartDate && customEndDate) {
          return { start: parseISO(customStartDate), end: parseISO(customEndDate) };
        }
        start = startOfMonth(end);
        break;
      default:
        start = startOfMonth(end);
    }
    return { start, end };
  }, [period, customStartDate, customEndDate]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => {
      if (!order.created_at) return false;
      const orderDate = parseISO(order.created_at);
      return isWithinInterval(orderDate, { start: dateRange.start, end: dateRange.end });
    });
  }, [orders, dateRange]);

  // KPIs
  const totalOrders = filteredOrders.length;
  const pendingOrders = filteredOrders.filter(o => o.payment_status === 'pending' && o.status !== 'cancelled');
  const paidOrders = filteredOrders.filter(o => o.payment_status === 'approved');
  const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelled');
  
  const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.valor_total), 0);
  const totalProducts = paidOrders.reduce((sum, o) => sum + Number(o.valor_produtos), 0);
  const totalShipping = paidOrders.reduce((sum, o) => sum + Number(o.valor_frete), 0);
  const avgTicket = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
  const totalItems = paidOrders.reduce((sum, o) => 
    sum + (o.ebd_pedidos_itens?.reduce((s, item) => s + item.quantidade, 0) || 0), 0
  );

  // EBD Clients
  const totalEbdClients = useMemo(() => {
    const ebdClientIds = new Set(
      assinaturas
        ?.filter((a: any) => a.modulos?.nome_modulo === 'REOBOTE EBD')
        .map((a: any) => a.cliente_id) || []
    );
    return ebdClientIds.size;
  }, [assinaturas]);

  // Delivery status
  const deliveryStats = useMemo(() => {
    const shipped = paidOrders.filter(o => o.codigo_rastreio).length;
    const awaitingShipment = paidOrders.filter(o => !o.codigo_rastreio).length;
    return { shipped, awaitingShipment };
  }, [paidOrders]);

  // Payment status chart data
  const paymentStatusData = useMemo(() => [
    { name: "Pagos", value: paidOrders.length, color: COLORS.chart2 },
    { name: "Pendentes", value: pendingOrders.length, color: COLORS.chart3 },
    { name: "Cancelados", value: cancelledOrders.length, color: COLORS.chart5 },
  ], [paidOrders.length, pendingOrders.length, cancelledOrders.length]);

  // Shipping method chart data
  const shippingMethodData = useMemo(() => {
    const methods: Record<string, number> = {};
    paidOrders.forEach((order) => {
      const method = order.metodo_frete || "Não informado";
      methods[method] = (methods[method] || 0) + 1;
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  }, [paidOrders]);

  // Daily revenue chart data
  const dailyRevenueData = useMemo(() => {
    const daily: Record<string, { date: string; receita: number; pedidos: number }> = {};
    
    paidOrders.forEach((order) => {
      if (!order.approved_at && !order.created_at) return;
      const date = format(parseISO(order.approved_at || order.created_at!), "dd/MM");
      if (!daily[date]) {
        daily[date] = { date, receita: 0, pedidos: 0 };
      }
      daily[date].receita += Number(order.valor_total);
      daily[date].pedidos += 1;
    });

    return Object.values(daily).sort((a, b) => {
      const [dayA, monthA] = a.date.split("/").map(Number);
      const [dayB, monthB] = b.date.split("/").map(Number);
      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });
  }, [paidOrders]);

  // State distribution data
  const stateDistributionData = useMemo(() => {
    const states: Record<string, number> = {};
    paidOrders.forEach((order) => {
      const state = order.endereco_estado || "N/A";
      states[state] = (states[state] || 0) + Number(order.valor_total);
    });
    return Object.entries(states)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [paidOrders]);

  // Vendedor stats
  const vendedorStats = useMemo(() => {
    if (!vendedores || !paidOrders) return [];
    
    return vendedores.map(vendedor => {
      const vendedorOrders = paidOrders.filter(order => 
        order.church?.vendedor_id === vendedor.id
      );

      const totalSales = vendedorOrders.length;
      const totalValue = vendedorOrders.reduce((sum, o) => sum + Number(o.valor_total), 0);
      const commission = totalValue * (vendedor.comissao_percentual / 100);
      const goalProgress = vendedor.meta_mensal_valor > 0 
        ? (totalValue / vendedor.meta_mensal_valor) * 100 
        : 0;

      return {
        ...vendedor,
        totalSales,
        totalValue,
        commission,
        goalProgress: Math.min(goalProgress, 100),
        goalProgressRaw: goalProgress,
      };
    }).sort((a, b) => b.totalValue - a.totalValue);
  }, [vendedores, paidOrders]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatório de Vendas EBD</h1>
          <p className="text-muted-foreground">
            Análise consolidada de vendas, métricas e performance da equipe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/vendedores">
              <Users className="h-4 w-4 mr-2" />
              Gerenciar Vendedores
            </Link>
          </Button>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="thisMonth">Este mês</SelectItem>
              <SelectItem value="lastMonth">Mês passado</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Custom Date Range */}
      {period === 'custom' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clientes EBD</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEbdClients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Igrejas com módulo EBD ativo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Produtos: {formatCurrency(totalProducts)} | Frete: {formatCurrency(totalShipping)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pagos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidOrders.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalItems} itens vendidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avgTicket)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Por pedido pago
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status Logístico</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-500">
                {deliveryStats.shipped} Enviados
              </Badge>
              <Badge variant="secondary">
                {deliveryStats.awaitingShipment} Aguardando
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{pendingOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pagos</p>
                <p className="text-2xl font-bold">{paidOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Cancelados</p>
                <p className="text-2xl font-bold">{cancelledOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Faturamento por Dia</CardTitle>
            <CardDescription>Evolução da receita no período</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis 
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                    className="text-xs"
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), "Receita"]}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="receita" 
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={{ fill: COLORS.primary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
            <CardDescription>Status de pagamento dos pedidos</CardDescription>
          </CardHeader>
          <CardContent>
            {totalOrders > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {paymentStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, "Pedidos"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by State */}
        <Card>
          <CardHeader>
            <CardTitle>Faturamento por Estado</CardTitle>
            <CardDescription>Top 10 estados por valor de vendas</CardDescription>
          </CardHeader>
          <CardContent>
            {stateDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stateDistributionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    type="number" 
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                    className="text-xs"
                  />
                  <YAxis type="category" dataKey="name" width={40} className="text-xs" />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), "Faturamento"]} />
                  <Bar dataKey="value" fill={COLORS.chart1} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shipping Method Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Métodos de Envio</CardTitle>
            <CardDescription>Distribuição por tipo de frete</CardDescription>
          </CardHeader>
          <CardContent>
            {shippingMethodData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={shippingMethodData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {shippingMethodData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, "Pedidos"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking de Vendedores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Ranking de Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Rank</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-center">Vendas</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead className="w-[200px]">Progresso da Meta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendedorStats.map((vendedor, index) => (
                <TableRow key={vendedor.id}>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      {index === 0 && <span className="text-2xl">🥇</span>}
                      {index === 1 && <span className="text-2xl">🥈</span>}
                      {index === 2 && <span className="text-2xl">🥉</span>}
                      {index > 2 && <span className="text-lg font-medium text-muted-foreground">{index + 1}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={vendedor.foto_url || undefined} />
                        <AvatarFallback>{vendedor.nome.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{vendedor.nome}</div>
                        <div className="text-xs text-muted-foreground">{vendedor.comissao_percentual}% comissão</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{vendedor.totalSales}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(vendedor.totalValue)}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    {formatCurrency(vendedor.commission)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress value={vendedor.goalProgress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{vendedor.goalProgressRaw.toFixed(0)}%</span>
                        <span>Meta: {formatCurrency(vendedor.meta_mensal_valor)}</span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!vendedorStats || vendedorStats.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum vendedor ativo cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resumo de Comissões */}
      {vendedorStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Resumo de Comissões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">Total a Pagar</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(vendedorStats.reduce((sum, v) => sum + v.commission, 0))}
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">Média por Vendedor</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(vendedorStats.reduce((sum, v) => sum + v.totalValue, 0) / (vendedorStats.length || 1))}
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">Vendedores que Bateram Meta</div>
                <div className="text-2xl font-bold">
                  {vendedorStats.filter(v => v.goalProgressRaw >= 100).length} / {vendedorStats.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Período</CardTitle>
          <CardDescription>
            {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} até{" "}
            {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total de Pedidos</p>
              <p className="text-xl font-semibold">{totalOrders}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
              <p className="text-xl font-semibold">
                {totalOrders > 0 ? ((paidOrders.length / totalOrders) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Taxa de Cancelamento</p>
              <p className="text-xl font-semibold">
                {totalOrders > 0 ? ((cancelledOrders.length / totalOrders) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Taxa de Envio</p>
              <p className="text-xl font-semibold">
                {paidOrders.length > 0 ? ((deliveryStats.shipped / paidOrders.length) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
