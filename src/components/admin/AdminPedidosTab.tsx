import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, ShoppingCart, ExternalLink, Pencil, Trash2, CheckCircle, FileText, Search, Check, Loader2, CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";

interface PropostaFaturada {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  vendedor_id: string;
  itens: any;
  valor_total: number;
  desconto_percentual: number;
  status: string;
  created_at: string;
  updated_at: string;
  vendedor?: { nome: string } | null;
}

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
  vendedor?: { nome: string } | null;
  comissao_aprovada?: boolean | null;
}

interface AdminPedidosTabProps {
  vendedores?: { id: string; nome: string }[];
  hideStats?: boolean;
}

const getShopifyStatusBadge = (status: string) => {
  switch (status) {
    case 'Pago':
      return <Badge className="bg-green-500 hover:bg-green-600">Pago</Badge>;
    case 'Reembolsado':
      return <Badge variant="destructive">Reembolsado</Badge>;
    case 'Parcialmente Reembolsado':
      return <Badge className="bg-orange-500 hover:bg-orange-600">Parcial</Badge>;
    case 'Cancelado':
      return <Badge variant="destructive">Cancelado</Badge>;
    case 'Pendente':
      return <Badge variant="secondary">Pendente</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

// Função para calcular os dias das parcelas baseado no prazo (para pedidos online: 30 dias)
const calcularDiasParcelas = (prazo: string = "30"): number[] => {
  switch (prazo) {
    case '30': return [30];
    case '60': return [30, 60];
    case '60_direto': return [60];
    case '90': return [30, 60, 90];
    case '90_direto': return [90];
    default: return [30];
  }
};

export function AdminPedidosTab({ vendedores = [], hideStats = false }: AdminPedidosTabProps) {
  const { toast } = useToast();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendedorFilter, setSelectedVendedorFilter] = useState<string>("all");
  const [selectedPedidos, setSelectedPedidos] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  
  // Dialog states for Shopify orders
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<ShopifyPedido | null>(null);
  const [editForm, setEditForm] = useState({
    status_pagamento: '',
    codigo_rastreio: '',
    url_rastreio: '',
    valor_total: 0,
    valor_para_meta: 0,
    vendedor_id: '',
  });

  // Dialog states for Propostas Faturadas
  const [editPropostaDialogOpen, setEditPropostaDialogOpen] = useState(false);
  const [deletePropostaDialogOpen, setDeletePropostaDialogOpen] = useState(false);
  const [selectedProposta, setSelectedProposta] = useState<PropostaFaturada | null>(null);
  const [editPropostaForm, setEditPropostaForm] = useState({
    valor_total: 0,
    vendedor_id: '',
  });

  // Fetch all ebd_clientes with vendedor info
  const { data: clientes = [] } = useQuery({
    queryKey: ["admin-ebd-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, vendedor_id");
      if (error) throw error;
      return data;
    },
  });

  const clienteMap = useMemo(() => 
    Object.fromEntries(clientes.map(c => [c.id, { nome: c.nome_igreja, vendedor_id: c.vendedor_id }])),
    [clientes]
  );

  // Fetch all Shopify orders with vendedor info
  const { data: shopifyPedidos = [], isLoading } = useQuery({
    queryKey: ["admin-all-shopify-pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select("*, vendedor:vendedores(nome)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      console.log("Shopify pedidos com vendedor:", data);
      return (data || []) as ShopifyPedido[];
    },
  });

  // Fetch propostas faturadas (B2B orders approved by financial)
  const { data: propostasFaturadas = [], isLoading: isLoadingFaturadas } = useQuery({
    queryKey: ["admin-propostas-faturadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_propostas")
        .select("*, vendedor:vendedores(nome)")
        .in("status", ["FATURADO", "APROVADA_FATURAMENTO"])
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as PropostaFaturada[];
    },
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // Update mutation
  const updatePedidoMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<ShopifyPedido> }) => {
      const { error } = await supabase
        .from("ebd_shopify_pedidos")
        .update(data.updates)
        .eq("id", data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-shopify-pedidos"] });
      toast({ title: "Pedido atualizado com sucesso!" });
      setEditDialogOpen(false);
      setSelectedPedido(null);
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar pedido", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deletePedidoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ebd_shopify_pedidos")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-shopify-pedidos"] });
      toast({ title: "Pedido excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setSelectedPedido(null);
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir pedido", description: error.message, variant: "destructive" });
    },
  });

  // Update mutation for Propostas
  const updatePropostaMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<PropostaFaturada> }) => {
      const { error } = await supabase
        .from("vendedor_propostas")
        .update(data.updates)
        .eq("id", data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-propostas-faturadas"] });
      toast({ title: "Proposta atualizada com sucesso!" });
      setEditPropostaDialogOpen(false);
      setSelectedProposta(null);
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar proposta", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation for Propostas
  const deletePropostaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vendedor_propostas")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-propostas-faturadas"] });
      toast({ title: "Proposta excluída com sucesso!" });
      setDeletePropostaDialogOpen(false);
      setSelectedProposta(null);
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir proposta", description: error.message, variant: "destructive" });
    },
  });

  // Handlers for Shopify orders
  const handleEditPedido = (pedido: ShopifyPedido) => {
    setSelectedPedido(pedido);
    setEditForm({
      status_pagamento: pedido.status_pagamento,
      codigo_rastreio: pedido.codigo_rastreio || '',
      url_rastreio: pedido.url_rastreio || '',
      valor_total: pedido.valor_total,
      valor_para_meta: pedido.valor_para_meta,
      vendedor_id: pedido.vendedor_id || '',
    });
    setEditDialogOpen(true);
  };

  const handleDeletePedido = (pedido: ShopifyPedido) => {
    setSelectedPedido(pedido);
    setDeleteDialogOpen(true);
  };

  const handleSavePedido = () => {
    if (!selectedPedido) return;
    updatePedidoMutation.mutate({
      id: selectedPedido.id,
      updates: {
        status_pagamento: editForm.status_pagamento,
        codigo_rastreio: editForm.codigo_rastreio || null,
        url_rastreio: editForm.url_rastreio || null,
        valor_total: editForm.valor_total,
        valor_para_meta: editForm.valor_para_meta,
        vendedor_id: editForm.vendedor_id || null,
      },
    });
  };

  const confirmDeletePedido = () => {
    if (!selectedPedido) return;
    deletePedidoMutation.mutate(selectedPedido.id);
  };

  // Handlers for Propostas Faturadas
  const handleEditProposta = (proposta: PropostaFaturada) => {
    setSelectedProposta(proposta);
    setEditPropostaForm({
      valor_total: proposta.valor_total,
      vendedor_id: proposta.vendedor_id || '',
    });
    setEditPropostaDialogOpen(true);
  };

  const handleDeleteProposta = (proposta: PropostaFaturada) => {
    setSelectedProposta(proposta);
    setDeletePropostaDialogOpen(true);
  };

  const handleSaveProposta = () => {
    if (!selectedProposta) return;
    updatePropostaMutation.mutate({
      id: selectedProposta.id,
      updates: {
        valor_total: editPropostaForm.valor_total,
        vendedor_id: editPropostaForm.vendedor_id || null,
      },
    });
  };

  const confirmDeleteProposta = () => {
    if (!selectedProposta) return;
    deletePropostaMutation.mutate(selectedProposta.id);
  };

  // Toggle seleção individual de pedido
  const togglePedidoSelection = (id: string) => {
    setSelectedPedidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Mutation para aprovar comissão de pedido Shopify
  const aprovarComissaoShopifyMutation = useMutation({
    mutationFn: async (pedido: ShopifyPedido) => {
      if (!pedido.vendedor_id) {
        throw new Error('Pedido não tem vendedor atribuído');
      }

      // Buscar percentual do vendedor
      const { data: vendedor, error: vendedorError } = await supabase
        .from('vendedores')
        .select('comissao_percentual')
        .eq('id', pedido.vendedor_id)
        .single();

      if (vendedorError) throw vendedorError;

      // Pedidos online: parcela única em 30 dias
      const diasParcelas = calcularDiasParcelas("30");
      const dataBase = new Date(pedido.created_at);
      const valorParcela = pedido.valor_para_meta;
      const comissaoPercentual = vendedor?.comissao_percentual || 5;
      
      // Gerar parcela
      const parcela = {
        shopify_pedido_id: pedido.id,
        vendedor_id: pedido.vendedor_id,
        cliente_id: pedido.cliente_id,
        origem: 'online',
        status: 'aguardando',
        numero_parcela: 1,
        total_parcelas: 1,
        valor: valorParcela,
        valor_comissao: valorParcela * (comissaoPercentual / 100),
        data_vencimento: format(addDays(dataBase, 30), 'yyyy-MM-dd'),
        comissao_status: 'agendada' // Online fica agendada até dia 5
      };

      const { error: insertError } = await supabase
        .from('vendedor_propostas_parcelas')
        .insert([parcela]);

      if (insertError) throw insertError;

      // Marcar pedido como comissão aprovada
      const { error: updateError } = await supabase
        .from('ebd_shopify_pedidos')
        .update({ comissao_aprovada: true })
        .eq('id', pedido.id);

      if (updateError) throw updateError;

      return pedido;
    },
  });

  // Mutation para aprovação em lote de pedidos Shopify
  const aprovarSelecionadasShopifyMutation = useMutation({
    mutationFn: async () => {
      const pedidosParaAprovar = filteredShopifyPedidos.filter(
        p => selectedPedidos.has(p.id) && !p.comissao_aprovada && p.status_pagamento === 'Pago' && p.vendedor_id
      );
      
      for (const pedido of pedidosParaAprovar) {
        await aprovarComissaoShopifyMutation.mutateAsync(pedido);
      }
      
      return pedidosParaAprovar.length;
    },
    onSuccess: (count) => {
      toast({ title: `${count} comissões aprovadas com sucesso!` });
      setSelectedPedidos(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-all-shopify-pedidos"] });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao aprovar comissões", 
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  });

  // Helper function to get date range based on filter
  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return { from: startOfDay(now), to: endOfDay(now) };
      case "week":
        return { from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfWeek(now, { weekStartsOn: 0 }) };
      case "month":
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case "custom":
        return customDateRange.from && customDateRange.to ? customDateRange : null;
      default:
        return null;
    }
  };

  // Filter Shopify orders
  const filteredShopifyPedidos = useMemo(() => {
    const dateRange = getDateRange();
    
    return shopifyPedidos.filter(pedido => {
      // Filter by vendedor
      if (selectedVendedorFilter !== "all") {
        if (selectedVendedorFilter === "ecommerce") {
          if (pedido.vendedor_id) return false;
        } else {
          if (pedido.vendedor_id !== selectedVendedorFilter) return false;
        }
      }
      
      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const customerName = pedido.customer_name?.toLowerCase() || '';
        const orderNumber = pedido.order_number?.toLowerCase() || '';
        const clienteName = clienteMap[pedido.cliente_id || '']?.nome?.toLowerCase() || '';
        
        if (!customerName.includes(term) && !orderNumber.includes(term) && !clienteName.includes(term)) {
          return false;
        }
      }
      
      // Filter by date
      if (dateRange && dateRange.from && dateRange.to) {
        const pedidoDate = new Date(pedido.created_at);
        if (!isWithinInterval(pedidoDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) {
          return false;
        }
      }
      
      return true;
    });
  }, [shopifyPedidos, selectedVendedorFilter, searchTerm, clienteMap, dateFilter, customDateRange]);

  // Pedidos que podem ser aprovados (pagos, com vendedor, não aprovados)
  const pedidosAprovaveis = useMemo(() => 
    filteredShopifyPedidos.filter(p => 
      p.status_pagamento === 'Pago' && 
      p.vendedor_id && 
      !p.comissao_aprovada
    ),
    [filteredShopifyPedidos]
  );

  // Selecionar/Deselecionar todos os aprovaveis
  const toggleSelectAllPedidos = () => {
    if (selectedPedidos.size === pedidosAprovaveis.length && pedidosAprovaveis.length > 0) {
      setSelectedPedidos(new Set());
    } else {
      setSelectedPedidos(new Set(pedidosAprovaveis.map(p => p.id)));
    }
  };

  // Stats - only Shopify orders now
  const stats = useMemo(() => {
    const total = shopifyPedidos.length;
    const pagos = shopifyPedidos.filter(p => p.status_pagamento === 'Pago').length;
    const reembolsados = shopifyPedidos.filter(p => p.status_pagamento === 'Reembolsado' || p.status_pagamento === 'Parcialmente Reembolsado').length;
    const pendentes = shopifyPedidos.filter(p => p.status_pagamento === 'Pendente').length;
    
    const valorTotal = shopifyPedidos
      .filter(p => p.status_pagamento === 'Pago')
      .reduce((acc, p) => acc + p.valor_para_meta, 0);

    return { total, pagos, reembolsados, pendentes, valorTotal };
  }, [shopifyPedidos]);

  // Helper to calculate valor para meta for propostas
  const calcularValorParaMetaProposta = (proposta: PropostaFaturada) => {
    return proposta.valor_total * (1 - (proposta.desconto_percentual || 0) / 100);
  };

  if (isLoading || isLoadingFaturadas) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards - Hidden for gerente */}
      {!hideStats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-sm text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-yellow-500">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-600">{stats.pendentes}</div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{stats.pagos}</div>
                <p className="text-sm text-muted-foreground">Pagos</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{stats.reembolsados}</div>
                <p className="text-sm text-muted-foreground">Reembolsados</p>
              </CardContent>
            </Card>
          </div>

          {/* Total Revenue */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento Total (Pagos)</p>
                  <div className="text-3xl font-bold text-green-600">
                    R$ {stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <ShoppingCart className="h-10 w-10 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Pedidos
          </CardTitle>
          <CardDescription>
            Pedidos sincronizados automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou nº pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-[200px]">
              <Select
                value={selectedVendedorFilter}
                onValueChange={setSelectedVendedorFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  <SelectItem value="ecommerce">E-commerce (sem vendedor)</SelectItem>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Filtro de Data */}
            <div className="w-[180px]">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mês</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Picker para período personalizado */}
            {dateFilter === "custom" && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[130px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateRange.from ? format(customDateRange.from, "dd/MM/yyyy") : "De"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDateRange.from}
                      onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">até</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[130px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateRange.to ? format(customDateRange.to, "dd/MM/yyyy") : "Até"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDateRange.to}
                      onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Header com seleção em lote - apenas para admin */}
          {isAdmin && pedidosAprovaveis.length > 0 && (
            <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedPedidos.size > 0 && selectedPedidos.size === pedidosAprovaveis.length}
                  onCheckedChange={toggleSelectAllPedidos}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedPedidos.size > 0 
                    ? `${selectedPedidos.size} selecionado(s)` 
                    : `${pedidosAprovaveis.length} pedido(s) aguardando aprovação de comissão`}
                </span>
              </div>
              
              {selectedPedidos.size > 0 && (
                <Button 
                  onClick={() => aprovarSelecionadasShopifyMutation.mutate()}
                  disabled={aprovarSelecionadasShopifyMutation.isPending}
                  size="sm"
                >
                  {aprovarSelecionadasShopifyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Aprovar Selecionados ({selectedPedidos.size})
                </Button>
              )}
            </div>
          )}

          {filteredShopifyPedidos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>{searchTerm || selectedVendedorFilter !== "all" ? "Nenhum pedido encontrado com os filtros aplicados" : "Nenhum pedido encontrado"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                  <TableHead>Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Para Meta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Rastreio</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShopifyPedidos.map((pedido) => {
                  const vendedorNome = pedido.vendedor?.nome || (pedido.vendedor_id ? vendedores.find(v => v.id === pedido.vendedor_id)?.nome : null);
                  const podeAprovar = pedido.status_pagamento === 'Pago' && pedido.vendedor_id && !pedido.comissao_aprovada;
                  
                  return (
                    <TableRow key={pedido.id} className={selectedPedidos.has(pedido.id) ? "bg-primary/5" : ""}>
                      {/* Checkbox para admin */}
                      {isAdmin && (
                        <TableCell>
                          {podeAprovar && (
                            <Checkbox
                              checked={selectedPedidos.has(pedido.id)}
                              onCheckedChange={() => togglePedidoSelection(pedido.id)}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {pedido.order_number}
                      </TableCell>
                      <TableCell>
                        {pedido.created_at 
                          ? format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {pedido.customer_name || clienteMap[pedido.cliente_id || '']?.nome || 'N/A'}
                      </TableCell>
                      <TableCell>
                        R$ {pedido.valor_total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        R$ {pedido.valor_para_meta.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getShopifyStatusBadge(pedido.status_pagamento)}
                          {pedido.comissao_aprovada && (
                            <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Comissão Aprovada
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {vendedorNome || 'E-commerce'}
                      </TableCell>
                      <TableCell>
                        {pedido.codigo_rastreio ? (
                          pedido.url_rastreio ? (
                            <a 
                              href={pedido.url_rastreio} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {pedido.codigo_rastreio}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span>{pedido.codigo_rastreio}</span>
                          )
                        ) : (
                          <Badge variant="secondary">Aguardando</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* Botão aprovar individual - apenas para admin */}
                          {isAdmin && podeAprovar && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                aprovarComissaoShopifyMutation.mutate(pedido, {
                                  onSuccess: () => {
                                    toast({ title: "Comissão aprovada!" });
                                    queryClient.invalidateQueries({ queryKey: ["admin-all-shopify-pedidos"] });
                                  }
                                });
                              }}
                              disabled={aprovarComissaoShopifyMutation.isPending}
                              title="Aprovar Comissão"
                            >
                              {aprovarComissaoShopifyMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditPedido(pedido)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeletePedido(pedido)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>



      {/* Propostas Faturadas (B2B Orders) Section */}
      {propostasFaturadas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Propostas Faturadas (B2B)
            </CardTitle>
            <CardDescription>
              Pedidos faturados aprovados pelo financeiro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Para Meta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propostasFaturadas.map((proposta) => {
                  const itens = Array.isArray(proposta.itens) ? proposta.itens : [];
                  return (
                    <TableRow key={proposta.id}>
                      <TableCell>
                        {proposta.created_at 
                          ? format(new Date(proposta.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {proposta.cliente_nome}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {itens.map((item: any, idx: number) => (
                          <span key={idx}>
                            {item.quantity}x {item.title}{idx < itens.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </TableCell>
                      <TableCell>
                        R$ {proposta.valor_total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        R$ {calcularValorParaMetaProposta(proposta).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-500 hover:bg-green-600">Faturado</Badge>
                      </TableCell>
                      <TableCell>
                        {proposta.vendedor?.nome || 'E-commerce'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditProposta(proposta)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteProposta(proposta)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Pedido {selectedPedido?.order_number}</DialogTitle>
            <DialogDescription>
              Atualize as informações do pedido abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Status de Pagamento</Label>
              <Select
                value={editForm.status_pagamento}
                onValueChange={(value) => setEditForm({ ...editForm, status_pagamento: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Reembolsado">Reembolsado</SelectItem>
                  <SelectItem value="Parcialmente Reembolsado">Parcialmente Reembolsado</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valor Total (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.valor_total}
                  onChange={(e) => setEditForm({ ...editForm, valor_total: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Valor para Meta (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.valor_para_meta}
                  onChange={(e) => setEditForm({ ...editForm, valor_para_meta: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Vendedor</Label>
              <Select
                value={editForm.vendedor_id || "__none__"}
                onValueChange={(value) => setEditForm({ ...editForm, vendedor_id: value === "__none__" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Código de Rastreio</Label>
              <Input
                value={editForm.codigo_rastreio}
                onChange={(e) => setEditForm({ ...editForm, codigo_rastreio: e.target.value })}
                placeholder="Ex: BR123456789BR"
              />
            </div>
            <div className="grid gap-2">
              <Label>URL de Rastreio</Label>
              <Input
                value={editForm.url_rastreio}
                onChange={(e) => setEditForm({ ...editForm, url_rastreio: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePedido} disabled={updatePedidoMutation.isPending}>
              {updatePedidoMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pedido <strong>{selectedPedido?.order_number}</strong>? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePedido}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePedidoMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Proposta Dialog */}
      <Dialog open={editPropostaDialogOpen} onOpenChange={setEditPropostaDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar Proposta Faturada</DialogTitle>
            <DialogDescription>
              Atualize as informações da proposta de {selectedProposta?.cliente_nome}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Valor Total (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={editPropostaForm.valor_total}
                onChange={(e) => setEditPropostaForm({ ...editPropostaForm, valor_total: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Vendedor</Label>
              <Select
                value={editPropostaForm.vendedor_id || "__none__"}
                onValueChange={(value) => setEditPropostaForm({ ...editPropostaForm, vendedor_id: value === "__none__" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPropostaDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProposta} disabled={updatePropostaMutation.isPending}>
              {updatePropostaMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Proposta Confirmation Dialog */}
      <AlertDialog open={deletePropostaDialogOpen} onOpenChange={setDeletePropostaDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a proposta faturada de <strong>{selectedProposta?.cliente_nome}</strong>? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProposta}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePropostaMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}