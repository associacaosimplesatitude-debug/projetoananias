import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Package, 
  Calendar, 
  User,
  Truck,
  DollarSign,
  ShoppingCart
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  codigo_rastreio_bling: string | null;
  url_rastreio: string | null;
}

interface ShopifyPedidoDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: ShopifyPedido | null;
}

export function ShopifyPedidoDetailDialog({ open, onOpenChange, pedido }: ShopifyPedidoDetailDialogProps) {
  // Fetch items from ebd_shopify_pedidos_itens
  const { data: lineItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ["shopify-pedido-itens", pedido?.id],
    queryFn: async () => {
      if (!pedido?.id) return [];
      
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos_itens")
        .select("*")
        .eq("pedido_id", pedido.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching items:", error);
        return [];
      }

      return data || [];
    },
    enabled: open && !!pedido?.id,
  });

  if (!pedido) return null;

  const valorProdutos = pedido.valor_total - pedido.valor_frete;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Detalhes do Pedido Shopify
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Número do Pedido</p>
              <p className="font-mono text-lg font-bold">{pedido.order_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data</p>
              <p className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {pedido.created_at 
                  ? format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : '-'}
              </p>
            </div>
            <div>
              <Badge className="bg-green-500 hover:bg-green-600">
                {pedido.status_pagamento}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Cliente */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <User className="h-4 w-4" />
              Dados do Cliente
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Nome</p>
                <p>{pedido.customer_name || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p>{pedido.customer_email || '-'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Produtos */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <Package className="h-4 w-4" />
              Produtos do Pedido
            </h4>
            
            {isLoadingItems ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : lineItems.length > 0 ? (
              <div className="space-y-2">
                {lineItems.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.product_title}</p>
                      {item.variant_title && item.variant_title !== 'Default Title' && (
                        <p className="text-sm text-muted-foreground">{item.variant_title}</p>
                      )}
                      {item.sku && (
                        <p className="text-xs text-muted-foreground font-mono">SKU: {item.sku}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Qtd: {item.quantity}</p>
                      <p className="font-medium">R$ {Number(item.price || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhum produto encontrado para este pedido.</p>
            )}
          </div>

          <Separator />

          {/* Valores */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4" />
              Valores
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Produtos</span>
                <span>R$ {valorProdutos.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  Frete
                </span>
                <span>R$ {pedido.valor_frete.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>R$ {pedido.valor_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-600 font-medium">
                <span>Valor para Meta</span>
                <span>R$ {pedido.valor_para_meta.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Rastreio */}
          {(() => {
            const trackingCode = pedido.codigo_rastreio || pedido.codigo_rastreio_bling;
            const trackingUrl = pedido.url_rastreio || (pedido.codigo_rastreio_bling ? `https://www.linkcorreios.com.br/?id=${pedido.codigo_rastreio_bling}` : null);
            if (!trackingCode) return null;
            return (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <Truck className="h-4 w-4" />
                    Rastreamento
                  </h4>
                  {trackingUrl ? (
                    <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="font-mono bg-muted p-2 rounded block text-blue-600 hover:underline">
                      {trackingCode} ↗
                    </a>
                  ) : (
                    <p className="font-mono bg-muted p-2 rounded">{trackingCode}</p>
                  )}
                </div>
              </>
            );
          })()}

          {/* IDs técnicos */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Shopify Order ID: {pedido.shopify_order_id}</p>
            <p>ID Interno: {pedido.id}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
