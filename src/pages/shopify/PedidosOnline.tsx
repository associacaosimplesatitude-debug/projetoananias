import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Package, 
  Search, 
  Calendar as CalendarIcon,
  ExternalLink,
  TrendingUp,
  ShoppingCart,
  Truck,
  CheckCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ShopifyPedido {
  id: string;
  shopify_order_id: number;
  order_number: string;
  vendedor_id: string | null;
  cliente_id: string | null;
  status_pagamento: string;
  valor_total: number;
  valor_frete: number;
  valor_para_meta: number;
  customer_email: string | null;
  customer_name: string | null;
  created_at: string;
  codigo_rastreio: string | null;
  url_rastreio: string | null;
  cliente?: {
    nome_igreja: string;
  } | null;
  vendedor?: {
    nome: string;
  } | null;
}

type DateFilter = 'last_7_days' | 'last_month' | 'custom' | 'all';

export default function PedidosOnline() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("last_7_days");
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ['ebd-shopify-pedidos-online'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_shopify_pedidos')
        .select(`
          *,
          cliente:ebd_clientes(nome_igreja),
          vendedor:vendedores(nome)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ShopifyPedido[];
    },
  });

  // Filter pedidos by date range
  const filteredByDate = useMemo(() => {
    if (!pedidos) return [];

    const now = new Date();
    
    switch (dateFilter) {
      case 'last_7_days': {
        const sevenDaysAgo = subDays(now, 7);
        return pedidos.filter(p => new Date(p.created_at) >= sevenDaysAgo);
      }
      case 'last_month': {
        const lastMonth = subMonths(now, 1);
        const start = startOfMonth(lastMonth);
        const end = endOfMonth(lastMonth);
        return pedidos.filter(p => {
          const date = new Date(p.created_at);
          return isWithinInterval(date, { start, end });
        });
      }
      case 'custom': {
        if (!customDateRange.from) return pedidos;
        const start = customDateRange.from;
        const end = customDateRange.to || customDateRange.from;
        return pedidos.filter(p => {
          const date = new Date(p.created_at);
          return isWithinInterval(date, { start, end: new Date(end.getTime() + 86400000 - 1) });
        });
      }
      case 'all':
      default:
        return pedidos;
    }
  }, [pedidos, dateFilter, customDateRange]);

  // Filter by search term
  const filteredPedidos = useMemo(() => {
    if (!searchTerm) return filteredByDate;
    
    const term = searchTerm.toLowerCase();
    return filteredByDate.filter(p => 
      p.order_number?.toLowerCase().includes(term) ||
      p.customer_name?.toLowerCase().includes(term) ||
      p.customer_email?.toLowerCase().includes(term) ||
      p.cliente?.nome_igreja?.toLowerCase().includes(term)
    );
  }, [filteredByDate, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalPedidos = filteredByDate.length;
    const totalFaturado = filteredByDate.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    const pedidosPagos = filteredByDate.filter(p => p.status_pagamento === 'paid').length;
    const pedidosEntregues = filteredByDate.filter(p => p.codigo_rastreio).length;
    
    return { totalPedidos, totalFaturado, pedidosPagos, pedidosEntregues };
  }, [filteredByDate]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-700">Pago</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pendente</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-700">Expirado</Badge>;
      case 'refunded':
        return <Badge className="bg-purple-100 text-purple-700">Reembolsado</Badge>;
      case 'partially_refunded':
        return <Badge className="bg-purple-100 text-purple-700">Reembolso Parcial</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Desconhecido'}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const handleDateFilterChange = (value: DateFilter) => {
    setDateFilter(value);
    if (value !== 'custom') {
      setCustomDateRange({ from: undefined, to: undefined });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos Online</h1>
          <p className="text-muted-foreground">Pedidos finalizados via Shopify</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pedidos</p>
                <p className="text-2xl font-bold">{stats.totalPedidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Faturado</p>
                <p className="text-2xl font-bold">
                  R$ {stats.totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pedidos Pagos</p>
                <p className="text-2xl font-bold">{stats.pedidosPagos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Truck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Com Rastreio</p>
                <p className="text-2xl font-bold">{stats.pedidosEntregues}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, cliente ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={dateFilter} onValueChange={(v) => handleDateFilterChange(v as DateFilter)}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filtrar por data" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Pedidos</SelectItem>
                <SelectItem value="last_7_days">Últimos 7 Dias</SelectItem>
                <SelectItem value="last_month">Mês Anterior</SelectItem>
                <SelectItem value="custom">Período Customizado</SelectItem>
              </SelectContent>
            </Select>

            {dateFilter === 'custom' && (
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full md:w-[280px] justify-start text-left font-normal",
                      !customDateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateRange.from ? (
                      customDateRange.to ? (
                        <>
                          {format(customDateRange.from, "dd/MM/yyyy")} -{" "}
                          {format(customDateRange.to, "dd/MM/yyyy")}
                        </>
                      ) : (
                        format(customDateRange.from, "dd/MM/yyyy")
                      )
                    ) : (
                      <span>Selecione o período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customDateRange.from}
                    selected={{
                      from: customDateRange.from,
                      to: customDateRange.to,
                    }}
                    onSelect={(range) => {
                      setCustomDateRange({
                        from: range?.from,
                        to: range?.to,
                      });
                    }}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Lista de Pedidos ({filteredPedidos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPedidos.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status Pgto</TableHead>
                    <TableHead>Rastreio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPedidos.map((pedido) => (
                    <TableRow key={pedido.id}>
                      <TableCell className="font-medium">
                        #{pedido.order_number}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(pedido.created_at)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{pedido.cliente?.nome_igreja || pedido.customer_name || '-'}</p>
                          {pedido.customer_email && (
                            <p className="text-sm text-muted-foreground">{pedido.customer_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {pedido.vendedor?.nome || '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(pedido.status_pagamento)}
                      </TableCell>
                      <TableCell>
                        {pedido.codigo_rastreio ? (
                          pedido.url_rastreio ? (
                            <a 
                              href={pedido.url_rastreio} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              {pedido.codigo_rastreio}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span>{pedido.codigo_rastreio}</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
