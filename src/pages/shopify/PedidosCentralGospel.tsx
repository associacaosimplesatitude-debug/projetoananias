import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Search, Calendar, Eye, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
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

interface EbdCliente {
  id: string;
  email_superintendente: string | null;
  vendedor_id: string | null;
  vendedor?: { id: string; nome: string } | null;
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
  customer_document?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_complemento?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_estado?: string | null;
  endereco_cep?: string | null;
  endereco_nome?: string | null;
  endereco_telefone?: string | null;
  // DANFE fields from Bling
  nota_fiscal_url?: string | null;
  nota_fiscal_numero?: string | null;
  // New commission fields
  vendedor_id?: string | null;
  cliente_id?: string | null;
  comissao_aprovada?: boolean;
  // Enriched fields (frontend only)
  cliente?: EbdCliente | null;
  vendedor?: { id: string; nome: string } | null;
}

export default function PedidosCentralGospel() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30days");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [selectedPedido, setSelectedPedido] = useState<ShopifyPedidoCG | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPedidos, setSelectedPedidos] = useState<Set<string>>(new Set());

  const syncOrdersMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const createdAtMin = startOfMonth(now).toISOString();
      const createdAtMax = now.toISOString();

      const { data, error } = await supabase.functions.invoke("cg-shopify-sync-orders", {
        body: {
          financial_status: "paid",
          status: "any",
          created_at_min: createdAtMin,
          created_at_max: createdAtMax,
          // Itens geram muitas operações e podem estourar limites; sincronize itens depois se necessário.
          sync_items: false,
        },
      });

      if (error) throw error;
      return data as { success?: boolean; synced?: number; error?: string; details?: string };
    },
    onSuccess: (data) => {
      toast.success("Pedidos sincronizados", {
        description: `Sincronizados (mês atual): ${data?.synced ?? 0}`,
      });
      queryClient.invalidateQueries({ queryKey: ["shopify-pedidos-cg"] });
    },
    onError: (err: any) => {
      console.error("Falha ao sincronizar pedidos (cg-shopify-sync-orders)", err);
      const description =
        err?.context?.body?.error ||
        err?.context?.body?.details ||
        err?.message ||
        "Erro desconhecido";

      toast.error("Falha ao sincronizar pedidos", { description });
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

  // Query to fetch clients with vendedor info for email matching
  const { data: clientesMap = new Map() } = useQuery({
    queryKey: ["ebd-clientes-for-cg"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, email_superintendente, vendedor_id, vendedor:vendedores(id, nome)")
        .not("email_superintendente", "is", null);

      if (error) throw error;

      const map = new Map<string, EbdCliente>();
      (data || []).forEach((c: any) => {
        if (c.email_superintendente) {
          map.set(c.email_superintendente.toLowerCase(), {
            id: c.id,
            email_superintendente: c.email_superintendente,
            vendedor_id: c.vendedor_id,
            vendedor: c.vendedor,
          });
        }
      });
      return map;
    },
  });

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["shopify-pedidos-cg"],
    queryFn: async () => {
      const { data: allPedidos, error: pedidosError } = await supabase
        .from("ebd_shopify_pedidos_cg")
        .select("*")
        .order("created_at", { ascending: false });

      if (pedidosError) throw pedidosError;

      return (allPedidos || []) as ShopifyPedidoCG[];
    },
  });

  // Enrich pedidos with cliente/vendedor info from email matching
  const enrichedPedidos = useMemo(() => {
    return pedidos.map((p) => {
      const email = p.customer_email?.toLowerCase();
      const matchedCliente = email ? clientesMap.get(email) : null;

      return {
        ...p,
        cliente: matchedCliente || null,
        vendedor: matchedCliente?.vendedor || null,
        // Use matched vendedor_id if not already set
        vendedor_id: p.vendedor_id || matchedCliente?.vendedor_id || null,
        cliente_id: p.cliente_id || matchedCliente?.id || null,
      };
    });
  }, [pedidos, clientesMap]);

  // Mutation to approve commission - now creates parcela in vendedor_propostas_parcelas
  const aprovarComissaoMutation = useMutation({
    mutationFn: async (pedido: ShopifyPedidoCG) => {
      const vendedorId = pedido.vendedor_id;
      if (!vendedorId) throw new Error("Pedido sem vendedor atribuído");

      // 1. Fetch vendedor commission percentage
      const { data: vendedor, error: vendedorError } = await supabase
        .from("vendedores")
        .select("comissao_percentual")
        .eq("id", vendedorId)
        .single();

      if (vendedorError) throw vendedorError;

      const comissaoPercentual = vendedor?.comissao_percentual || 5;
      const dataBase = new Date(pedido.order_date || pedido.created_at);

      // 2. Create commission parcela (sem shopify_pedido_id pois CG usa tabela diferente)
      const parcela = {
        vendedor_id: vendedorId,
        cliente_id: pedido.cliente_id,
        origem: 'online',
        status: 'aguardando',
        numero_parcela: 1,
        total_parcelas: 1,
        valor: pedido.valor_total,
        valor_comissao: pedido.valor_total * (comissaoPercentual / 100),
        data_vencimento: dataBase.toISOString().split('T')[0],
        comissao_status: 'liberada',
        link_danfe: pedido.nota_fiscal_url || null,
        nota_fiscal_numero: pedido.nota_fiscal_numero || null,
      };

      const { error: insertError } = await supabase
        .from("vendedor_propostas_parcelas")
        .insert(parcela);

      if (insertError) throw insertError;

      // 3. Mark order as commission approved
      const { error } = await supabase
        .from("ebd_shopify_pedidos_cg")
        .update({ comissao_aprovada: true })
        .eq("id", pedido.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comissão aprovada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["shopify-pedidos-cg"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao aprovar comissão", { description: err.message });
    },
  });

  // Mutation to approve multiple commissions
  const aprovarSelecionadasMutation = useMutation({
    mutationFn: async (pedidosToApprove: ShopifyPedidoCG[]) => {
      for (const pedido of pedidosToApprove) {
        await aprovarComissaoMutation.mutateAsync(pedido);
      }
    },
    onSuccess: () => {
      toast.success("Comissões aprovadas com sucesso!");
      setSelectedPedidos(new Set());
      queryClient.invalidateQueries({ queryKey: ["shopify-pedidos-cg"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao aprovar comissões", { description: err.message });
    },
  });

  const filteredByDate = useMemo(() => {
    const now = new Date();

    return enrichedPedidos.filter((pedido) => {
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
  }, [enrichedPedidos, dateFilter, customDateRange]);

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

  // Determine which orders are approvable (paid + has vendedor + not yet approved)
  const approvablePedidos = useMemo(() => {
    return filteredPedidos.filter(
      (p) =>
        isPaidStatus(p.status_pagamento) &&
        p.vendedor_id &&
        !p.comissao_aprovada
    );
  }, [filteredPedidos]);

  const allApprovableSelected = approvablePedidos.length > 0 && 
    approvablePedidos.every((p) => selectedPedidos.has(p.id));

  const toggleSelectAll = () => {
    if (allApprovableSelected) {
      setSelectedPedidos(new Set());
    } else {
      setSelectedPedidos(new Set(approvablePedidos.map((p) => p.id)));
    }
  };

  const toggleSelectPedido = (pedidoId: string) => {
    const newSet = new Set(selectedPedidos);
    if (newSet.has(pedidoId)) {
      newSet.delete(pedidoId);
    } else {
      newSet.add(pedidoId);
    }
    setSelectedPedidos(newSet);
  };

  const handleAprovarSelecionadas = () => {
    if (selectedPedidos.size === 0) return;
    const pedidosToApprove = approvablePedidos.filter(p => selectedPedidos.has(p.id));
    aprovarSelecionadasMutation.mutate(pedidosToApprove);
  };

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

  const isApprovable = (pedido: ShopifyPedidoCG) => {
    return isPaidStatus(pedido.status_pagamento) && pedido.vendedor_id && !pedido.comissao_aprovada;
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

      {/* Batch selection bar for admin */}
      {isAdmin && filteredPedidos.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allApprovableSelected}
              onCheckedChange={toggleSelectAll}
              disabled={approvablePedidos.length === 0}
            />
            <span className="text-sm font-medium">
              {approvablePedidos.length === 0
                ? "Todas aprovadas"
                : allApprovableSelected
                  ? `${approvablePedidos.length} selecionado(s)`
                  : "Selecionar todas pendentes"}
            </span>
          </div>
          {selectedPedidos.size > 0 && (
            <Button
              size="sm"
              onClick={handleAprovarSelecionadas}
              disabled={aprovarSelecionadasMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Aprovar Selecionadas ({selectedPedidos.size})
            </Button>
          )}
        </div>
      )}

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead className="w-12"></TableHead>}
                  <TableHead>Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Rastreio</TableHead>
                  {isAdmin && <TableHead className="w-24">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {isAdmin && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      {isAdmin && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
                    </TableRow>
                  ))
                ) : filteredPedidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 10 : 8} className="text-center py-8 text-muted-foreground">
                      Nenhum pedido encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPedidos.map((pedido) => {
                    const canApprove = isApprovable(pedido);
                    
                    return (
                      <TableRow 
                        key={pedido.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedPedido(pedido);
                          setDialogOpen(true);
                        }}
                      >
                        {isAdmin && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {canApprove && (
                              <Checkbox
                                checked={selectedPedidos.has(pedido.id)}
                                onCheckedChange={() => toggleSelectPedido(pedido.id)}
                              />
                            )}
                          </TableCell>
                        )}
                        <TableCell className="font-medium">{pedido.order_number}</TableCell>
                        <TableCell>{formatDate(getPedidoDate(pedido))}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{pedido.customer_name || "-"}</div>
                            <div className="text-sm text-muted-foreground">{pedido.customer_email || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {pedido.vendedor?.nome || (
                            <span className="text-muted-foreground text-sm">Sem vendedor</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {pedido.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell>{getStatusBadge(pedido.status_pagamento)}</TableCell>
                        <TableCell>
                          {pedido.comissao_aprovada ? (
                            <Badge className="bg-green-500">Aprovada</Badge>
                          ) : pedido.vendedor_id ? (
                            <Badge variant="outline">Pendente</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
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
                        {isAdmin && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedPedido(pedido);
                                  setDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canApprove && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => aprovarComissaoMutation.mutate(pedido)}
                                  disabled={aprovarComissaoMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
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
