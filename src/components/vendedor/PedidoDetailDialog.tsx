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
  CreditCard, 
  MapPin, 
  Calendar, 
  User,
  Truck,
  DollarSign,
  Building
} from "lucide-react";

interface PedidoItem {
  id: string;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  revista?: {
    titulo: string;
    faixa_etaria_alvo: string;
  } | null;
}

export interface Pedido {
  id: string;
  church_id: string;
  created_at: string | null;
  status: string;
  payment_status: string | null;
  valor_total: number;
  valor_produtos: number;
  valor_frete: number;
  metodo_frete: string | null;
  codigo_rastreio: string | null;
  nome_cliente: string | null;
  sobrenome_cliente: string | null;
  email_cliente: string | null;
  telefone_cliente: string | null;
  cpf_cnpj_cliente: string | null;
  endereco_rua: string;
  endereco_numero: string;
  endereco_complemento: string | null;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
  endereco_cep: string;
  bling_order_id: number | null;
  nome_igreja?: string;
  ebd_pedidos_itens?: PedidoItem[];
}

interface PedidoDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: Pedido | null;
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
    'credit_card': 'Cartão de Crédito',
    'debit_card': 'Cartão de Débito',
    'bolbradesco': 'Boleto',
    'pac': 'PAC',
    'sedex': 'SEDEX',
  };
  return methods[metodo] || metodo;
};

export function PedidoDetailDialog({ open, onOpenChange, pedido }: PedidoDetailDialogProps) {
  if (!pedido) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalhes do Pedido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Código do Pedido</p>
              <p className="font-mono text-sm">{pedido.id.slice(0, 8).toUpperCase()}</p>
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
              {getStatusBadge(pedido.status, pedido.payment_status)}
            </div>
          </div>

          <Separator />

          {/* Igreja */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <Building className="h-4 w-4" />
              Igreja
            </h4>
            <p className="text-lg font-medium">{pedido.nome_igreja || 'Não identificada'}</p>
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
                <p>{pedido.nome_cliente} {pedido.sobrenome_cliente || ''}</p>
              </div>
              <div>
                <p className="text-muted-foreground">CPF/CNPJ</p>
                <p>{pedido.cpf_cnpj_cliente || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p>{pedido.email_cliente || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Telefone</p>
                <p>{pedido.telefone_cliente || '-'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Endereço */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4" />
              Endereço de Entrega
            </h4>
            <p className="text-sm">
              {pedido.endereco_rua}, {pedido.endereco_numero}
              {pedido.endereco_complemento && ` - ${pedido.endereco_complemento}`}
            </p>
            <p className="text-sm">
              {pedido.endereco_bairro} - {pedido.endereco_cidade}/{pedido.endereco_estado}
            </p>
            <p className="text-sm">CEP: {pedido.endereco_cep}</p>
          </div>

          <Separator />

          {/* Itens */}
          {pedido.ebd_pedidos_itens && pedido.ebd_pedidos_itens.length > 0 && (
            <>
              <div>
                <h4 className="font-semibold mb-2">Itens do Pedido</h4>
                <div className="space-y-2">
                  {pedido.ebd_pedidos_itens.map((item, index) => (
                    <div key={item.id || index} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <p className="font-medium">{item.revista?.titulo || 'Revista'}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.revista?.faixa_etaria_alvo || ''} - Qtd: {item.quantidade}
                        </p>
                      </div>
                      <p className="font-medium">
                        R$ {item.preco_total.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Valores */}
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4" />
              Valores
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Produtos</span>
                <span>R$ {pedido.valor_produtos.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  Frete ({getPaymentMethodLabel(pedido.metodo_frete)})
                </span>
                <span>R$ {pedido.valor_frete.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>R$ {pedido.valor_total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Rastreio */}
          {pedido.codigo_rastreio && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <Truck className="h-4 w-4" />
                  Rastreamento
                </h4>
                <p className="font-mono bg-muted p-2 rounded">{pedido.codigo_rastreio}</p>
              </div>
            </>
          )}

          {/* Bling */}
          {pedido.bling_order_id && (
            <div className="text-sm text-muted-foreground">
              ID Bling: {pedido.bling_order_id}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
