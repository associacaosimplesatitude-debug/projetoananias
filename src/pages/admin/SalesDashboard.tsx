import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, ShoppingCart, DollarSign, Package, Trophy, TrendingUp } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, format, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  foto_url: string | null;
  comissao_percentual: number;
  status: string;
  meta_mensal_valor: number;
}

interface Order {
  id: string;
  church_id: string;
  valor_total: number;
  valor_produtos: number;
  valor_frete: number;
  status: string;
  payment_status: string | null;
  created_at: string;
  approved_at: string | null;
}

interface OrderItem {
  id: string;
  pedido_id: string;
  quantidade: number;
}

interface Church {
  id: string;
  church_name: string;
  vendedor_id: string | null;
}

export default function SalesDashboard() {
  const [period, setPeriod] = useState('current');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'current') {
      return { start: startOfMonth(now), end: endOfMonth(now) };
    } else if (period === 'previous') {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    } else if (period === 'custom' && customStartDate && customEndDate) {
      return { start: parseISO(customStartDate), end: parseISO(customEndDate) };
    }
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }, [period, customStartDate, customEndDate]);

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

  const { data: orders } = useQuery({
    queryKey: ['ebd-orders-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_pedidos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  const { data: orderItems } = useQuery({
    queryKey: ['ebd-order-items-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_pedidos_itens')
        .select('id, pedido_id, quantidade');
      if (error) throw error;
      return data as OrderItem[];
    },
  });

  const { data: churches } = useQuery({
    queryKey: ['churches-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('churches')
        .select('id, church_name, vendedor_id');
      if (error) throw error;
      return data as Church[];
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

  // Filter orders by date range and payment status
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(order => {
      const orderDate = parseISO(order.created_at);
      const isPaid = order.payment_status === 'approved' || order.status === 'paid';
      return isPaid && isWithinInterval(orderDate, { start: dateRange.start, end: dateRange.end });
    });
  }, [orders, dateRange]);

  // Calculate metrics
  const metrics = useMemo(() => {
    // EBD clients count
    const ebdClientIds = new Set(
      assinaturas
        ?.filter((a: any) => a.modulos?.nome_modulo === 'REOBOTE EBD')
        .map((a: any) => a.cliente_id) || []
    );
    const totalEbdClients = ebdClientIds.size;

    // Sales metrics
    const totalSales = filteredOrders.length;
    const totalValue = filteredOrders.reduce((sum, o) => sum + Number(o.valor_total), 0);
    
    // Items sold
    const orderIds = new Set(filteredOrders.map(o => o.id));
    const totalItems = orderItems
      ?.filter(item => orderIds.has(item.pedido_id))
      .reduce((sum, item) => sum + item.quantidade, 0) || 0;

    return {
      totalEbdClients,
      totalSales,
      totalValue,
      totalItems,
    };
  }, [assinaturas, filteredOrders, orderItems]);

  // Calculate sales per vendedor
  const vendedorStats = useMemo(() => {
    if (!vendedores || !filteredOrders || !churches) return [];

    const churchVendedorMap = new Map(churches.map(c => [c.id, c.vendedor_id]));
    
    return vendedores.map(vendedor => {
      // Get orders from churches assigned to this vendedor
      const vendedorOrders = filteredOrders.filter(order => {
        const vendedorId = churchVendedorMap.get(order.church_id);
        return vendedorId === vendedor.id;
      });

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
  }, [vendedores, filteredOrders, churches]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const periodLabel = useMemo(() => {
    if (period === 'current') {
      return format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
    } else if (period === 'previous') {
      return format(subMonths(new Date(), 1), "MMMM 'de' yyyy", { locale: ptBR });
    } else if (customStartDate && customEndDate) {
      return `${format(parseISO(customStartDate), 'dd/MM/yyyy')} - ${format(parseISO(customEndDate), 'dd/MM/yyyy')}`;
    }
    return '';
  }, [period, customStartDate, customEndDate]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Vendas EBD</h1>
          <p className="text-muted-foreground">Métricas e performance da equipe de vendas</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" asChild>
            <Link to="/admin/vendedores">
              <Users className="h-4 w-4 mr-2" />
              Gerenciar Vendedores
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Mês Atual</SelectItem>
                <SelectItem value="previous">Mês Anterior</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

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

      <div className="text-sm text-muted-foreground capitalize">
        Período: {periodLabel}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes EBD Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalEbdClients}</div>
            <p className="text-xs text-muted-foreground">
              Igrejas com módulo EBD ativo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSales}</div>
            <p className="text-xs text-muted-foreground">
              Pedidos pagos no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              Receita do período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens Vendidos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalItems}</div>
            <p className="text-xs text-muted-foreground">
              Revistas vendidas
            </p>
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
    </div>
  );
}
