import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FileText, CreditCard, Clock, Receipt, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FaturamentoSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteNome: string;
  onSelectFaturamento: (prazo: string) => void;
  onSelectPagamentoPadrao: () => void;
}

export function FaturamentoSelectionDialog({
  open,
  onOpenChange,
  clienteNome,
  onSelectFaturamento,
  onSelectPagamentoPadrao,
}: FaturamentoSelectionDialogProps) {
  const [selectedPrazo, setSelectedPrazo] = useState<string | null>(null);
  const [step, setStep] = useState<'choice' | 'prazo'>('choice');

  const handleSelectFaturamento = () => {
    setStep('prazo');
  };

  const handleConfirmPrazo = () => {
    if (selectedPrazo) {
      onSelectFaturamento(selectedPrazo);
      // Reset state for next time
      setTimeout(() => {
        setStep('choice');
        setSelectedPrazo(null);
      }, 300);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep('choice');
      setSelectedPrazo(null);
    }, 300);
  };

  const handlePagamentoPadrao = () => {
    onSelectPagamentoPadrao();
    setTimeout(() => {
      setStep('choice');
      setSelectedPrazo(null);
    }, 300);
  };

  const prazos = [
    { value: '30', label: '30 dias', description: 'Vencimento em 1 mês' },
    { value: '60', label: '60 dias', description: 'Vencimento em 2 meses' },
    { value: '90', label: '90 dias', description: 'Vencimento em 3 meses' },
  ];

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-6 w-6 text-primary" />
            Forma de Pagamento
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            O cliente <strong className="text-foreground">{clienteNome}</strong> está habilitado para faturamento B2B.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {step === 'choice' && (
          <div className="space-y-3 mt-4">
            <Button
              variant="outline"
              className="w-full h-auto p-4 justify-start text-left border-2 hover:border-primary hover:bg-primary/5 transition-all"
              onClick={handleSelectFaturamento}
            >
              <div className="flex gap-4 items-start w-full">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-base">Faturar Pedido (B2B)</p>
                  <p className="text-sm text-muted-foreground font-normal mt-1">
                    Pagamento em 30, 60 ou 90 dias via boleto faturado no Shopify.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Prazo estendido para clientes B2B</span>
                  </div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full h-auto p-4 justify-start text-left border-2 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all"
              onClick={handlePagamentoPadrao}
            >
              <div className="flex gap-4 items-start w-full">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CreditCard className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-base">Pagamento Padrão</p>
                  <p className="text-sm text-muted-foreground font-normal mt-1">
                    O cliente pagará via PIX, Cartão ou Boleto através do checkout padrão.
                  </p>
                </div>
              </div>
            </Button>
          </div>
        )}

        {step === 'prazo' && (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Selecione o prazo de pagamento para o faturamento:
            </p>
            
            <div className="grid grid-cols-3 gap-3">
              {prazos.map((prazo) => (
                <button
                  key={prazo.value}
                  onClick={() => setSelectedPrazo(prazo.value)}
                  className={cn(
                    "relative p-4 rounded-lg border-2 transition-all text-center",
                    selectedPrazo === prazo.value
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-muted hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  {selectedPrazo === prazo.value && (
                    <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-primary" />
                  )}
                  <div className="text-2xl font-bold text-primary">{prazo.value}</div>
                  <div className="text-sm text-muted-foreground">dias</div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep('choice')}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmPrazo}
                disabled={!selectedPrazo}
              >
                <FileText className="w-4 h-4 mr-2" />
                Confirmar Faturamento
              </Button>
            </div>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
