import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Paperclip, X } from 'lucide-react';

interface Bill {
  id: string;
  description: string;
  amount: number;
  due_date: string;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: Bill | null;
  onConfirm: (paidDate: string, paidAmount: number, receiptFile?: File) => void;
}

export const PaymentDialog = ({ open, onOpenChange, bill, onConfirm }: PaymentDialogProps) => {
  const [paidDate, setPaidDate] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo (PDF ou imagem)
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(file.type)) {
        alert('Por favor, selecione um arquivo PDF ou imagem (JPG, PNG)');
        return;
      }
      // Validar tamanho (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('O arquivo deve ter no máximo 5MB');
        return;
      }
      setReceiptFile(file);
    }
  };

  const handleRemoveFile = () => {
    setReceiptFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bill) return;

    onConfirm(
      paidDate,
      parseFloat(paidAmount),
      receiptFile || undefined
    );

    // Reset form
    setPaidDate('');
    setPaidAmount('');
    setReceiptFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Set default values when bill changes
  useState(() => {
    if (bill && open) {
      setPaidDate(new Date().toISOString().split('T')[0]);
      setPaidAmount(bill.amount.toString());
    }
  });

  if (!bill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              {bill.description}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="paid-date">Data do Pagamento *</Label>
              <Input
                id="paid-date"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="paid-amount">Valor Pago *</Label>
              <Input
                id="paid-amount"
                type="number"
                step="0.01"
                min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                required
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Valor previsto: R$ {bill.amount.toFixed(2)}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="receipt">Comprovante (Opcional)</Label>
              <input
                ref={fileInputRef}
                id="receipt"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {receiptFile ? (
                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{receiptFile.name}</span>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={handleRemoveFile}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Anexar Comprovante (PDF ou Imagem)
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: PDF, JPG, PNG (máx. 5MB)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Confirmar Pagamento</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};