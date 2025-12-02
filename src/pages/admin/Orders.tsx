import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function Orders() {
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_pedidos")
        .select(`
          *,
          ebd_pedidos_itens(
            quantidade,
            preco_unitario,
            preco_total,
            revista:ebd_revistas(titulo, imagem_url)
          ),
          church:churches(church_name, pastor_email, pastor_whatsapp)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const pendingOrders = orders?.filter(o => o.payment_status === 'pending' && o.status !== 'cancelled') || [];
  const paidOrders = orders?.filter(o => o.payment_status === 'approved') || [];
  const cancelledOrders = orders?.filter(o => o.status === 'cancelled') || [];

  const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.valor_total), 0);

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("ebd_pedidos")
        .update({ status: "cancelled" })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Pedido cancelado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao cancelar pedido: " + error.message);
    },
  });

  const renderOrdersTable = (ordersList: typeof orders, showCancelButton = true) => {
    if (!ordersList || ordersList.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum pedido encontrado
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Pedido</TableHead>
            <TableHead>Igreja</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead className="text-right">Valor Total</TableHead>
            {showCancelButton && <TableHead className="text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordersList.map((order) => (
            <TableRow key={order.id}>
              <TableCell>
                {order.created_at
                  ? format(new Date(order.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })
                  : "-"}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium">#{order.id.slice(0, 8).toUpperCase()}</div>
                  <div className="text-sm text-muted-foreground">
                    {order.ebd_pedidos_itens?.length || 0} item(s)
                  </div>
                </div>
              </TableCell>
              <TableCell>{order.church?.church_name || "-"}</TableCell>
              <TableCell>
                <div className="text-sm">
                  <div>{order.church?.pastor_email || "-"}</div>
                  <div className="text-muted-foreground">
                    {order.church?.pastor_whatsapp || "-"}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right font-semibold">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(Number(order.valor_total))}
              </TableCell>
              {showCancelButton && (
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar Pedido</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja cancelar este pedido? Esta ação é irreversível 
                          e o pedido será removido do painel do cliente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Não, manter pedido</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => cancelOrderMutation.mutate(order.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Sim, cancelar pedido
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Relatório de Pedidos</h1>
          <p className="text-muted-foreground mt-1">
            Visualize todos os pedidos de revistas realizados
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Aguardando pagamento
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pagos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidOrders.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Cancelados</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cancelledOrders.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cancelados pelo admin
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Pedidos</CardTitle>
          <CardDescription>Visualize e gerencie todos os pedidos por status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pending" className="gap-2">
                  <Clock className="w-4 h-4" />
                  Pendentes
                  <Badge variant="secondary">{pendingOrders.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="paid" className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Pagos
                  <Badge variant="secondary">{paidOrders.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="cancelled" className="gap-2">
                  <XCircle className="w-4 h-4" />
                  Cancelados
                  <Badge variant="secondary">{cancelledOrders.length}</Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="mt-4">
                {renderOrdersTable(pendingOrders)}
              </TabsContent>
              <TabsContent value="paid" className="mt-4">
                {renderOrdersTable(paidOrders, false)}
              </TabsContent>
              <TabsContent value="cancelled" className="mt-4">
                {renderOrdersTable(cancelledOrders, false)}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
