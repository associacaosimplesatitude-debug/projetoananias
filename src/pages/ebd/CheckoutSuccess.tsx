import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, XCircle, ArrowRight, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const status = searchParams.get('status');

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['ebd-pedido', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      
      const { data, error } = await supabase
        .from('ebd_pedidos')
        .select(`
          *,
          ebd_pedidos_itens (
            quantidade,
            preco_unitario,
            ebd_revistas (
              titulo,
              imagem_url
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
    refetchInterval: (query) => {
      // Continuar verificando se ainda está pending
      return query.state.data?.status === 'pending' ? 3000 : false;
    },
  });

  useEffect(() => {
    // Limpar carrinho quando o pagamento for aprovado
    if (pedido?.status === 'approved') {
      localStorage.removeItem('ebd-cart');
    }
  }, [pedido?.status]);

  if (!orderId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Pedido não encontrado
            </p>
            <Button onClick={() => navigate('/ebd/catalogo')} className="mt-4 w-full">
              Voltar ao Catálogo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusInfo = () => {
    switch (pedido?.status) {
      case 'approved':
        return {
          icon: CheckCircle2,
          title: 'Pagamento Aprovado! 🎉',
          description: 'Seu pedido foi confirmado e as revistas já estão disponíveis para uso.',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
        };
      case 'pending':
      case 'processing':
        return {
          icon: Clock,
          title: 'Aguardando Confirmação do Pagamento',
          description: 'Seu pedido está sendo processado. Você receberá uma confirmação em breve.',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
        };
      case 'rejected':
      case 'cancelled':
        return {
          icon: XCircle,
          title: 'Pagamento Não Aprovado',
          description: 'Não foi possível processar seu pagamento. Tente novamente.',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
        };
      default:
        return {
          icon: Clock,
          title: 'Processando Pedido',
          description: 'Aguarde enquanto processamos seu pedido.',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <StatusIcon className={`h-8 w-8 ${statusInfo.color}`} />
            {statusInfo.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={`p-4 rounded-lg ${statusInfo.bgColor}`}>
            <p className={statusInfo.color}>{statusInfo.description}</p>
          </div>

          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Resumo do Pedido
            </h3>
            <div className="space-y-3">
              {pedido?.ebd_pedidos_itens?.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    {item.ebd_revistas?.imagem_url && (
                      <img
                        src={item.ebd_revistas.imagem_url}
                        alt={item.ebd_revistas.titulo}
                        className="w-12 h-16 object-cover rounded"
                      />
                    )}
                    <div>
                      <p className="font-medium">{item.ebd_revistas?.titulo}</p>
                      <p className="text-sm text-muted-foreground">
                        Quantidade: {item.quantidade}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold">
                    R$ {(item.preco_unitario * item.quantidade).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>R$ {pedido?.valor_produtos?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Frete:</span>
              <span>R$ {pedido?.valor_frete?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>R$ {pedido?.valor_total?.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-3">
            {pedido?.status === 'approved' && (
              <Button
                onClick={() => navigate('/ebd/planejamento')}
                className="w-full"
                size="lg"
              >
                Ir para o Planejamento
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
            
            <Button
              onClick={() => navigate('/ebd/pedidos')}
              variant="outline"
              className="w-full"
            >
              Ver Meus Pedidos
            </Button>

            <Button
              onClick={() => navigate('/ebd/catalogo')}
              variant="ghost"
              className="w-full"
            >
              Voltar ao Catálogo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}