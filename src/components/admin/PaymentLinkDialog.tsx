import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

const paymentLinkSchema = z.object({
  link: z.string()
    .trim()
    .url({ message: 'Por favor, insira uma URL válida' })
    .max(500, { message: 'O link deve ter no máximo 500 caracteres' })
});

interface PaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  stageId: number;
  subTaskId: string;
  subTaskName: string;
  currentLink?: string;
}

export const PaymentLinkDialog = ({
  open,
  onOpenChange,
  churchId,
  stageId,
  subTaskId,
  subTaskName,
  currentLink = '',
}: PaymentLinkDialogProps) => {
  const [link, setLink] = useState(currentLink);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');

    // Validate link
    const validation = paymentLinkSchema.safeParse({ link });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setSaving(true);

    try {
      const { error: dbError } = await supabase
        .from('church_stage_progress')
        .upsert({
          church_id: churchId,
          stage_id: stageId,
          sub_task_id: subTaskId,
          payment_link: link.trim(),
          status: 'pending', // Keep or set appropriate status
        }, {
          onConflict: 'church_id,stage_id,sub_task_id',
        });

      if (dbError) {
        throw dbError;
      }

      toast.success('Link de pagamento salvo com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving payment link:', error);
      toast.error('Erro ao salvar link de pagamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Link de Pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-link">Link de Pagamento</Label>
            <Input
              id="payment-link"
              type="url"
              placeholder="https://exemplo.com/pagamento"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setError('');
              }}
              disabled={saving}
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Cole o link de pagamento que será exibido para o cliente
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!link || saving}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Link className="h-4 w-4" />
                  Salvar Link
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
