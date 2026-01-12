import { useQuery } from '@tanstack/react-query';
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
import { useState } from 'react';
import { toast } from 'sonner';

// Interface para pedidos do Bling
interface BlingOrder {
  id: number;
  numero: string;
  data: string;
  situacao: {
    id: number;
    nome: string;
  };
  contato: {
    nome: string;
    email: string;
  };
  itens: Array<{
    codigo: string;
    descricao: string;
    quantidade: number;
    valor: number;
  }>;
  valor_total: number;
  valor_frete: number;
  transporte: {
    codigo_rastreio: string | null;
  } | null;
  nfe: {
    numero: string;
    chave: string;
    url: string;
  } | null;
}

export default function MyOrders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [logisticStatusFilter, setLogisticStatusFilter] = useState<string>('all');

  // Query para buscar email do superintendente
  const { data: clienteData } = useQuery({
    queryKey: ['my-cliente-data'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('ebd_clientes')
        .select('id, email_superintendente')
        .eq('superintendente_user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Query para pedidos do Bling (baseado no email do superintendente)
  const { data: blingOrders, isLoading: isLoadingBling, refetch: refetchBling, isFetching } = useQuery({
    queryKey: ['my-bling-orders', clienteData?.email_superintendente],
    queryFn: async () => {
      if (!clienteData?.email_superintendente) return [];

      const { data, error } = await supabase.functions.invoke('bling-list-my-orders', {
        body: { customer_email: clienteData.email_superintendente }
      });

      if (error) {
        console.error('Erro ao buscar pedidos do Bling:', error);
        throw error;
      }

      return (data?.orders || []) as BlingOrder[];
    },
    enabled: !!clienteData?.email_superintendente,
    staleTime: 60000, // 1 minuto
    refetchOnWindowFocus: false,
  });

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

  // Apply filters for Bling orders
  const filteredBlingOrders = blingOrders?.filter(order => {
    const matchesSearch = searchTerm === '' || 
      order.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.contato.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.itens.some(item => item.descricao.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  // Apply filters for internal orders
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

  const totalSpent = filteredOrders?.reduce((sum, order) => sum + Number(order.valor_total), 0) || 0;
  const totalSpentBling = filteredBlingOrders?.reduce((sum, order) => sum + Number(order.valor_total), 0) || 0;
  
  const getPaymentStatusBadge = (status: string | null) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'pending': { label: 'Pendente', variant: 'secondary' },
      'approved': { label: 'Aprovado', variant: 'default' },
      'rejected': { label: 'Rejeitado', variant: 'destructive' }
    };
    const config = variants[status || 'pending'] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getBlingStatusBadge = (situacao: { id: number; nome: string }) => {
    // 28: Em aberto, 31: Atendido, 34: Cancelado, 37: Em andamento
    const statusConfig: Record<number, { className: string }> = {
      28: { className: 'bg-gray-500 text-white' },
      31: { className: 'bg-green-600 text-white' },
      34: { className: 'bg-red-600 text-white' },
      37: { className: 'bg-yellow-500 text-white' },
    };

    const config = statusConfig[situacao.id] || { className: 'bg-gray-400 text-white' };
    
    return (
      <Badge className={config.className}>
        {situacao.nome}
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
    const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      toast.error('Não foi possível abrir a nota para impressão. Verifique o bloqueador de pop-ups.');
      return;
    }

    // Em alguns browsers, o evento "load" pode disparar múltiplas vezes em páginas externas.
    // Para evitar abrir/imprimir em loop, fazemos apenas um print com pequeno delay.
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // Se o browser bloquear o print cross-origin, o usuário ainda consegue imprimir manualmente.
      }
    }, 800);
  };

  const handleRefresh = () => {
    refetchBling();
    toast.info('Atualizando pedidos...');
  };

  if (isLoading || isLoadingBling) {
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
  const hasBlingOrders = (blingOrders?.length || 0) > 0;

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
              placeholder="Buscar por número do pedido ou produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <Tabs defaultValue="bling" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="bling" className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Meus Pedidos ({filteredBlingOrders?.length || 0})
            </TabsTrigger>
            {hasInternalOrders && (
              <TabsTrigger value="internal" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Pedidos Internos ({filteredOrders?.length || 0})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Bling Orders Tab */}
          <TabsContent value="bling">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-primary/10">
                      <ShoppingBag className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                      <p className="text-2xl font-bold">{filteredBlingOrders?.length || 0}</p>
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
                      <p className="text-2xl font-bold">R$ {totalSpentBling.toFixed(2)}</p>
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
                        {filteredBlingOrders && filteredBlingOrders.length > 0
                          ? format(new Date(filteredBlingOrders[0].data), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {isFetching && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-700 dark:text-blue-300">Buscando pedidos...</span>
              </div>
            )}

            <div className="space-y-4">
              {!filteredBlingOrders || filteredBlingOrders.length === 0 ? (
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
                      {clienteData?.email_superintendente && (
                        <p className="text-xs text-muted-foreground">
                          Buscando pedidos para: {clienteData.email_superintendente}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                filteredBlingOrders.map((order) => (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            Pedido #{order.numero}
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {format(
                                new Date(order.data),
                                "dd 'de' MMMM 'de' yyyy",
                                { locale: ptBR }
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                          <div className="flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            {getBlingStatusBadge(order.situacao)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Itens do pedido */}
                        <div className="space-y-2">
                          {order.itens.map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                              <div className="flex-1">
                                <span className="font-medium">{item.descricao}</span>
                                {item.codigo && (
                                  <span className="text-muted-foreground ml-2">({item.codigo})</span>
                                )}
                              </div>
                              <div className="text-right">
                                <span>{item.quantidade}x R$ {Number(item.valor).toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Separator />

                        {/* Código de Rastreio */}
                        {order.transporte?.codigo_rastreio && (
                          <>
                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">Código de Rastreio:</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-sm">
                                  {order.transporte.codigo_rastreio}
                                </Badge>
                                <a 
                                  href={`https://www.linkcorreios.com.br/?id=${order.transporte.codigo_rastreio}`}
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
                        {order.nfe?.numero && (
                          <>
                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">Nota Fiscal:</span>
                                <span className="text-sm">NF-e {order.nfe.numero}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {order.nfe.url && (
                                  <>
                                    <a 
                                      href={order.nfe.url}
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
                                      onClick={() => handlePrintNfe(order.nfe!.url)}
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
