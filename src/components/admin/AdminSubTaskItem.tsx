import { SubTask } from '@/types/church-opening';
import { Button } from '@/components/ui/button';
import { Check, Clock, Eye, X, CheckCircle2, Paperclip, Link } from 'lucide-react';
import { DocumentsList } from '@/components/church-opening/DocumentsList';
import { AttachContractDialog } from './AttachContractDialog';
import { PaymentLinkDialog } from './PaymentLinkDialog';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminSubTaskItemProps {
  subTask: SubTask;
  stageId: number;
  churchId?: string;
  onViewData: (subTaskId: string) => void;
  onApprove: (subTaskId: string) => void;
  onReject: (subTaskId: string) => void;
}

export const AdminSubTaskItem = ({ 
  subTask, 
  stageId, 
  churchId,
  onViewData,
  onApprove,
  onReject
}: AdminSubTaskItemProps) => {
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [paymentLinkDialogOpen, setPaymentLinkDialogOpen] = useState(false);
  const [currentPaymentLink, setCurrentPaymentLink] = useState('');

  const isPaymentTask = subTask.id === '1-3'; // PAGAR MENSALIDADE

  // Fetch payment link if this is a payment task
  useEffect(() => {
    if (isPaymentTask && churchId) {
      const fetchPaymentLink = async () => {
        const { data } = await supabase
          .from('church_stage_progress')
          .select('payment_link')
          .eq('church_id', churchId)
          .eq('stage_id', stageId)
          .eq('sub_task_id', subTask.id)
          .maybeSingle();

        if (data?.payment_link) {
          setCurrentPaymentLink(data.payment_link);
        }
      };

      fetchPaymentLink();

      // Set up realtime subscription for payment link updates
      const channel = supabase
        .channel('payment-link-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'church_stage_progress',
            filter: `church_id=eq.${churchId}`,
          },
          (payload) => {
            const updated = payload.new as any;
            if (
              updated.stage_id === stageId &&
              updated.sub_task_id === subTask.id &&
              updated.payment_link
            ) {
              setCurrentPaymentLink(updated.payment_link);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isPaymentTask, churchId, stageId, subTask.id]);
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'in_progress':
      case 'pending_approval':
        return <Clock className="h-5 w-5 text-warning" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-success/20 bg-success/5';
      case 'in_progress':
      case 'pending_approval':
        return 'border-warning/20 bg-warning/5';
      case 'needs_adjustment':
        return 'border-destructive/20 bg-destructive/5';
      default:
        return 'border-muted';
    }
  };

  const showActions = subTask.status !== 'completed';
  const showViewData = subTask.actionType === 'send' || subTask.actionType === 'upload';
  const isContractSignature = subTask.id === '1-2'; // ASSINATURA DO CONTRATO

  return (
    <>
      <AttachContractDialog
        open={attachDialogOpen}
        onOpenChange={setAttachDialogOpen}
        churchId={churchId || ''}
        stageId={stageId}
        subTaskId={subTask.id}
        subTaskName={subTask.name}
      />
      <PaymentLinkDialog
        open={paymentLinkDialogOpen}
        onOpenChange={setPaymentLinkDialogOpen}
        churchId={churchId || ''}
        stageId={stageId}
        subTaskId={subTask.id}
        subTaskName={subTask.name}
        currentLink={currentPaymentLink}
      />
    <div className={`border rounded-lg p-4 transition-all ${getStatusColor(subTask.status)}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          {getStatusIcon(subTask.status)}
          <span className="text-sm font-medium">{subTask.name}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {isContractSignature && churchId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAttachDialogOpen(true)}
              className="gap-2"
            >
              <Paperclip className="h-4 w-4" />
              Anexar Contrato
            </Button>
          )}

          {isPaymentTask && churchId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaymentLinkDialogOpen(true)}
              className="gap-2"
            >
              <Link className="h-4 w-4" />
              {currentPaymentLink ? 'Editar Link' : 'Adicionar Link'}
            </Button>
          )}
          
          {showViewData && churchId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewData(subTask.id)}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Ver Dados
            </Button>
          )}
          
          {showActions && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onApprove(subTask.id)}
                className="gap-2 text-success border-success/20 hover:bg-success/10"
              >
                <Check className="h-4 w-4" />
                Aprovar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReject(subTask.id)}
                className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
                Reprovar
              </Button>
            </>
          )}
        </div>
      </div>

      {subTask.status === 'needs_adjustment' && (
        <div className="mt-2 text-sm text-destructive">
          Ajuste necessário
        </div>
      )}

      {churchId && (subTask.actionType === 'upload' || subTask.actionType === 'send') && (
        <div className="mt-3">
          <DocumentsList
            churchId={churchId}
            stageId={stageId}
            subTaskId={subTask.id}
          />
        </div>
      )}
    </div>
    </>
  );
};
