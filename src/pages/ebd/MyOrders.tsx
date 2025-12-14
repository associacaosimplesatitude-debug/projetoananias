import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Calendar, DollarSign, Search, Truck, CreditCard, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

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
}

export default function MyOrders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [logisticStatusFilter, setLogisticStatusFilter] = useState<string>('all');

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
  const { data: shopifyOrders, isLoading: isLoadingShopify } = useQuery({
    queryKey: ['my-shopify-orders'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar o cliente EBD vinculado ao usuário
      const { data: clienteData } = await supabase
        .from('ebd_clientes')
        .select('id')
        .eq('superintendente_user_id', user.id)
        .maybeSingle();

      if (!clienteData) return [];

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
      'Pago': { label: 'Pago', variant: 'default' },
      'Pendente': { label: 'Pendente', variant: 'secondary' },
      'Reembolsado': { label: 'Reembolsado', variant: 'destructive' },
      'Parcialmente Reembolsado': { label: 'Parc. Reembolsado', variant: 'outline' },
      'Cancelado': { label: 'Cancelado', variant: 'destructive' },
    };
    const config = variants[status || 'Pendente'] || variants.Pendente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
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
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número do pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
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
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1">
                            <CreditCard className="w-4 h-4" />
                            {getShopifyPaymentStatusBadge(order.status_pagamento)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Código de Rastreio */}
                        {order.codigo_rastreio && (
                          <>
                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">Código de Rastreio:</span>
                              </div>
                              {order.url_rastreio ? (
                                <a 
                                  href={order.url_rastreio} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  <Badge variant="outline" className="font-mono text-sm">
                                    {order.codigo_rastreio}
                                  </Badge>
                                </a>
                              ) : (
                                <Badge variant="outline" className="font-mono text-sm">
                                  {order.codigo_rastreio}
                                </Badge>
                              )}
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
                          ? 'Nenhum pedido corresponde aos filtros selecionados.'
                          : 'Você ainda não realizou nenhuma compra de revistas.'}
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
                            Pedido #{order.id.slice(0, 8).toUpperCase()}
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
                        {order.ebd_pedidos_itens.map((item: any, idx: number) => (
                          <div key={idx} className="flex gap-4">
                            {item.revista?.imagem_url && (
                              <img
                                src={item.revista.imagem_url}
                                alt={item.revista.titulo}
                                className="w-20 h-28 object-cover rounded-lg border"
                              />
                            )}
                            <div className="flex-1 space-y-2">
                              <div>
                                <h4 className="font-semibold text-base mb-1">
                                  {item.revista?.titulo}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {item.revista?.faixa_etaria_alvo}
                                </p>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Quantidade: {item.quantidade}x
                                </span>
                                <span className="font-medium">
                                  R$ {Number(item.preco_total).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        <Separator />
                        
                        {/* Código de Rastreio */}
                        {order.codigo_rastreio && (
                          <>
                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">Código de Rastreio:</span>
                              </div>
                              <Badge variant="outline" className="font-mono text-sm">
                                {order.codigo_rastreio}
                              </Badge>
                            </div>
                            <Separator />
                          </>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Valor Total:</span>
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
