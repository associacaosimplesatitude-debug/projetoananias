import { useQuery } from "@tanstack/react-query";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

export default function Orders() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_revistas_compradas")
        .select(`
          *,
          revista:ebd_revistas(titulo, imagem_url),
          church:churches(church_name, pastor_email, pastor_whatsapp)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.preco_pago), 0) || 0;

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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total de Pedidos</CardTitle>
            <CardDescription>Número total de compras realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{orders?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Receita Total</CardTitle>
            <CardDescription>Valor total arrecadado com vendas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(totalRevenue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
          <CardDescription>Histórico completo de compras</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : orders && orders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Revista</TableHead>
                  <TableHead>Igreja</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-right">Valor Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      {order.data_compra
                        ? format(new Date(order.data_compra), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {order.revista?.imagem_url && (
                          <img
                            src={order.revista.imagem_url}
                            alt={order.revista.titulo}
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        <span className="font-medium">{order.revista?.titulo || "-"}</span>
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
                      }).format(Number(order.preco_pago))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum pedido encontrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
