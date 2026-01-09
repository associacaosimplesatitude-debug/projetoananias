import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

interface PropostaItem {
  id: string;
  nome: string;
  quantidade: number;
  preco: number;
  sku?: string;
}

interface PropostaFaturada {
  id: string;
  cliente_nome: string;
  valor_total: number;
  valor_frete: number;
  desconto_aplicado: number;
  created_at: string;
  itens: PropostaItem[];
  prazo_faturamento?: number;
}

interface PropostaFaturadaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposta: PropostaFaturada | null;
}

export function PropostaFaturadaDetailDialog({
  open,
  onOpenChange,
  proposta,
}: PropostaFaturadaDetailDialogProps) {
  if (!proposta) return null;

  const subtotalProdutos = proposta.itens.reduce(
    (acc, item) => acc + item.preco * item.quantidade,
    0
  );

  const calcularValorParaMeta = () => {
    const valorProdutos = subtotalProdutos;
    const valorFrete = proposta.valor_frete || 0;
    return valorProdutos - valorFrete;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Proposta Faturada - {proposta.cliente_nome}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Data: {format(new Date(proposta.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Produtos */}
          <div>
            <h4 className="font-medium mb-2">Produtos ({proposta.itens.length} itens)</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposta.itens.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell className="font-medium">
                      <div>
                        <span>{item.nome}</span>
                        {item.sku && (
                          <span className="text-xs text-muted-foreground block">
                            SKU: {item.sku}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.quantidade}</TableCell>
                    <TableCell className="text-right">
                      R$ {item.preco.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {(item.preco * item.quantidade).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Separator />

          {/* Resumo de valores */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal dos Produtos:</span>
              <span>R$ {subtotalProdutos.toFixed(2)}</span>
            </div>

            {proposta.valor_frete > 0 && (
              <div className="flex justify-between">
                <span>Frete:</span>
                <span>R$ {proposta.valor_frete.toFixed(2)}</span>
              </div>
            )}

            {proposta.desconto_aplicado > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Desconto Aplicado:</span>
                <span>- R$ {proposta.desconto_aplicado.toFixed(2)}</span>
              </div>
            )}

            {proposta.prazo_faturamento && (
              <div className="flex justify-between text-muted-foreground">
                <span>Prazo Faturamento:</span>
                <span>{proposta.prazo_faturamento} dias</span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between font-semibold text-base">
              <span>Valor Total:</span>
              <span>R$ {proposta.valor_total.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-primary font-medium">
              <span>Valor para Meta:</span>
              <span>R$ {calcularValorParaMeta().toFixed(2)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
