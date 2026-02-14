import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FileText, CreditCard, AlertCircle } from "lucide-react";

interface FaturamentoModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteNome: string;
  onSelectFaturamento: () => void;
  onSelectPadrão: () => void;
}

export function FaturamentoModeDialog({
  open,
  onOpenChange,
  clienteNome,
  onSelectFaturamento,
  onSelectPadrão,
}: FaturamentoModeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl">
            <AlertCircle className="h-5 w-5 text-blue-500" />
            Selecione a Forma de Pagamento
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            O cliente <strong className="text-foreground">{clienteNome}</strong> está habilitado para faturamento B2B.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 mt-4">
          <Button
            variant="outline"
            className="w-full h-auto p-4 justify-start text-left border-2 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20"
            onClick={onSelectFaturamento}
          >
            <div className="flex gap-3">
              <FileText className="h-8 w-8 text-blue-500 shrink-0" />
              <div>
                <p className="font-semibold text-base">Faturar (30/60/90 dias)</p>
                <p className="text-sm text-muted-foreground font-normal">
                  Pedido será enviado diretamente para o Bling com condição de pagamento parcelada via boleto.
                </p>
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full h-auto p-4 justify-start text-left border-2 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20"
            onClick={onSelectPadrão}
          >
            <div className="flex gap-3">
              <CreditCard className="h-8 w-8 text-green-500 shrink-0" />
              <div>
                <p className="font-semibold text-base">Pagamento Padrão</p>
                <p className="text-sm text-muted-foreground font-normal">
                  O cliente pagará via PIX, Cartão ou Boleto através do checkout padrão.
                </p>
              </div>
            </div>
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
