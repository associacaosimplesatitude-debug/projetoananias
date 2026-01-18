import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  User,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PedidoOnlineDetailDialog } from "@/components/admin/PedidoOnlineDetailDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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
  comissao_aprovada?: boolean;
  source?: 'ebd_shopify_pedidos' | 'ebd_shopify_pedidos_cg';
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

export default function PedidosIgrejaCPF() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<ShopifyPedido | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPedidos, setSelectedPedidos] = useState<Set<string>>(new Set());

  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();

  // First fetch all clients with tipo_cliente = 'IGREJA CPF' (or legacy 'Igreja CPF') and vendedor assigned
  const { data: clientesCPF } = useQuery({
    queryKey: ["ebd-clientes-igreja-cpf"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, email_superintendente, tipo_cliente, vendedor_id, vendedor:vendedores(nome)")
        .in("tipo_cliente", ["IGREJA CPF", "Igreja CPF"])
        .not("vendedor_id", "is", null);

      if (error) throw error;
      return data;
    },
  });

  const { data: pedidos, isLoading, refetch } = useQuery({
    queryKey: ["ebd-shopify-pedidos-igreja-cpf", clientesCPF],
    queryFn: async () => {
      if (!clientesCPF || clientesCPF.length === 0) return [];

      // Create a map of emails to clients for quick lookup
      const emailToClient = new Map<string, typeof clientesCPF[0]>();
      clientesCPF.forEach(c => {
        if (c.email_superintendente) {
          emailToClient.set(c.email_superintendente.toLowerCase(), c);
        }
      });

      // Fetch orders from ebd_shopify_pedidos (linked by cliente_id)
      const { data: pedidosVinculados, error: err1 } = await supabase
        .from("ebd_shopify_pedidos")
        .select(`
          *,
          cliente:ebd_clientes(nome_igreja, tipo_cliente, vendedor_id),
          vendedor:vendedores(nome)
        `)
        .neq("status_pagamento", "Faturado")
        .order("created_at", { ascending: false });

      if (err1) throw err1;

      // Fetch orders from Central Gospel table
      const { data: pedidosCG, error: err2 } = await supabase
        .from("ebd_shopify_pedidos_cg")
        .select("*")
        .order("created_at", { ascending: false });

      if (err2) throw err2;

      // Filter pedidos vinculados by tipo_cliente (case-insensitive)
      const filteredVinculados = (pedidosVinculados || [])
        .filter((p) => isPaidStatus(p.status_pagamento))
        .filter((p) => {
          const tipo = p.cliente?.tipo_cliente?.trim().toLowerCase() || '';
          return (tipo === 'igreja cpf') && p.cliente?.vendedor_id;
        })
        .map(p => ({
          ...p,
          source: 'ebd_shopify_pedidos' as const,
        }));

      // Match Central Gospel orders by email with CPF clients
      const matchedCG = (pedidosCG || [])
        .filter((p) => isPaidStatus(p.status_pagamento))
        .filter((p) => {
          if (!p.customer_email) return false;
          return emailToClient.has(p.customer_email.toLowerCase());
        })
        .map(p => {
          const cliente = emailToClient.get(p.customer_email!.toLowerCase())!;
          return {
            ...p,
            cliente_id: cliente.id,
            vendedor_id: cliente.vendedor_id,
            cliente: {
              nome_igreja: cliente.nome_igreja,
              tipo_cliente: cliente.tipo_cliente,
              vendedor_id: cliente.vendedor_id,
            },
            vendedor: cliente.vendedor,
            valor_para_meta: p.valor_total,
            comissao_aprovada: false, // CG orders não têm esse campo
            source: 'ebd_shopify_pedidos_cg' as const,
          };
        });

      // Combine and deduplicate by order_number
      const allOrders = [...filteredVinculados, ...matchedCG];
      const seen = new Set<string>();
      return allOrders.filter(p => {
        const key = p.order_number;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    enabled: !!clientesCPF,
  });

  // Mutation para aprovar comissão de um pedido
  const aprovarComissaoMutation = useMutation({
    mutationFn: async (pedido: ShopifyPedido) => {
      const vendedorId = pedido.vendedor_id || pedido.cliente?.vendedor_id;
      if (!vendedorId) throw new Error("Pedido sem vendedor atribuído");

      // Buscar percentual do vendedor
      const { data: vendedor, error: vendedorError } = await supabase
        .from("vendedores")
        .select("comissao_percentual")
        .eq("id", vendedorId)
        .single();

      if (vendedorError) throw vendedorError;

      const comissaoPercentual = vendedor?.comissao_percentual || 5;
      const dataBase = new Date(pedido.order_date || pedido.created_at);

      // Pedido online = 1 parcela, pagamento à vista, comissão já liberada
      // Só incluir shopify_pedido_id se for da tabela principal (FK constraint)
      const parcela = {
        ...(pedido.source === 'ebd_shopify_pedidos' ? { shopify_pedido_id: pedido.id } : {}),
        vendedor_id: vendedorId,
        cliente_id: pedido.cliente_id,
        origem: 'online',
        status: 'aguardando',
        numero_parcela: 1,
        total_parcelas: 1,
        valor: pedido.valor_total,
        valor_comissao: pedido.valor_total * (comissaoPercentual / 100),
        data_vencimento: dataBase.toISOString().split('T')[0],
        comissao_status: 'liberada', // Já pago no Shopify
      };

      const { error: insertError } = await supabase
        .from("vendedor_propostas_parcelas")
        .insert(parcela);

      if (insertError) throw insertError;

      // Marcar pedido como aprovado (apenas para pedidos da tabela principal)
      if (pedido.source === 'ebd_shopify_pedidos') {
        const { error: updateError } = await supabase
          .from("ebd_shopify_pedidos")
          .update({ comissao_aprovada: true })
          .eq("id", pedido.id);

        if (updateError) throw updateError;
      }

      return pedido;
    },
  });

  // Mutation para aprovar múltiplas comissões
  const aprovarSelecionadasMutation = useMutation({
    mutationFn: async () => {
      const pedidosParaAprovar = filteredPedidos.filter(
        p => selectedPedidos.has(p.id) && !p.comissao_aprovada && p.source === 'ebd_shopify_pedidos'
      );
      
      for (const pedido of pedidosParaAprovar) {
        await aprovarComissaoMutation.mutateAsync(pedido);
      }
      
      return pedidosParaAprovar.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} comissão(ões) aprovada(s) com sucesso!`);
      setSelectedPedidos(new Set());
      refetch();
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
    },
    onError: (error) => {
      toast.error("Erro ao aprovar comissões", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
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

  // Pedidos que podem ser selecionados para aprovação (inclui pedidos de ambas as fontes)
  const pedidosAprovaveis = useMemo(() => 
    filteredPedidos.filter(p => 
      !p.comissao_aprovada && 
      isPaidStatus(p.status_pagamento) &&
      p.vendedor_id
    ),
    [filteredPedidos]
  );

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPedidos(new Set(pedidosAprovaveis.map(p => p.id)));
    } else {
      setSelectedPedidos(new Set());
    }
  };

  const handleSelectPedido = (pedidoId: string, checked: boolean) => {
    const newSelection = new Set(selectedPedidos);
    if (checked) {
      newSelection.add(pedidoId);
    } else {
      newSelection.delete(pedidoId);
    }
    setSelectedPedidos(newSelection);
  };

  const allSelected = pedidosAprovaveis.length > 0 && pedidosAprovaveis.every(p => selectedPedidos.has(p.id));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6" />
          Pedidos Igreja CPF
        </h1>
        <p className="text-muted-foreground">Pedidos de clientes tipo Igreja CPF atribuídos a vendedores</p>
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
          {/* Barra de aprovação em lote - apenas para admin */}
          {isAdmin && filteredPedidos.length > 0 && (
            <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedPedidos.size > 0 && selectedPedidos.size === pedidosAprovaveis.length && pedidosAprovaveis.length > 0}
                  onCheckedChange={handleSelectAll}
                  disabled={pedidosAprovaveis.length === 0}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedPedidos.size > 0 
                    ? `${selectedPedidos.size} selecionado(s)` 
                    : pedidosAprovaveis.length > 0 
                      ? "Selecionar todas" 
                      : "Todas as comissões aprovadas"}
                </span>
              </div>
              
              {selectedPedidos.size > 0 && (
                <Button 
                  onClick={() => aprovarSelecionadasMutation.mutate()}
                  disabled={aprovarSelecionadasMutation.isPending}
                  size="sm"
                >
                  {aprovarSelecionadasMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Aprovar Selecionadas ({selectedPedidos.size})
                </Button>
              )}
            </div>
          )}

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
                    {isAdmin && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={handleSelectAll}
                          disabled={pedidosAprovaveis.length === 0}
                        />
                      </TableHead>
                    )}
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPedidos.map((pedido) => {
                    const isAprovavel = !pedido.comissao_aprovada && isPaidStatus(pedido.status_pagamento) && !!pedido.vendedor_id;
                    const isSelected = selectedPedidos.has(pedido.id);
                    
                    return (
                      <TableRow 
                        key={pedido.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50",
                          isSelected && "bg-primary/5"
                        )}
                        onClick={() => {
                          setSelectedPedido(pedido);
                          setDetailDialogOpen(true);
                        }}
                      >
                        {isAdmin && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {isAprovavel ? (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleSelectPedido(pedido.id, !!checked)}
                              />
                            ) : (
                              <div className="w-4 h-4" />
                            )}
                          </TableCell>
                        )}
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
                        <TableCell>
                          {pedido.comissao_aprovada ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Aprovada
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pendente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {/* Botão aprovar individual - apenas para admin e não aprovadas */}
                            {isAdmin && isAprovavel && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  aprovarComissaoMutation.mutate(pedido);
                                }}
                                disabled={aprovarComissaoMutation.isPending}
                                title="Aprovar comissão"
                              >
                                {aprovarComissaoMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </Button>
                            )}
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
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
