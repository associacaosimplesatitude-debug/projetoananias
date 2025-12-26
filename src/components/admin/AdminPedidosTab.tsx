import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, ShoppingCart, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface ShopifyPedido {
  id: string;
  shopify_order_id: number;
  order_number: string;
  vendedor_id: string | null;
  cliente_id: string | null;
  status_pagamento: string;
  valor_total: number;
  valor_frete: number;
  valor_para_meta: number;
  customer_email: string | null;
  customer_name: string | null;
  created_at: string;
  codigo_rastreio: string | null;
  url_rastreio: string | null;
}

interface AdminPedidosTabProps {
  vendedores?: { id: string; nome: string }[];
  hideStats?: boolean;
}

const getShopifyStatusBadge = (status: string) => {
  switch (status) {
    case 'Pago':
      return <Badge className="bg-green-500 hover:bg-green-600">Pago</Badge>;
    case 'Reembolsado':
      return <Badge variant="destructive">Reembolsado</Badge>;
    case 'Parcialmente Reembolsado':
      return <Badge className="bg-orange-500 hover:bg-orange-600">Parcial</Badge>;
    case 'Cancelado':
      return <Badge variant="destructive">Cancelado</Badge>;
    case 'Pendente':
      return <Badge variant="secondary">Pendente</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export function AdminPedidosTab({ vendedores = [], hideStats = false }: AdminPedidosTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<ShopifyPedido | null>(null);
  const [editForm, setEditForm] = useState({
    status_pagamento: '',
    codigo_rastreio: '',
    url_rastreio: '',
    valor_total: 0,
    valor_para_meta: 0,
    vendedor_id: '',
  });

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

  // Fetch all Shopify orders
  const { data: shopifyPedidos = [], isLoading } = useQuery({
    queryKey: ["admin-all-shopify-pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as ShopifyPedido[];
    },
  });

  // Update mutation
  const updatePedidoMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<ShopifyPedido> }) => {
      const { error } = await supabase
        .from("ebd_shopify_pedidos")
        .update(data.updates)
        .eq("id", data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-shopify-pedidos"] });
      toast({ title: "Pedido atualizado com sucesso!" });
      setEditDialogOpen(false);
      setSelectedPedido(null);
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar pedido", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deletePedidoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ebd_shopify_pedidos")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-shopify-pedidos"] });
      toast({ title: "Pedido excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setSelectedPedido(null);
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir pedido", description: error.message, variant: "destructive" });
    },
  });

  // Handlers
  const handleEditPedido = (pedido: ShopifyPedido) => {
    setSelectedPedido(pedido);
    setEditForm({
      status_pagamento: pedido.status_pagamento,
      codigo_rastreio: pedido.codigo_rastreio || '',
      url_rastreio: pedido.url_rastreio || '',
      valor_total: pedido.valor_total,
      valor_para_meta: pedido.valor_para_meta,
      vendedor_id: pedido.vendedor_id || '',
    });
    setEditDialogOpen(true);
  };

  const handleDeletePedido = (pedido: ShopifyPedido) => {
    setSelectedPedido(pedido);
    setDeleteDialogOpen(true);
  };

  const handleSavePedido = () => {
    if (!selectedPedido) return;
    updatePedidoMutation.mutate({
      id: selectedPedido.id,
      updates: {
        status_pagamento: editForm.status_pagamento,
        codigo_rastreio: editForm.codigo_rastreio || null,
        url_rastreio: editForm.url_rastreio || null,
        valor_total: editForm.valor_total,
        valor_para_meta: editForm.valor_para_meta,
        vendedor_id: editForm.vendedor_id || null,
      },
    });
  };

  const confirmDeletePedido = () => {
    if (!selectedPedido) return;
    deletePedidoMutation.mutate(selectedPedido.id);
  };

  // Stats - only Shopify orders now
  const stats = useMemo(() => {
    const total = shopifyPedidos.length;
    const pagos = shopifyPedidos.filter(p => p.status_pagamento === 'Pago').length;
    const reembolsados = shopifyPedidos.filter(p => p.status_pagamento === 'Reembolsado' || p.status_pagamento === 'Parcialmente Reembolsado').length;
    const pendentes = shopifyPedidos.filter(p => p.status_pagamento === 'Pendente').length;
    
    const valorTotal = shopifyPedidos
      .filter(p => p.status_pagamento === 'Pago')
      .reduce((acc, p) => acc + p.valor_para_meta, 0);

    return { total, pagos, reembolsados, pendentes, valorTotal };
  }, [shopifyPedidos]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards - Hidden for gerente */}
      {!hideStats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{stats.reembolsados}</div>
                <p className="text-sm text-muted-foreground">Reembolsados</p>
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
        </>
      )}

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Pedidos
          </CardTitle>
          <CardDescription>
            Pedidos sincronizados automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shopifyPedidos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum pedido encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Para Meta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Rastreio</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shopifyPedidos.map((pedido) => {
                  const vendedor = vendedores.find(v => v.id === pedido.vendedor_id);
                  return (
                    <TableRow key={pedido.id}>
                      <TableCell className="font-medium">
                        {pedido.order_number}
                      </TableCell>
                      <TableCell>
                        {pedido.created_at 
                          ? format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {pedido.customer_name || clienteMap[pedido.cliente_id || '']?.nome || 'N/A'}
                      </TableCell>
                      <TableCell>
                        R$ {pedido.valor_total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        R$ {pedido.valor_para_meta.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {getShopifyStatusBadge(pedido.status_pagamento)}
                      </TableCell>
                      <TableCell>
                        {vendedor?.nome || '-'}
                      </TableCell>
                      <TableCell>
                        {pedido.codigo_rastreio ? (
                          pedido.url_rastreio ? (
                            <a 
                              href={pedido.url_rastreio} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {pedido.codigo_rastreio}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span>{pedido.codigo_rastreio}</span>
                          )
                        ) : (
                          <Badge variant="secondary">Aguardando</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditPedido(pedido)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeletePedido(pedido)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Pedido {selectedPedido?.order_number}</DialogTitle>
            <DialogDescription>
              Atualize as informações do pedido abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Status de Pagamento</Label>
              <Select
                value={editForm.status_pagamento}
                onValueChange={(value) => setEditForm({ ...editForm, status_pagamento: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Reembolsado">Reembolsado</SelectItem>
                  <SelectItem value="Parcialmente Reembolsado">Parcialmente Reembolsado</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valor Total (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.valor_total}
                  onChange={(e) => setEditForm({ ...editForm, valor_total: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Valor para Meta (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.valor_para_meta}
                  onChange={(e) => setEditForm({ ...editForm, valor_para_meta: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Vendedor</Label>
              <Select
                value={editForm.vendedor_id}
                onValueChange={(value) => setEditForm({ ...editForm, vendedor_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Código de Rastreio</Label>
              <Input
                value={editForm.codigo_rastreio}
                onChange={(e) => setEditForm({ ...editForm, codigo_rastreio: e.target.value })}
                placeholder="Ex: BR123456789BR"
              />
            </div>
            <div className="grid gap-2">
              <Label>URL de Rastreio</Label>
              <Input
                value={editForm.url_rastreio}
                onChange={(e) => setEditForm({ ...editForm, url_rastreio: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePedido} disabled={updatePedidoMutation.isPending}>
              {updatePedidoMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pedido <strong>{selectedPedido?.order_number}</strong>? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePedido}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePedidoMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}