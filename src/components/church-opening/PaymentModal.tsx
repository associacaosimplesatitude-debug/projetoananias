import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  description: string;
  onSuccess: () => void;
}

export const PaymentModal = ({
  open,
  onOpenChange,
  amount,
  description,
  onSuccess,
}: PaymentModalProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handlePayment = async (method: 'card' | 'pix') => {
    setIsProcessing(true);
    
    // Simulação de processamento de pagamento
    setTimeout(() => {
      setIsProcessing(false);
      onOpenChange(false);
      toast({
        title: 'Pagamento processado!',
        description: `Pagamento de R$ ${amount.toFixed(2)} confirmado via ${method === 'pix' ? 'PIX' : 'Cartão'}.`,
      });
      onSuccess();
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Realizar Pagamento</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-primary/10 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Valor a pagar</p>
            <p className="text-3xl font-bold text-primary">
              R$ {amount.toFixed(2)}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Escolha a forma de pagamento:</p>
            
            <Button
              onClick={() => handlePayment('pix')}
              disabled={isProcessing}
              className="w-full gap-2"
              size="lg"
            >
              <QrCode className="h-5 w-5" />
              Pagar com PIX
            </Button>

            <Button
              onClick={() => handlePayment('card')}
              disabled={isProcessing}
              variant="outline"
              className="w-full gap-2"
              size="lg"
            >
              <CreditCard className="h-5 w-5" />
              Pagar com Cartão
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
