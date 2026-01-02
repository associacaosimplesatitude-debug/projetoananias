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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { XCircle } from "lucide-react";

const MOTIVOS_CANCELAMENTO = [
  { value: "Concorrência", label: "Concorrência" },
  { value: "Frete", label: "Frete" },
  { value: "Preço", label: "Preço" },
  { value: "Não respondeu", label: "Não respondeu" },
];

interface LeadCancelamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadNome: string;
  onConfirm: (motivo: string) => void;
  isLoading?: boolean;
}

export function LeadCancelamentoDialog({
  open,
  onOpenChange,
  leadNome,
  onConfirm,
  isLoading = false,
}: LeadCancelamentoDialogProps) {
  const [motivo, setMotivo] = useState("");

  const handleConfirm = () => {
    if (motivo) {
      onConfirm(motivo);
      setMotivo("");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setMotivo("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            Registrar Cancelamento
          </DialogTitle>
          <DialogDescription>
            Selecione o motivo do cancelamento para o lead "{leadNome}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Motivo do Cancelamento *</Label>
            <RadioGroup value={motivo} onValueChange={setMotivo}>
              {MOTIVOS_CANCELAMENTO.map((m) => (
                <div key={m.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={m.value} id={m.value} />
                  <Label htmlFor={m.value} className="cursor-pointer">
                    {m.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Campo obrigatório para registrar o cancelamento
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Voltar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!motivo || isLoading}
            variant="destructive"
          >
            {isLoading ? "Salvando..." : "Confirmar Cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
