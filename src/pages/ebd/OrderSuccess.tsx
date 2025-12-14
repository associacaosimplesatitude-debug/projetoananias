import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Package, MapPin, Calendar, CreditCard } from 'lucide-react';

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pedidoId = searchParams.get('pedido');
  const isFaturamento = searchParams.get('faturamento') === 'true';

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido-details', pedidoId],
    queryFn: async () => {
      if (!pedidoId) throw new Error('ID do pedido não fornecido');

      const { data: pedidoData, error: pedidoError } = await supabase
        .from('ebd_pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single();

      if (pedidoError) throw pedidoError;

      const { data: itensData, error: itensError } = await supabase
        .from('ebd_pedidos_itens')
        .select(`
          *,
          ebd_revistas (
            id,
            titulo,
            imagem_url
          )
        `)
        .eq('pedido_id', pedidoId);

      if (itensError) throw itensError;

      return {
        pedido: pedidoData,
        itens: itensData,
      };
    },
    enabled: !!pedidoId,
  });

  useEffect(() => {
    if (!pedidoId) {
      navigate('/ebd/catalogo');
    }
  }, [pedidoId, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando detalhes do pedido...</p>
        </div>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Pedido não encontrado</p>
            <Button onClick={() => navigate('/ebd/catalogo')}>
              Voltar ao Catálogo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Aguardando Pagamento', variant: 'secondary' },
      PAGO: { label: 'Pago', variant: 'default' },
      CANCELADO: { label: 'Cancelado', variant: 'destructive' },
      AGUARDANDO_FATURAMENTO: { label: 'Aguardando Faturamento', variant: 'secondary' },
      FATURAMENTO_ENVIADO: { label: 'Enviado para Faturamento', variant: 'default' },
    };

    const statusInfo = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getStatusLogisticoBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      AGUARDANDO_ENVIO: { label: 'Aguardando Envio', variant: 'secondary' },
      ENVIADO: { label: 'Enviado', variant: 'default' },
      ENTREGUE: { label: 'Entregue', variant: 'default' },
    };

    const statusInfo = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${isFaturamento ? 'bg-blue-100 dark:bg-blue-900/20' : 'bg-green-100 dark:bg-green-900/20'}`}>
            <CheckCircle className={`w-8 h-8 ${isFaturamento ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`} />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {isFaturamento ? 'Pedido Enviado para Faturamento!' : 'Pedido Realizado com Sucesso!'}
          </h1>
          <p className="text-muted-foreground">
            {isFaturamento 
              ? 'Seu pedido foi enviado para faturamento. Em breve, você receberá os boletos por e-mail.'
              : 'Seu pedido foi recebido e está sendo processado.'}
          </p>
        </div>

        {/* Order Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Detalhes do Pedido</CardTitle>
              <div className="text-sm text-muted-foreground">
                #{pedido.pedido.id.slice(0, 8)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Section */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium mb-1">Status do Pagamento</p>
                  {getStatusBadge(pedido.pedido.status)}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium mb-1">Status da Entrega</p>
                  {getStatusLogisticoBadge(pedido.pedido.status_logistico)}
                </div>
              </div>
            </div>

            <Separator />

            {/* Items List */}
            <div>
              <h3 className="font-semibold mb-4">Itens do Pedido</h3>
              <div className="space-y-3">
                {pedido.itens.map((item: any) => (
                  <div key={item.id} className="flex gap-4">
                    {item.ebd_revistas?.imagem_url && (
                      <img
                        src={item.ebd_revistas.imagem_url}
                        alt={item.ebd_revistas.titulo}
                        className="w-16 h-20 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{item.ebd_revistas?.titulo}</p>
                      <p className="text-sm text-muted-foreground">
                        Quantidade: {item.quantidade} × R$ {item.preco_unitario.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R$ {item.preco_total.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Price Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>R$ {pedido.pedido.valor_produtos.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Frete:</span>
                <span>R$ {pedido.pedido.valor_frete.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span className="text-primary">R$ {pedido.pedido.valor_total.toFixed(2)}</span>
              </div>
            </div>

            <Separator />

            {/* Delivery Address */}
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium mb-2">Endereço de Entrega</p>
                <p className="text-sm text-muted-foreground">
                  {pedido.pedido.endereco_rua}, {pedido.pedido.endereco_numero}
                  {pedido.pedido.endereco_complemento && ` - ${pedido.pedido.endereco_complemento}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {pedido.pedido.endereco_bairro} - {pedido.pedido.endereco_cidade}/{pedido.pedido.endereco_estado}
                </p>
                <p className="text-sm text-muted-foreground">
                  CEP: {pedido.pedido.endereco_cep}
                </p>
              </div>
            </div>

            {/* Order Date */}
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium mb-1">Data do Pedido</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(pedido.pedido.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="w-5 h-5" />
                Próximos Passos
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                {(pedido.pedido.status === 'AGUARDANDO_FATURAMENTO' || pedido.pedido.status === 'FATURAMENTO_ENVIADO') && (
                  <>
                    <p>• Seu pedido foi enviado para faturamento.</p>
                    <p>• Você receberá os boletos por e-mail em breve.</p>
                    <p>• O pedido será processado após confirmação do pagamento.</p>
                  </>
                )}
                {pedido.pedido.status === 'pending' && !isFaturamento && (
                  <p>• Aguardando confirmação do pagamento. Isso pode levar alguns minutos.</p>
                )}
                {pedido.pedido.status === 'PAGO' && pedido.pedido.status_logistico === 'AGUARDANDO_ENVIO' && (
                  <>
                    <p>• Seu pagamento foi confirmado! ✓</p>
                    <p>• As revistas estão sendo preparadas para envio.</p>
                    <p>• Você receberá uma notificação quando o pedido for enviado.</p>
                  </>
                )}
                {pedido.pedido.status_logistico === 'ENVIADO' && (
                  <p>• Seu pedido foi enviado e está a caminho!</p>
                )}
                {pedido.pedido.status_logistico === 'ENTREGUE' && (
                  <p>• Seu pedido foi entregue. Aproveite suas revistas!</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={() => navigate('/ebd/my-orders')}
            className="flex-1"
            variant="default"
          >
            Ver Meus Pedidos
          </Button>
          <Button
            onClick={() => navigate('/ebd/catalogo')}
            variant="outline"
            className="flex-1"
          >
            Continuar Comprando
          </Button>
        </div>
      </div>
    </div>
  );
}