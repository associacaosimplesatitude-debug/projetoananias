import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MyOrders() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: churchData } = await supabase
        .from('churches')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!churchData) throw new Error('Igreja não encontrada');

      const { data, error } = await supabase
        .from('ebd_revistas_compradas')
        .select(`
          *,
          revista:ebd_revistas(
            titulo,
            imagem_url,
            faixa_etaria_alvo
          )
        `)
        .eq('church_id', churchData.id)
        .order('data_compra', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const totalSpent = orders?.reduce((sum, order) => sum + Number(order.preco_pago), 0) || 0;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Meus Pedidos</h1>
          <p className="text-muted-foreground">
            Acompanhe o histórico de suas compras de revistas EBD
          </p>
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
                  <p className="text-2xl font-bold">{orders?.length || 0}</p>
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
                    {orders && orders.length > 0
                      ? format(new Date(orders[0].data_compra || orders[0].created_at), 'dd/MM/yyyy', { locale: ptBR })
                      : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {!orders || orders.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum pedido encontrado</h3>
                  <p className="text-muted-foreground mb-4">
                    Você ainda não realizou nenhuma compra de revistas.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
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
                            new Date(order.data_compra || order.created_at),
                            "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                            { locale: ptBR }
                          )}
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      Processado
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    {order.revista?.imagem_url && (
                      <img
                        src={order.revista.imagem_url}
                        alt={order.revista.titulo}
                        className="w-24 h-32 object-cover rounded-lg border"
                      />
                    )}
                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="font-semibold text-base mb-1">
                          {order.revista?.titulo}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {order.revista?.faixa_etaria_alvo}
                        </p>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Valor pago:</span>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                          R$ {Number(order.preco_pago).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
