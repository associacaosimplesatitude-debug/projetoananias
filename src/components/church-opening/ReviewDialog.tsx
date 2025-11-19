import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  stageId: number;
  subTaskId: string;
}

export const ReviewDialog = ({
  open,
  onOpenChange,
  churchId,
  stageId,
  subTaskId,
}: ReviewDialogProps) => {
  const [showErrorInput, setShowErrorInput] = useState(false);
  const [errorDescription, setErrorDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleApprove = async () => {
    if (!churchId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('church_stage_progress')
        .upsert({
          church_id: churchId,
          stage_id: stageId,
          sub_task_id: subTaskId,
          status: 'pending_approval',
        }, {
          onConflict: 'church_id,stage_id,sub_task_id',
        });

      if (error) throw error;

      toast({
        title: 'Sucesso!',
        description: 'Documentos aprovados e aguardando confirmação final',
      });

      onOpenChange(false);
      setShowErrorInput(false);
    } catch (error) {
      console.error('Error approving:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível aprovar os documentos',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!churchId || !errorDescription.trim()) {
      toast({
        title: 'Atenção',
        description: 'Por favor, descreva o erro encontrado',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('church_stage_progress')
        .upsert({
          church_id: churchId,
          stage_id: stageId,
          sub_task_id: subTaskId,
          status: 'needs_adjustment',
          rejection_reason: errorDescription,
        }, {
          onConflict: 'church_id,stage_id,sub_task_id',
        });

      if (error) throw error;

      toast({
        title: 'Reportado',
        description: 'Erro reportado ao administrador',
      });

      onOpenChange(false);
      setShowErrorInput(false);
      setErrorDescription('');
    } catch (error) {
      console.error('Error rejecting:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível reportar o erro',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setShowErrorInput(false);
    setErrorDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conferir Documentos</DialogTitle>
        </DialogHeader>

        {!showErrorInput ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você revisou os documentos anexados pelo administrador?
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => setShowErrorInput(true)}
                disabled={submitting}
              >
                <X className="h-4 w-4" />
                Encontrei um Erro
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleApprove}
                disabled={submitting}
              >
                <Check className="h-4 w-4" />
                Tudo Certo!
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Descreva o erro encontrado:
              </label>
              <Textarea
                value={errorDescription}
                onChange={(e) => setErrorDescription(e.target.value)}
                placeholder="Descreva detalhadamente o que está errado..."
                className="min-h-[100px]"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowErrorInput(false);
                  setErrorDescription('');
                }}
                disabled={submitting}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleReject}
                disabled={submitting || !errorDescription.trim()}
              >
                Enviar Erro
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
