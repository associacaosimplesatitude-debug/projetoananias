import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, Package, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { PedidoDetailDialog, Pedido } from "./PedidoDetailDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface VendedorPedidosTabProps {
  vendedorId: string;
}

const getStatusBadge = (status: string, paymentStatus: string | null) => {
  if (paymentStatus === 'approved' || status === 'approved') {
    return <Badge className="bg-green-500 hover:bg-green-600">Pago</Badge>;
  }
  if (status === 'cancelled' || paymentStatus === 'cancelled') {
    return <Badge variant="destructive">Cancelado</Badge>;
  }
  if (status === 'shipped' || status === 'faturado') {
    return <Badge className="bg-blue-500 hover:bg-blue-600">Faturado</Badge>;
  }
  return <Badge variant="secondary">Pendente</Badge>;
};

const getPaymentMethodLabel = (metodo: string | null) => {
  if (!metodo) return '-';
  const methods: Record<string, string> = {
    'pix': 'PIX',
    'credit_card': 'Cartão',
    'debit_card': 'Débito',
    'bolbradesco': 'Boleto',
  };
  return methods[metodo] || metodo;
};

export function VendedorPedidosTab({ vendedorId }: VendedorPedidosTabProps) {
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch all clients for this vendedor from both ebd_clientes and churches
  const { data: allClients = [] } = useQuery({
    queryKey: ["vendedor-all-clients", vendedorId],
    queryFn: async () => {
      // Fetch from ebd_clientes
      const { data: ebdClientes, error: ebdError } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .eq("vendedor_id", vendedorId);
      if (ebdError) throw ebdError;

      // Fetch from churches
      const { data: churches, error: churchError } = await supabase
        .from("churches")
        .select("id, church_name")
        .eq("vendedor_id", vendedorId);
      if (churchError) throw churchError;

      // Combine both sources
      const combined = [
        ...(ebdClientes || []).map(c => ({ id: c.id, nome: c.nome_igreja })),
        ...(churches || []).map(c => ({ id: c.id, nome: c.church_name })),
      ];
      
      return combined;
    },
    enabled: !!vendedorId,
  });

  const clienteIds = allClients.map(c => c.id);
  const clienteMap = Object.fromEntries(allClients.map(c => [c.id, c.nome]));

  // Fetch orders for all clients of this vendedor
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["vendedor-pedidos", vendedorId, clienteIds],
    queryFn: async () => {
      if (clienteIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("ebd_pedidos")
        .select(`
          *,
          ebd_pedidos_itens(
            id,
            quantidade,
            preco_unitario,
            preco_total,
            revista:ebd_revistas(titulo, faixa_etaria_alvo)
          )
        `)
        .in("church_id", clienteIds)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Add nome_igreja to each pedido
      return (data || []).map(p => ({
        ...p,
        nome_igreja: clienteMap[p.church_id] || 'Cliente não identificado',
      })) as Pedido[];
    },
    enabled: clienteIds.length > 0,
  });

  const handleViewPedido = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Pedidos dos Meus Clientes
          </CardTitle>
          <CardDescription>
            Pedidos realizados por você ou pelos superintendentes das igrejas vinculadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pedidos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum pedido encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Igreja</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((pedido) => (
                  <TableRow key={pedido.id}>
                    <TableCell>
                      {pedido.created_at 
                        ? format(new Date(pedido.created_at), "dd/MM/yyyy", { locale: ptBR })
                        : '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {pedido.nome_igreja}
                    </TableCell>
                    <TableCell>
                      R$ {pedido.valor_total.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {getPaymentMethodLabel(pedido.metodo_frete)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(pedido.status, pedido.payment_status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewPedido(pedido)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver Pedido
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PedidoDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pedido={selectedPedido}
      />
    </>
  );
}
