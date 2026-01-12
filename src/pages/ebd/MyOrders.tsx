import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Calendar, DollarSign, Search, Truck, CreditCard, ShoppingBag, FileText, RefreshCw, Printer, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface ShopifyPedido {
  id: string;
  order_number: string;
  status_pagamento: string;
  valor_total: number;
  valor_frete: number;
  customer_name: string | null;
  customer_email: string | null;
  codigo_rastreio: string | null;
  url_rastreio: string | null;
  created_at: string;
  // Campos Bling
  bling_order_id: number | null;
  bling_status: string | null;
  bling_status_id: number | null;
  nota_fiscal_numero: string | null;
  nota_fiscal_chave: string | null;
  nota_fiscal_url: string | null;
  codigo_rastreio_bling: string | null;
}

export default function MyOrders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [logisticStatusFilter, setLogisticStatusFilter] = useState<string>('all');
  const [clienteId, setClienteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Query para pedidos internos (ebd_pedidos via churches)
  const { data: orders, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: churchData } = await supabase
        .from('churches')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!churchData) return [];

      const { data, error } = await supabase
        .from('ebd_pedidos')
        .select(`
          *,
          ebd_pedidos_itens(
            quantidade,
            preco_unitario,
            preco_total,
            revista:ebd_revistas(
              titulo,
              imagem_url,
              faixa_etaria_alvo
            )
          )
        `)
        .eq('church_id', churchData.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Query para pedidos Shopify (ebd_shopify_pedidos via ebd_clientes)
  const { data: shopifyOrders, isLoading: isLoadingShopify, refetch: refetchShopify } = useQuery({
    queryKey: ['my-shopify-orders'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar o cliente EBD vinculado ao usuário
      const { data: clienteData } = await supabase
        .from('ebd_clientes')
        .select('id, email_superintendente')
        .eq('superintendente_user_id', user.id)
        .maybeSingle();

      if (!clienteData) return [];
      
      // Vincular pedidos órfãos via edge function (com service role)
      // Isso resolve casos onde o cliente comprou antes de ser cadastrado/ativado
      try {
        const { data: linkResult, error: linkError } = await supabase.functions.invoke('ebd-link-orphan-shopify-orders');
        if (linkError) {
          console.error('Erro ao vincular pedidos órfãos:', linkError);
        } else if (linkResult?.linked > 0) {
          console.log(`Vinculados ${linkResult.linked} pedido(s) órfão(s):`, linkResult.orders);
        }
      } catch (err) {
        console.error('Erro ao chamar função de vínculo:', err);
      }
      
      setClienteId(clienteData.id);

      const { data, error } = await supabase
        .from('ebd_shopify_pedidos')
        .select('*')
        .eq('cliente_id', clienteData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ShopifyPedido[];
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Mutation para sincronizar dados do Bling
  const syncBlingMutation = useMutation({
    mutationFn: async (clienteIdParam: string) => {
      const { data, error } = await supabase.functions.invoke('bling-sync-shopify-orders', {
        body: { cliente_id: clienteIdParam }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.synced > 0) {
        toast.success(`${data.synced} pedido(s) sincronizado(s) com o Bling`);
      }
      refetchShopify();
    },
    onError: (error) => {
      console.error('Erro ao sincronizar com Bling:', error);
      toast.error('Erro ao sincronizar dados do Bling');
    },
  });

  // Sincronizar automaticamente quando carregar os pedidos
  useEffect(() => {
    if (clienteId && shopifyOrders && shopifyOrders.length > 0) {
      syncBlingMutation.mutate(clienteId);
    }
  }, [clienteId]);

  // Apply filters
  const filteredOrders = orders?.filter(order => {
    const matchesSearch = searchTerm === '' || 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.ebd_pedidos_itens.some((item: any) => 
        item.revista?.titulo.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesPaymentStatus = paymentStatusFilter === 'all' || order.payment_status === paymentStatusFilter;
    const matchesLogisticStatus = logisticStatusFilter === 'all' || order.status_logistico === logisticStatusFilter;
    
    return matchesSearch && matchesPaymentStatus && matchesLogisticStatus;
  });

  // Apply filters for shopify orders
  const filteredShopifyOrders = shopifyOrders?.filter(order => {
    const matchesSearch = searchTerm === '' || 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalSpent = filteredOrders?.reduce((sum, order) => sum + Number(order.valor_total), 0) || 0;
  const totalSpentShopify = filteredShopifyOrders?.reduce((sum, order) => sum + Number(order.valor_total), 0) || 0;
  
  const getPaymentStatusBadge = (status: string | null) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'pending': { label: 'Pendente', variant: 'secondary' },
      'approved': { label: 'Aprovado', variant: 'default' },
      'rejected': { label: 'Rejeitado', variant: 'destructive' }
    };
    const config = variants[status || 'pending'] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getShopifyPaymentStatusBadge = (status: string | null) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      // Valores em inglês (Shopify API)
      'paid': { label: 'Pago', variant: 'default' },
      'pending': { label: 'Pendente', variant: 'secondary' },
      'refunded': { label: 'Reembolsado', variant: 'destructive' },
      'partially_refunded': { label: 'Parc. Reembolsado', variant: 'outline' },
      'voided': { label: 'Cancelado', variant: 'destructive' },
      'authorized': { label: 'Autorizado', variant: 'secondary' },
      // Valores em português (legado/manual)
      'Pago': { label: 'Pago', variant: 'default' },
      'Pendente': { label: 'Pendente', variant: 'secondary' },
      'Reembolsado': { label: 'Reembolsado', variant: 'destructive' },
      'Parcialmente Reembolsado': { label: 'Parc. Reembolsado', variant: 'outline' },
      'Cancelado': { label: 'Cancelado', variant: 'destructive' },
    };
    const config = variants[status || 'pending'] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getBlingStatusBadge = (statusId: number | null, statusText: string | null) => {
    // 28: Em aberto, 31: Atendido, 34: Cancelado, 37: Em andamento
    const statusConfig: Record<number, { className: string }> = {
      28: { className: 'bg-gray-500 text-white' }, // Em aberto
      31: { className: 'bg-green-600 text-white' }, // Atendido
      34: { className: 'bg-red-600 text-white' }, // Cancelado
      37: { className: 'bg-yellow-500 text-white' }, // Em andamento
    };

    const config = statusConfig[statusId || 0] || { className: 'bg-gray-400 text-white' };
    
    return (
      <Badge className={config.className}>
        {statusText || 'Processando'}
      </Badge>
    );
  };

  const getLogisticStatusBadge = (status: string | null) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'AGUARDANDO_ENVIO': { label: 'Aguardando Envio', variant: 'secondary' },
      'ENVIADO': { label: 'Enviado', variant: 'default' },
      'ENTREGUE': { label: 'Entregue', variant: 'outline' }
    };
    const config = variants[status || 'AGUARDANDO_ENVIO'] || variants.AGUARDANDO_ENVIO;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handlePrintNfe = (url: string) => {
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  };

  if (isLoading || isLoadingShopify) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const hasInternalOrders = (orders?.length || 0) > 0;
  const hasShopifyOrders = (shopifyOrders?.length || 0) > 0;

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Meus Pedidos</h1>
          <p className="text-muted-foreground">
            Acompanhe o histórico de suas compras de revistas EBD
          </p>
        </div>

        {/* Search */}
        <div className="mb-6 flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número do pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {clienteId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncBlingMutation.mutate(clienteId)}
              disabled={syncBlingMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncBlingMutation.isPending ? 'animate-spin' : ''}`} />
              Atualizar Status
            </Button>
          )}
        </div>

        <Tabs defaultValue={hasShopifyOrders ? "shopify" : "internal"} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="shopify" className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Pedidos Loja ({filteredShopifyOrders?.length || 0})
            </TabsTrigger>
            {hasInternalOrders && (
              <TabsTrigger value="internal" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Pedidos Internos ({filteredOrders?.length || 0})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Shopify Orders Tab */}
          <TabsContent value="shopify">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-primary/10">
                      <ShoppingBag className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                      <p className="text-2xl font-bold">{filteredShopifyOrders?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-green-500/10">
                      <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Total</p>
                      <p className="text-2xl font-bold">R$ {totalSpentShopify.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-blue-500/10">
                      <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Último Pedido</p>
                      <p className="text-sm font-medium">
                        {filteredShopifyOrders && filteredShopifyOrders.length > 0
                          ? format(new Date(filteredShopifyOrders[0].created_at), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {syncBlingMutation.isPending && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-700 dark:text-blue-300">Atualizando dados do Bling...</span>
              </div>
            )}

            <div className="space-y-4">
              {!filteredShopifyOrders || filteredShopifyOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Nenhum pedido encontrado</h3>
                      <p className="text-muted-foreground mb-4">
                        {searchTerm
                          ? 'Nenhum pedido corresponde à busca.'
                          : 'Você ainda não realizou nenhuma compra na loja online.'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                filteredShopifyOrders.map((order) => (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            Pedido {order.order_number}
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {format(
                                new Date(order.created_at),
                                "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                                { locale: ptBR }
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                          {order.bling_status_id && (
                            <div className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              {getBlingStatusBadge(order.bling_status_id, order.bling_status)}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <CreditCard className="w-4 h-4" />
                            {getShopifyPaymentStatusBadge(order.status_pagamento)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Código de Rastreio (priorizar Bling, depois Shopify) */}
                        {(order.codigo_rastreio_bling || order.codigo_rastreio) && (
                          <>
                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">Código de Rastreio:</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-sm">
                                  {order.codigo_rastreio_bling || order.codigo_rastreio}
                                </Badge>
                                <a 
                                  href={`https://www.linkcorreios.com.br/?id=${order.codigo_rastreio_bling || order.codigo_rastreio}`}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  <Button variant="outline" size="sm">
                                    <ExternalLink className="w-4 h-4 mr-1" />
                                    Rastrear
                                  </Button>
                                </a>
                              </div>
                            </div>
                            <Separator />
                          </>
                        )}

                        {/* Nota Fiscal */}
                        {order.nota_fiscal_numero && (
                          <>
                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">Nota Fiscal:</span>
                                <span className="text-sm">NF-e {order.nota_fiscal_numero}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {order.nota_fiscal_url && (
                                  <>
                                    <a 
                                      href={order.nota_fiscal_url}
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                    >
                                      <Button variant="outline" size="sm">
                                        <ExternalLink className="w-4 h-4 mr-1" />
                                        Ver NF-e
                                      </Button>
                                    </a>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => handlePrintNfe(order.nota_fiscal_url!)}
                                    >
                                      <Printer className="w-4 h-4 mr-1" />
                                      Imprimir
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            <Separator />
                          </>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm text-muted-foreground">Valor do Frete:</span>
                            <span className="ml-2 text-sm">R$ {Number(order.valor_frete).toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Valor Total:</span>
                            <span className="ml-2 text-lg font-bold text-green-600 dark:text-green-400">
                              R$ {Number(order.valor_total).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Internal Orders Tab */}
          <TabsContent value="internal">
            {/* Filters */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status do Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Pagamentos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="rejected">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={logisticStatusFilter} onValueChange={setLogisticStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status Logístico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="AGUARDANDO_ENVIO">Aguardando Envio</SelectItem>
                  <SelectItem value="ENVIADO">Enviado</SelectItem>
                  <SelectItem value="ENTREGUE">Entregue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                      <p className="text-2xl font-bold">{filteredOrders?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-green-500/10">
                      <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Total</p>
                      <p className="text-2xl font-bold">R$ {totalSpent.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-blue-500/10">
                      <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Último Pedido</p>
                      <p className="text-sm font-medium">
                        {filteredOrders && filteredOrders.length > 0
                          ? format(new Date(filteredOrders[0].created_at), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {!filteredOrders || filteredOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Nenhum pedido encontrado</h3>
                      <p className="text-muted-foreground mb-4">
                        {searchTerm || paymentStatusFilter !== 'all' || logisticStatusFilter !== 'all'
                          ? 'Nenhum pedido corresponde aos filtros aplicados.'
                          : 'Você ainda não realizou nenhum pedido.'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                filteredOrders.map((order) => (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            Pedido #{order.id.substring(0, 8)}
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {format(
                                new Date(order.created_at),
                                "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                                { locale: ptBR }
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1">
                            <CreditCard className="w-4 h-4" />
                            {getPaymentStatusBadge(order.payment_status)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Truck className="w-4 h-4" />
                            {getLogisticStatusBadge(order.status_logistico)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Items */}
                        <div className="space-y-3">
                          {order.ebd_pedidos_itens.map((item: any, index: number) => (
                            <div key={index} className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                {item.revista?.imagem_url && (
                                  <img
                                    src={item.revista.imagem_url}
                                    alt={item.revista.titulo}
                                    className="w-12 h-16 object-cover rounded"
                                  />
                                )}
                                <div>
                                  <p className="font-medium text-sm">{item.revista?.titulo || 'Revista'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.revista?.faixa_etaria_alvo || '-'}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">
                                  {item.quantidade}x R$ {Number(item.preco_unitario).toFixed(2)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  R$ {Number(item.preco_total).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Separator />

                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total do Pedido</span>
                          <span className="text-lg font-bold text-green-600 dark:text-green-400">
                            R$ {Number(order.valor_total).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
