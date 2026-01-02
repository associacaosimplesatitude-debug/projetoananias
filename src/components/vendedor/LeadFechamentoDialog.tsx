import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";

interface LeadFechamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadNome: string;
  onConfirm: (valor: number) => void;
  isLoading?: boolean;
}

export function LeadFechamentoDialog({
  open,
  onOpenChange,
  leadNome,
  onConfirm,
  isLoading = false,
}: LeadFechamentoDialogProps) {
  const [valor, setValor] = useState("");

  const handleConfirm = () => {
    const valorNumerico = parseFloat(valor.replace(",", "."));
    if (!isNaN(valorNumerico) && valorNumerico > 0) {
      onConfirm(valorNumerico);
      setValor("");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setValor("");
    }
    onOpenChange(newOpen);
  };

  const isValid = () => {
    const valorNumerico = parseFloat(valor.replace(",", "."));
    return !isNaN(valorNumerico) && valorNumerico > 0;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Registrar Fechamento
          </DialogTitle>
          <DialogDescription>
            Registre o valor da compra para o lead "{leadNome}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="valor">Valor da Compra (R$) *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="valor"
                type="text"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Campo obrigatório para registrar o fechamento
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!isValid() || isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? "Salvando..." : "Confirmar Fechamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
