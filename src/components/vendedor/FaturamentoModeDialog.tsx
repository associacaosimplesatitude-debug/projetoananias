import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FileText, CreditCard, AlertCircle, X } from "lucide-react";

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
      <AlertDialogContent className="fixed top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto p-6 relative">
        <AlertDialogCancel className="absolute right-4 top-4 h-8 w-8 p-0 border-0 rounded-full hover:bg-muted">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </AlertDialogCancel>
        <AlertDialogHeader className="space-y-2 pr-8">
          <AlertDialogTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-primary shrink-0" />
            Selecione a Forma de Pagamento
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            O cliente <strong className="text-foreground">{clienteNome}</strong> está habilitado para faturamento B2B.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 mt-2">
          <Button
            variant="outline"
            className="w-full h-auto p-4 justify-start text-left border hover:border-primary/50 hover:bg-primary/5"
            onClick={onSelectFaturamento}
          >
            <div className="flex items-start gap-3 w-full">
              <FileText className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Faturar (30/60/90 dias)</p>
                <p className="text-xs text-muted-foreground font-normal mt-0.5 whitespace-normal">
                  Pedido será enviado para o Bling com pagamento parcelado via boleto.
                </p>
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full h-auto p-4 justify-start text-left border hover:border-green-500/50 hover:bg-green-50 dark:hover:bg-green-950/20"
            onClick={onSelectPadrão}
          >
            <div className="flex items-start gap-3 w-full">
              <CreditCard className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Pagamento Padrão</p>
                <p className="text-xs text-muted-foreground font-normal mt-0.5 whitespace-normal">
                  O cliente pagará via PIX, Cartão ou Boleto pelo checkout padrão.
                </p>
              </div>
            </div>
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
