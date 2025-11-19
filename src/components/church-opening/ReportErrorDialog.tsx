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

interface ReportErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (errorDescription: string) => void;
  taskName: string;
}

export function ReportErrorDialog({
  open,
  onOpenChange,
  onConfirm,
  taskName,
}: ReportErrorDialogProps) {
  const [errorDescription, setErrorDescription] = useState('');

  const handleConfirm = () => {
    if (errorDescription.trim()) {
      onConfirm(errorDescription);
      setErrorDescription('');
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setErrorDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reportar Erro</DialogTitle>
          <DialogDescription>
            Tarefa: <span className="font-medium">{taskName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="error">Descreva o erro encontrado *</Label>
            <Textarea
              id="error"
              placeholder="Descreva qual erro você encontrou nos documentos..."
              value={errorDescription}
              onChange={(e) => setErrorDescription(e.target.value)}
              className="min-h-[120px]"
              required
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {errorDescription.length}/1000 caracteres
            </p>
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
            disabled={!errorDescription.trim()}
          >
            Enviar Erro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
