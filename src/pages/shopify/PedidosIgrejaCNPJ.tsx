import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Button } from "@/components/ui/button";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Package,
  Search,
  Calendar as CalendarIcon,
  TrendingUp,
  ShoppingCart,
  Users,
  CheckCircle,
  Eye,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PedidoOnlineDetailDialog } from "@/components/admin/PedidoOnlineDetailDialog";

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
  order_date?: string | null;
  codigo_rastreio: string | null;
  url_rastreio: string | null;
  cliente?: {
    nome_igreja: string;
    tipo_cliente: string | null;
    vendedor_id: string | null;
  } | null;
  vendedor?: {
    nome: string;
  } | null;
}

type DateFilter = "last_7_days" | "last_month" | "custom" | "all";

type CanonicalFinancialStatus =
  | "paid"
  | "pending"
  | "unpaid"
  | "authorized"
  | "refunded"
  | "partially_refunded"
  | "voided"
  | "unknown"
  | "faturado";

const canonicalizeStatus = (statusRaw: string | null | undefined): CanonicalFinancialStatus => {
  const s = (statusRaw ?? "").trim().toLowerCase();

  if (s === "pago") return "paid";
  if (s === "pendente") return "pending";
  if (s === "não pago" || s === "nao pago") return "unpaid";
  if (s === "reembolsado") return "refunded";
  if (s === "parcialmente reembolsado" || s === "reembolso parcial") return "partially_refunded";
  if (s === "cancelado") return "voided";
  if (s === "faturado") return "faturado";
  if (s === "paid") return "paid";
  if (s === "pending") return "pending";
  if (s === "unpaid") return "unpaid";
  if (s === "authorized") return "authorized";
  if (s === "refunded") return "refunded";
  if (s === "partially_refunded") return "partially_refunded";
  if (s === "voided") return "voided";

  return "unknown";
};

const isPaidStatus = (statusRaw: string | null | undefined) => {
  const s = canonicalizeStatus(statusRaw);
  return s === "paid";
};

export default function PedidosIgrejaCNPJ() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<ShopifyPedido | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["ebd-shopify-pedidos-igreja-cnpj"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select(
          `
          *,
          cliente:ebd_clientes(nome_igreja, tipo_cliente, vendedor_id),
          vendedor:vendedores(nome)
        `
        )
        .neq("status_pagamento", "Faturado")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Filter: only orders from clients with tipo_cliente = 'igreja_cnpj' AND vendedor_id is not null
      return (data as ShopifyPedido[])
        .filter((p) => isPaidStatus(p.status_pagamento))
        .filter((p) => p.cliente?.tipo_cliente === "igreja_cnpj" && p.cliente?.vendedor_id);
    },
  });

  const getPedidoDate = (pedido: ShopifyPedido) => pedido.order_date || pedido.created_at;

  const filteredByDate = useMemo(() => {
    if (!pedidos) return [];

    const now = new Date();

    switch (dateFilter) {
      case "last_7_days": {
        const sevenDaysAgo = subDays(now, 7);
        return pedidos.filter((p) => new Date(getPedidoDate(p)) >= sevenDaysAgo);
      }
      case "last_month": {
        const lastMonth = subMonths(now, 1);
        const start = startOfMonth(lastMonth);
        const end = endOfMonth(lastMonth);
        return pedidos.filter((p) => {
          const date = new Date(getPedidoDate(p));
          return isWithinInterval(date, { start, end });
        });
      }
      case "custom": {
        if (!customDateRange.from) return pedidos;
        const start = customDateRange.from;
        const end = customDateRange.to || customDateRange.from;
        return pedidos.filter((p) => {
          const date = new Date(getPedidoDate(p));
          return isWithinInterval(date, {
            start,
            end: new Date(end.getTime() + 86400000 - 1),
          });
        });
      }
      case "all":
      default:
        return pedidos;
    }
  }, [pedidos, dateFilter, customDateRange]);

  const filteredPedidos = useMemo(() => {
    if (!searchTerm) return filteredByDate;

    const term = searchTerm.toLowerCase();
    return filteredByDate.filter(
      (p) =>
        p.order_number?.toLowerCase().includes(term) ||
        p.customer_name?.toLowerCase().includes(term) ||
        p.customer_email?.toLowerCase().includes(term) ||
        p.cliente?.nome_igreja?.toLowerCase().includes(term)
    );
  }, [filteredByDate, searchTerm]);

  const stats = useMemo(() => {
    const totalPedidos = filteredByDate.length;
    const totalFaturado = filteredByDate.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    const pedidosPagos = filteredByDate.filter((p) => isPaidStatus(p.status_pagamento)).length;
    
    const customerOrderCounts = new Map<string, number>();
    filteredByDate.forEach((pedido) => {
      const customerKey = pedido.customer_email?.toLowerCase() || pedido.cliente?.nome_igreja?.toLowerCase() || pedido.customer_name?.toLowerCase() || '';
      if (customerKey) {
        customerOrderCounts.set(customerKey, (customerOrderCounts.get(customerKey) || 0) + 1);
      }
    });
    const recurrentCustomers = Array.from(customerOrderCounts.values()).filter((count) => count > 1).length;

    return { totalPedidos, totalFaturado, pedidosPagos, recurrentCustomers };
  }, [filteredByDate]);

  const getStatusBadge = (statusRaw: string) => {
    const status = canonicalizeStatus(statusRaw);

    switch (status) {
      case "paid":
        return <Badge>Pago</Badge>;
      case "pending":
        return <Badge variant="secondary">Pendente</Badge>;
      case "authorized":
        return <Badge variant="secondary">Autorizado</Badge>;
      case "unpaid":
        return <Badge variant="destructive">Não pago</Badge>;
      case "refunded":
        return <Badge variant="outline">Reembolsado</Badge>;
      case "partially_refunded":
        return <Badge variant="outline">Reembolso parcial</Badge>;
      case "voided":
        return <Badge variant="destructive">Cancelado</Badge>;
      case "faturado":
        return <Badge variant="secondary">Faturado</Badge>;
      default:
        return <Badge variant="secondary">{statusRaw || "Desconhecido"}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const handleDateFilterChange = (value: DateFilter) => {
    setDateFilter(value);
    if (value !== "custom") {
      setCustomDateRange({ from: undefined, to: undefined });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Pedidos Igreja CNPJ
          </h1>
          <p className="text-muted-foreground">Pedidos de clientes tipo Igreja CNPJ atribuídos a vendedores</p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ShoppingCart className="h-5 w-5 text-primary" />
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
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Faturado</p>
                <p className="text-2xl font-bold">
                  R$ {stats.totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle className="h-5 w-5 text-primary" />
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
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recorrentes</p>
                <p className="text-2xl font-bold">{stats.recurrentCustomers}</p>
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
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum pedido encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPedidos.map((pedido) => (
                    <TableRow 
                      key={pedido.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedPedido(pedido);
                        setDetailDialogOpen(true);
                      }}
                    >
                      <TableCell className="font-medium">#{pedido.order_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{pedido.cliente?.nome_igreja || pedido.customer_name || "—"}</p>
                          <p className="text-sm text-muted-foreground">{pedido.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{pedido.vendedor?.nome || "—"}</TableCell>
                      <TableCell>{getStatusBadge(pedido.status_pagamento)}</TableCell>
                      <TableCell className="text-right">
                        R$ {pedido.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{formatDate(getPedidoDate(pedido))}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPedido(pedido);
                            setDetailDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPedido && (
        <PedidoOnlineDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          pedido={selectedPedido}
        />
      )}
    </div>
  );
}
