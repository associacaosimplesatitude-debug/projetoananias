import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, CreditCard } from "lucide-react";

interface FaturamentoModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectBling: () => void;
  onSelectNormal: () => void;
}

export function FaturamentoModeDialog({
  open,
  onOpenChange,
  onSelectBling,
  onSelectNormal,
}: FaturamentoModeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escolha a forma de pagamento</DialogTitle>
          <DialogDescription>
            Você pode faturar o pedido em 30/60/90 dias ou pagar normalmente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Button
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-2"
            onClick={onSelectBling}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-semibold">Faturar Pedido (B2B)</span>
            </div>
            <span className="text-sm text-muted-foreground text-left">
              Pagamento em 30/60/90 dias via boleto faturado. Desconto de 30%.
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-4 flex flex-col items-start gap-2"
            onClick={onSelectNormal}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-600" />
              <span className="font-semibold">Pagamento Normal</span>
            </div>
            <span className="text-sm text-muted-foreground text-left">
              Pagamento via cartão, Pix ou boleto à vista.
            </span>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
