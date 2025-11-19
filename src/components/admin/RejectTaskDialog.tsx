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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface RejectTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  taskName: string;
  churchName: string;
}

export function RejectTaskDialog({
  open,
  onOpenChange,
  onConfirm,
  taskName,
  churchName,
}: RejectTaskDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason);
      setReason('');
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reprovar Tarefa</DialogTitle>
          <DialogDescription>
            Igreja: <span className="font-medium">{churchName}</span>
            <br />
            Tarefa: <span className="font-medium">{taskName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da reprovação *</Label>
            <Textarea
              id="reason"
              placeholder="Descreva o motivo da reprovação e as correções necessárias..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[120px]"
              required
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim()}
          >
            <X className="mr-2 h-4 w-4" />
            Reprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
