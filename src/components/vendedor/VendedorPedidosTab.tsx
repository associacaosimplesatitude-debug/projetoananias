import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Eye, Package, ShoppingCart, ExternalLink, FileText, CheckCircle, Pencil, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { PedidoDetailDialog, Pedido } from "./PedidoDetailDialog";
import { ShopifyPedidoDetailDialog } from "./ShopifyPedidoDetailDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

interface PropostaFaturada {
  id: string;
  cliente_nome: string;
  valor_total: number;
  valor_frete: number | null;
  valor_produtos: number | null;
  desconto_percentual: number | null;
  created_at: string;
  confirmado_em: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itens: any;
}

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
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // States for Shopify pedido dialog
  const [selectedShopifyPedido, setSelectedShopifyPedido] = useState<ShopifyPedido | null>(null);
  const [shopifyDialogOpen, setShopifyDialogOpen] = useState(false);
  
  // States for edit/delete propostas faturadas
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProposta, setSelectedProposta] = useState<PropostaFaturada | null>(null);
  const [editValorTotal, setEditValorTotal] = useState("");
  const [editValorFrete, setEditValorFrete] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if user can edit/delete (financeiro or gerente_ebd)
  const canManagePropostas = role === 'financeiro' || role === 'gerente_ebd' || role === 'admin';

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

  // Fetch internal orders for all clients of this vendedor
  const { data: pedidos = [], isLoading: isLoadingPedidos } = useQuery({
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
        .is("bling_order_id", null)
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

  // Fetch invoiced orders (Bling) for all clients of this vendedor
  const { data: pedidosFaturados = [], isLoading: isLoadingFaturados } = useQuery({
    queryKey: ["vendedor-pedidos-faturados", vendedorId, clienteIds],
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
        .not("bling_order_id", "is", null)
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

  // Fetch Shopify orders for this vendedor (by vendedor_id OR cliente_id of their clients)
  const { data: shopifyPedidos = [], isLoading: isLoadingShopify } = useQuery({
    queryKey: ["vendedor-shopify-pedidos", vendedorId, clienteIds],
    queryFn: async () => {
      // First, fetch orders directly by vendedor_id
      const { data: byVendedor, error: vendedorError } = await supabase
        .from("ebd_shopify_pedidos")
        .select("*")
        .eq("vendedor_id", vendedorId)
        .order("created_at", { ascending: false });
      
      if (vendedorError) {
        console.error("Error fetching shopify pedidos by vendedor:", vendedorError);
        throw vendedorError;
      }

      // Also fetch orders by cliente_id for this vendedor's clients
      let byCliente: ShopifyPedido[] = [];
      if (clienteIds.length > 0) {
        const { data: clienteData, error: clienteError } = await supabase
          .from("ebd_shopify_pedidos")
          .select("*")
          .in("cliente_id", clienteIds)
          .order("created_at", { ascending: false });
        
        if (clienteError) {
          console.error("Error fetching shopify pedidos by cliente:", clienteError);
        } else {
          byCliente = (clienteData || []) as ShopifyPedido[];
        }
      }

      // Merge and deduplicate by id
      const allPedidos = [...(byVendedor || []), ...byCliente];
      const uniquePedidos = Array.from(
        new Map(allPedidos.map(p => [p.id, p])).values()
      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return uniquePedidos as ShopifyPedido[];
    },
    enabled: !!vendedorId,
  });

  // Fetch propostas faturadas (approved by financial) for this vendedor
  const { data: propostasFaturadas = [], isLoading: isLoadingPropostas } = useQuery({
    queryKey: ["vendedor-propostas-faturadas", vendedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_propostas")
        .select("*")
        .eq("vendedor_id", vendedorId)
        .in("status", ["FATURADO", "APROVADA_FATURAMENTO"])
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching propostas faturadas:", error);
        throw error;
      }
      return (data || []) as PropostaFaturada[];
    },
    enabled: !!vendedorId,
    refetchOnWindowFocus: true,
    staleTime: 30000, // 30 seconds
  });

  const isLoading = isLoadingPedidos || isLoadingShopify || isLoadingFaturados || isLoadingPropostas;

  // Calculate valor_para_meta for faturados (same logic as Shopify: valor_total - valor_frete)
  const calcularValorParaMeta = (pedido: Pedido) => {
    return pedido.valor_total - (pedido.valor_frete || 0);
  };

  // Calculate valor_para_meta for propostas faturadas
  const calcularValorParaMetaProposta = (proposta: PropostaFaturada) => {
    return proposta.valor_total - (proposta.valor_frete || 0);
  };

  const handleViewPedido = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setDialogOpen(true);
  };

  // Handlers for edit/delete propostas faturadas
  const handleOpenEditDialog = (proposta: PropostaFaturada) => {
    setSelectedProposta(proposta);
    setEditValorTotal(proposta.valor_total.toString());
    setEditValorFrete((proposta.valor_frete || 0).toString());
    setEditDialogOpen(true);
  };

  const handleOpenDeleteDialog = (proposta: PropostaFaturada) => {
    setSelectedProposta(proposta);
    setDeleteDialogOpen(true);
  };

  const handleEditProposta = async () => {
    if (!selectedProposta) return;
    setIsProcessing(true);

    try {
      const novoValorTotal = parseFloat(editValorTotal);
      const novoValorFrete = parseFloat(editValorFrete);

      if (isNaN(novoValorTotal) || novoValorTotal < 0) {
        toast.error("Valor total inválido");
        return;
      }

      const { error } = await supabase
        .from("vendedor_propostas")
        .update({
          valor_total: novoValorTotal,
          valor_frete: novoValorFrete || 0,
        })
        .eq("id", selectedProposta.id);

      if (error) throw error;

      toast.success("Proposta atualizada com sucesso");
      setEditDialogOpen(false);
      setSelectedProposta(null);
      queryClient.invalidateQueries({ queryKey: ["vendedor-propostas-faturadas"] });
    } catch (error: unknown) {
      console.error("Erro ao editar proposta:", error);
      toast.error("Erro ao editar proposta");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProposta = async () => {
    if (!selectedProposta) return;
    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from("vendedor_propostas")
        .delete()
        .eq("id", selectedProposta.id);

      if (error) throw error;

      toast.success("Proposta excluída com sucesso");
      setDeleteDialogOpen(false);
      setSelectedProposta(null);
      queryClient.invalidateQueries({ queryKey: ["vendedor-propostas-faturadas"] });
    } catch (error: unknown) {
      console.error("Erro ao excluir proposta:", error);
      toast.error("Erro ao excluir proposta");
    } finally {
      setIsProcessing(false);
    }
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
          {/* Shopify Orders Section */}
          {shopifyPedidos.length > 0 && (
            <div className="mb-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Para Meta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rastreio</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shopifyPedidos.map((pedido) => (
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
                        {pedido.customer_name || clienteMap[pedido.cliente_id || ''] || 'N/A'}
                      </TableCell>
                      <TableCell>
                        R$ {pedido.valor_total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        R$ {pedido.valor_para_meta.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-500 hover:bg-green-600">
                          {pedido.status_pagamento}
                        </Badge>
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
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedShopifyPedido(pedido);
                            setShopifyDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Propostas Faturadas (Approved by Financial) Section */}
          {propostasFaturadas.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Propostas Faturadas (Aprovadas pelo Financeiro)
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Para Meta</TableHead>
                    <TableHead>Status</TableHead>
                    {canManagePropostas && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propostasFaturadas.map((proposta) => {
                    const itens = Array.isArray(proposta.itens) ? proposta.itens : [];
                    return (
                      <TableRow key={proposta.id}>
                        <TableCell>
                          {proposta.created_at 
                            ? format(new Date(proposta.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {proposta.cliente_nome}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {itens.map((item: any, idx: number) => (
                            <span key={idx}>
                              {item.quantity}x {item.title}{idx < itens.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </TableCell>
                        <TableCell>
                          R$ {proposta.valor_total.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-green-600 font-medium">
                          R$ {calcularValorParaMetaProposta(proposta).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-blue-500 hover:bg-blue-600">
                            Faturado
                          </Badge>
                        </TableCell>
                        {canManagePropostas && (
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditDialog(proposta)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDeleteDialog(proposta)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Invoiced Orders (Bling) Section */}
          {pedidosFaturados.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Pedidos Faturados (Bling)
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido Bling</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Para Meta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rastreio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosFaturados.map((pedido) => (
                    <TableRow key={pedido.id}>
                      <TableCell className="font-medium">
                        #{pedido.bling_order_id}
                      </TableCell>
                      <TableCell>
                        {pedido.created_at 
                          ? format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {pedido.nome_igreja}
                      </TableCell>
                      <TableCell>
                        R$ {pedido.valor_total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        R$ {calcularValorParaMeta(pedido).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-blue-500 hover:bg-blue-600">
                          Faturado
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {pedido.codigo_rastreio ? (
                          <span>{pedido.codigo_rastreio}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Internal Orders Section */}
          {pedidos.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Pedidos Internos
              </h3>
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
            </div>
          )}

          {pedidos.length === 0 && shopifyPedidos.length === 0 && pedidosFaturados.length === 0 && propostasFaturadas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum pedido encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      <PedidoDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pedido={selectedPedido}
      />

      {/* Edit Proposta Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Proposta Faturada</DialogTitle>
            <DialogDescription>
              Altere os valores da proposta de {selectedProposta?.cliente_nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="valor_total">Valor Total (R$)</Label>
              <Input
                id="valor_total"
                type="number"
                step="0.01"
                value={editValorTotal}
                onChange={(e) => setEditValorTotal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_frete">Valor Frete (R$)</Label>
              <Input
                id="valor_frete"
                type="number"
                step="0.01"
                value={editValorFrete}
                onChange={(e) => setEditValorFrete(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditProposta} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Proposta Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Proposta Faturada</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja excluir a proposta de <strong>{selectedProposta?.cliente_nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProposta(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProposta}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shopify Pedido Detail Dialog */}
      <ShopifyPedidoDetailDialog
        open={shopifyDialogOpen}
        onOpenChange={setShopifyDialogOpen}
        pedido={selectedShopifyPedido}
      />
    </>
  );
}
