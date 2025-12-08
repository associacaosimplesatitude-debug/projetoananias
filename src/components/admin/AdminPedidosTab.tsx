import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, Package, ShoppingCart, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { PedidoDetailDialog, Pedido } from "@/components/vendedor/PedidoDetailDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminPedidosTabProps {
  vendedores?: { id: string; nome: string }[];
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

export function AdminPedidosTab({ vendedores = [] }: AdminPedidosTabProps) {
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [vendedorFilter, setVendedorFilter] = useState<string>("all");

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

  // Fetch all orders
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["admin-all-pedidos"],
    queryFn: async () => {
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
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Add nome_igreja to each pedido
      return (data || []).map(p => ({
        ...p,
        nome_igreja: clienteMap[p.church_id]?.nome || 'Cliente não identificado',
        vendedor_id: clienteMap[p.church_id]?.vendedor_id || null,
      })) as (Pedido & { vendedor_id: string | null })[];
    },
    enabled: clientes.length > 0,
  });

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      // Status filter
      if (statusFilter !== "all") {
        const isPago = p.payment_status === 'approved' || p.status === 'approved';
        const isCancelado = p.status === 'cancelled' || p.payment_status === 'cancelled';
        const isFaturado = p.status === 'shipped' || p.status === 'faturado';
        const isPendente = !isPago && !isCancelado && !isFaturado;

        if (statusFilter === "pago" && !isPago) return false;
        if (statusFilter === "cancelado" && !isCancelado) return false;
        if (statusFilter === "faturado" && !isFaturado) return false;
        if (statusFilter === "pendente" && !isPendente) return false;
      }

      // Vendedor filter
      if (vendedorFilter !== "all" && p.vendedor_id !== vendedorFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const nomeIgreja = (p.nome_igreja || '').toLowerCase();
        const nomeCliente = (p.nome_cliente || '').toLowerCase();
        return nomeIgreja.includes(search) || nomeCliente.includes(search);
      }

      return true;
    });
  }, [pedidos, statusFilter, vendedorFilter, searchTerm]);

  const handleViewPedido = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setDialogOpen(true);
  };

  // Stats
  const stats = useMemo(() => {
    const total = pedidos.length;
    const pagos = pedidos.filter(p => p.payment_status === 'approved' || p.status === 'approved').length;
    const cancelados = pedidos.filter(p => p.status === 'cancelled' || p.payment_status === 'cancelled').length;
    const faturados = pedidos.filter(p => p.status === 'shipped' || p.status === 'faturado').length;
    const pendentes = total - pagos - cancelados - faturados;
    const valorTotal = pedidos
      .filter(p => p.payment_status === 'approved' || p.status === 'approved')
      .reduce((acc, p) => acc + p.valor_total, 0);

    return { total, pagos, cancelados, faturados, pendentes, valorTotal };
  }, [pedidos]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats.faturados}</div>
            <p className="text-sm text-muted-foreground">Faturados</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{stats.cancelados}</div>
            <p className="text-sm text-muted-foreground">Cancelados</p>
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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Todos os Pedidos
          </CardTitle>
          <CardDescription>
            Pedidos de todas as igrejas do sistema EBD
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters Row */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por igreja ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="faturado">Faturado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Vendedores</SelectItem>
                {vendedores.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {filteredPedidos.length === 0 ? (
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
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPedidos.map((pedido) => {
                  const vendedor = vendedores.find(v => v.id === pedido.vendedor_id);
                  return (
                    <TableRow key={pedido.id}>
                      <TableCell>
                        {pedido.created_at 
                          ? format(new Date(pedido.created_at), "dd/MM/yyyy", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
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
                      <TableCell>
                        {vendedor?.nome || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPedido(pedido)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
    </div>
  );
}
