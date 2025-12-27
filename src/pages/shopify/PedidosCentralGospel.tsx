import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Package, Search, Calendar, Users, DollarSign, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { PedidoCGDetailDialog } from "@/components/admin/PedidoCGDetailDialog";

type DateFilter = "today" | "7days" | "30days" | "thisMonth" | "custom" | "all";

type CanonicalFinancialStatus = "paid" | "pending" | "refunded" | "voided" | "partially_refunded" | "partially_paid" | "authorized" | "unknown";

function canonicalizeStatus(statusRaw: string | null | undefined): CanonicalFinancialStatus {
  if (!statusRaw) return "unknown";
  const s = statusRaw.toLowerCase().trim();
  if (s === "paid" || s === "pago") return "paid";
  if (s === "pending" || s === "pendente") return "pending";
  if (s === "refunded" || s === "reembolsado") return "refunded";
  if (s === "voided" || s === "cancelado") return "voided";
  if (s === "partially_refunded") return "partially_refunded";
  if (s === "partially_paid") return "partially_paid";
  if (s === "authorized" || s === "autorizado") return "authorized";
  return "unknown";
}

function isPaidStatus(statusRaw: string | null | undefined): boolean {
  return canonicalizeStatus(statusRaw) === "paid";
}

interface ShopifyPedidoCG {
  id: string;
  shopify_order_id: number;
  order_number: string;
  status_pagamento: string;
  customer_email: string | null;
  customer_name: string | null;
  valor_total: number;
  valor_frete: number;
  codigo_rastreio: string | null;
  url_rastreio: string | null;
  created_at: string;
  order_date?: string | null;
  updated_at: string;
}

export default function PedidosCentralGospel() {
  const queryClient = useQueryClient();
  const { isAdmin, isGerenteEbd } = useUserRole();
  const canManage = isAdmin || isGerenteEbd;
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30days");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [selectedPedido, setSelectedPedido] = useState<ShopifyPedidoCG | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const syncOrdersMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("cg-shopify-sync-orders", {
        body: { financial_status: "paid", status: "any" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.synced} pedidos sincronizados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["shopify-pedidos-cg"] });
    },
    onError: (error) => {
      console.error("Sync error:", error);
      toast.error("Erro ao sincronizar pedidos");
    },
  });

  // Realtime subscription for automatic updates
  useEffect(() => {
    const channel = supabase
      .channel('ebd-shopify-pedidos-cg-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ebd_shopify_pedidos_cg'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["shopify-pedidos-cg"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["shopify-pedidos-cg"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos_cg")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as ShopifyPedidoCG[];
    },
  });

  const filteredByDate = useMemo(() => {
    const now = new Date();

    return pedidos.filter((pedido) => {
      const dateField = pedido.order_date || pedido.created_at;
      const createdAt = parseISO(dateField);

      switch (dateFilter) {
        case "today":
          return format(createdAt, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
        case "7days":
          return createdAt >= subDays(now, 7);
        case "30days":
          return createdAt >= subDays(now, 30);
        case "thisMonth":
          return isWithinInterval(createdAt, {
            start: startOfMonth(now),
            end: endOfMonth(now),
          });
        case "custom":
          if (customDateRange.from && customDateRange.to) {
            return isWithinInterval(createdAt, {
              start: customDateRange.from,
              end: customDateRange.to,
            });
          }
          return true;
        case "all":
        default:
          return true;
      }
    });
  }, [pedidos, dateFilter, customDateRange]);

  const filteredPedidos = useMemo(() => {
    if (!searchTerm) return filteredByDate;

    const term = searchTerm.toLowerCase();
    return filteredByDate.filter(
      (pedido) =>
        pedido.order_number.toLowerCase().includes(term) ||
        pedido.customer_name?.toLowerCase().includes(term) ||
        pedido.customer_email?.toLowerCase().includes(term) ||
        pedido.codigo_rastreio?.toLowerCase().includes(term)
    );
  }, [filteredByDate, searchTerm]);

  const stats = useMemo(() => {
    const paidOrders = filteredByDate.filter((p) => isPaidStatus(p.status_pagamento));
    
    // Calculate recurrent customers: unique customers with more than 1 order in the filtered period
    const customerOrderCounts = new Map<string, number>();
    filteredByDate.forEach((pedido) => {
      const customerKey = pedido.customer_email?.toLowerCase() || pedido.customer_name?.toLowerCase() || '';
      if (customerKey) {
        customerOrderCounts.set(customerKey, (customerOrderCounts.get(customerKey) || 0) + 1);
      }
    });
    const recurrentCustomers = Array.from(customerOrderCounts.values()).filter((count) => count > 1).length;

    return {
      total: filteredByDate.length,
      totalValue: filteredByDate.reduce((sum, p) => sum + (p.valor_total || 0), 0),
      paid: paidOrders.length,
      recurrent: recurrentCustomers,
    };
  }, [filteredByDate]);

  const getStatusBadge = (status: string) => {
    const canonical = canonicalizeStatus(status);
    switch (canonical) {
      case "paid":
        return <Badge className="bg-green-500">Pago</Badge>;
      case "pending":
        return <Badge variant="outline">Pendente</Badge>;
      case "refunded":
        return <Badge variant="destructive">Reembolsado</Badge>;
      case "voided":
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getPedidoDate = (pedido: ShopifyPedidoCG) => pedido.order_date || pedido.created_at;

  const handleDateFilterChange = (value: DateFilter) => {
    setDateFilter(value);
    if (value !== "custom") {
      setCustomDateRange({ from: undefined, to: undefined });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pedidos Online - Central Gospel</h1>
          <p className="text-muted-foreground">Pedidos da loja centralgospel.com.br</p>
        </div>
        {isAdmin && (
          <Button onClick={() => syncOrdersMutation.mutate()} disabled={syncOrdersMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncOrdersMutation.isPending ? "animate-spin" : ""}`} />
            {syncOrdersMutation.isPending ? "Sincronizando..." : "Sincronizar Pedidos"}
          </Button>
        )}
      </div>


      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por pedido, cliente, email ou rastreio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={dateFilter} onValueChange={(v) => handleDateFilterChange(v as DateFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
              <SelectItem value="thisMonth">Este mês</SelectItem>
              <SelectItem value="custom">Período personalizado</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>

          {dateFilter === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  {customDateRange.from && customDateRange.to
                    ? `${format(customDateRange.from, "dd/MM")} - ${format(customDateRange.to, "dd/MM")}`
                    : "Selecionar datas"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="range"
                  selected={{ from: customDateRange.from, to: customDateRange.to }}
                  onSelect={(range) => setCustomDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rastreio</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredPedidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum pedido encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPedidos.map((pedido) => (
                    <TableRow 
                      key={pedido.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedPedido(pedido);
                        setDialogOpen(true);
                      }}
                    >
                      <TableCell className="font-medium">{pedido.order_number}</TableCell>
                      <TableCell>{formatDate(getPedidoDate(pedido))}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{pedido.customer_name || "-"}</div>
                          <div className="text-sm text-muted-foreground">{pedido.customer_email || "-"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {pedido.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell>{getStatusBadge(pedido.status_pagamento)}</TableCell>
                      <TableCell>
                        {pedido.codigo_rastreio ? (
                          pedido.url_rastreio ? (
                            <a
                              href={pedido.url_rastreio}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {pedido.codigo_rastreio}
                            </a>
                          ) : (
                            <span>{pedido.codigo_rastreio}</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPedido(pedido);
                            setDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <PedidoCGDetailDialog
        pedido={selectedPedido}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
