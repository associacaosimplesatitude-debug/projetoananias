import { SubTask } from '@/types/church-opening';
import { Check, Circle, Clock, CreditCard, FileText, Send, PenTool, Upload, Calendar, FileCheck, Eye, Download, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DocumentsList } from './DocumentsList';
import { ReviewDialog } from './ReviewDialog';
import { FileUploadDialog } from './FileUploadDialog';
import { useChurchData } from '@/hooks/useChurchData';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SubTaskItemProps {
  subTask: SubTask;
  onPayment?: () => void;
  onFormOpen?: () => void;
  onAction?: () => void;
  disabled?: boolean;
  stageId: number;
}

export const SubTaskItem = ({ subTask, onPayment, onFormOpen, onAction, disabled, stageId }: SubTaskItemProps) => {
  const { churchId } = useChurchData();
  const showDocumentsList = (subTask.actionType === 'upload' || subTask.actionType === 'send') && churchId;
  const [hasContract, setHasContract] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [signatureUploadDialogOpen, setSignatureUploadDialogOpen] = useState(false);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [hasPrintDocuments, setHasPrintDocuments] = useState(false);
  const isContractSignature = subTask.id === '1-2';
  const isMonthlyPayment = subTask.id === '1-3';
  const isDocumentReview = subTask.id === '4-3'; // CONFERÊNCIA DOCUMENTOS
  const isDocumentSend = subTask.id === '4-4'; // ENVIO DOCUMENTOS
  const isBoardSignature = subTask.id === '4-5'; // ASSINATURA DIRETORIA
  const isOfficeReturn = subTask.id === '4-6'; // RETORNO ESCRITÓRIO
  const isLawyerSignature = subTask.id === '4-7'; // ASSINATURA ADVOGADO

  // Check if contract is attached for contract signature task
  useEffect(() => {
    if (isContractSignature && churchId) {
      const checkContract = async () => {
        const { data, error } = await supabase
          .from('church_documents')
          .select('id')
          .eq('church_id', churchId)
          .eq('stage_id', stageId)
          .eq('sub_task_id', subTask.id)
          .eq('document_type', 'contract')
          .limit(1);

        if (!error && data && data.length > 0) {
          setHasContract(true);
        }
      };

      checkContract();

      // Set up realtime subscription for contract uploads
      const channel = supabase
        .channel('contract-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'church_documents',
            filter: `church_id=eq.${churchId}`,
          },
          (payload) => {
            const newDoc = payload.new as any;
            if (
              newDoc.stage_id === stageId &&
              newDoc.sub_task_id === subTask.id &&
              newDoc.document_type === 'contract'
            ) {
              setHasContract(true);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isContractSignature, churchId, stageId, subTask.id]);

  // Check for payment link for monthly payment task and lawyer signature
  useEffect(() => {
    if ((isMonthlyPayment || isLawyerSignature) && churchId) {
      const checkPaymentLink = async () => {
        const { data, error } = await supabase
          .from('church_stage_progress')
          .select('payment_link')
          .eq('church_id', churchId)
          .eq('stage_id', stageId)
          .eq('sub_task_id', subTask.id)
          .maybeSingle();

        if (!error && data?.payment_link) {
          setPaymentLink(data.payment_link);
        }
      };

      checkPaymentLink();

      // Set up realtime subscription for payment link updates
      const channel = supabase
        .channel('payment-link-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
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
              setPaymentLink(updated.payment_link);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isMonthlyPayment, isLawyerSignature, churchId, stageId, subTask.id]);

  // Check for documents in document review task
  useEffect(() => {
    if (isDocumentReview && churchId) {
      const checkDocuments = async () => {
        const { data, error } = await supabase
          .from('church_documents')
          .select('id')
          .eq('church_id', churchId)
          .eq('stage_id', stageId)
          .eq('sub_task_id', subTask.id)
          .eq('document_type', 'conferencia')
          .limit(1);

        if (!error && data && data.length > 0) {
          setHasDocuments(true);
        }
      };

      checkDocuments();

      // Set up realtime subscription for document uploads
      const channel = supabase
        .channel('review-docs-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'church_documents',
            filter: `church_id=eq.${churchId}`,
          },
          (payload) => {
            const newDoc = payload.new as any;
            if (
              newDoc.stage_id === stageId &&
              newDoc.sub_task_id === subTask.id &&
              newDoc.document_type === 'conferencia'
            ) {
              setHasDocuments(true);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isDocumentReview, churchId, stageId, subTask.id]);

  // Check for print documents in document send task
  useEffect(() => {
    if (isDocumentSend && churchId) {
      const checkPrintDocuments = async () => {
        const { data, error } = await supabase
          .from('church_documents')
          .select('id')
          .eq('church_id', churchId)
          .eq('stage_id', stageId)
          .eq('sub_task_id', subTask.id)
          .eq('document_type', 'impressao')
          .limit(1);

        if (!error && data && data.length > 0) {
          setHasPrintDocuments(true);
        }
      };

      checkPrintDocuments();

      // Set up realtime subscription for document uploads
      const channel = supabase
        .channel('print-docs-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'church_documents',
            filter: `church_id=eq.${churchId}`,
          },
          (payload) => {
            const newDoc = payload.new as any;
            if (
              newDoc.stage_id === stageId &&
              newDoc.sub_task_id === subTask.id &&
              newDoc.document_type === 'impressao'
            ) {
              setHasPrintDocuments(true);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isDocumentSend, churchId, stageId, subTask.id]);

  const getActionIcon = () => {
    switch (subTask.actionType) {
      case 'send':
        return <Send className="h-4 w-4" />;
      case 'sign':
        return <PenTool className="h-4 w-4" />;
      case 'pay':
        return <CreditCard className="h-4 w-4" />;
      case 'upload':
        return <Upload className="h-4 w-4" />;
      case 'schedule':
        return <Calendar className="h-4 w-4" />;
      case 'check':
        return <FileCheck className="h-4 w-4" />;
      case 'view':
        return <Eye className="h-4 w-4" />;
      case 'download':
        return <Download className="h-4 w-4" />;
      case 'open':
        return <ExternalLink className="h-4 w-4" />;
      default:
        return null;
    }
  };
  const getStatusIcon = () => {
    switch (subTask.status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'in_progress':
      case 'pending_approval':
        return <Clock className="h-5 w-5 text-warning" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (subTask.status) {
      case 'completed':
        return 'border-success/20 bg-success/5';
      case 'in_progress':
      case 'pending_approval':
        return 'border-warning/20 bg-warning/5';
      case 'needs_adjustment':
        return 'border-destructive/20 bg-destructive/5';
      default:
        return 'border-border bg-background';
    }
  };

  return (
    <div>
      <ReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        churchId={churchId || ''}
        stageId={stageId}
        subTaskId={subTask.id}
      />
      <FileUploadDialog
        open={signatureUploadDialogOpen}
        onOpenChange={setSignatureUploadDialogOpen}
        churchId={churchId || ''}
        stageId={stageId}
        subTaskId={subTask.id}
        documentType="assinaturas_diretoria"
        onUploadSuccess={async () => {
          // Update status to pending_approval after upload
          if (!churchId) return;
          
          try {
            const { error } = await supabase
              .from('church_stage_progress')
              .upsert({
                church_id: churchId,
                stage_id: stageId,
                sub_task_id: subTask.id,
                status: 'pending_approval',
              }, {
                onConflict: 'church_id,stage_id,sub_task_id',
              });

            if (error) throw error;

            toast({
              title: 'Sucesso!',
              description: 'Assinaturas enviadas para aprovação',
            });
          } catch (error) {
            console.error('Error updating status:', error);
            toast({
              title: 'Atenção',
              description: 'Assinaturas enviadas, mas houve erro ao atualizar o status',
              variant: 'destructive',
            });
          }
        }}
        allowMultiple={true}
      />
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border p-3 transition-all',
          getStatusColor(),
          disabled && 'opacity-50'
        )}
      >
        <div className="flex items-center gap-3 flex-1">
          {getStatusIcon()}
          <span className={cn(
            'text-sm font-medium',
            subTask.status === 'completed' && 'text-success',
            subTask.status === 'in_progress' && 'text-warning'
          )}>
            {subTask.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isMonthlyPayment && subTask.status !== 'completed' && (
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                if (paymentLink) {
                  window.open(paymentLink, '_blank');
                }
              }}
              disabled={disabled || !paymentLink}
              className="gap-2 whitespace-nowrap flex-shrink-0"
            >
              <CreditCard className="h-4 w-4" />
              <span className="inline-block">
                {paymentLink ? 'Pagar Mensalidade' : 'Aguardando Link'}
              </span>
            </Button>
          )}

          {isLawyerSignature && subTask.status !== 'completed' && (
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                if (paymentLink) {
                  window.open(paymentLink, '_blank');
                }
              }}
              disabled={disabled || !paymentLink}
              className="gap-2 whitespace-nowrap flex-shrink-0"
            >
              <CreditCard className="h-4 w-4" />
              <span className="inline-block">
                {paymentLink ? 'Pagar Advogado' : 'Aguardando Link'}
              </span>
            </Button>
          )}

          {!isMonthlyPayment && !isLawyerSignature && subTask.paymentType === 'fixed' && subTask.status !== 'completed' && (
            <Button
              size="sm"
              variant="default"
              onClick={onPayment}
              disabled={disabled}
              className="gap-2 whitespace-nowrap flex-shrink-0"
            >
              <CreditCard className="h-4 w-4" />
              <span className="inline-block">{subTask.actionLabel || `Pagar R$ ${subTask.paymentAmount}`}</span>
            </Button>
          )}

          {!isMonthlyPayment && !isLawyerSignature && subTask.paymentType === 'variable' && subTask.status !== 'completed' && (
            <Button
              size="sm"
              variant="default"
              onClick={onPayment}
              disabled={disabled || !subTask.paymentAmount}
              className="gap-2 whitespace-nowrap flex-shrink-0"
            >
              <CreditCard className="h-4 w-4" />
              <span className="inline-block">{subTask.paymentAmount ? `Pagar R$ ${subTask.paymentAmount}` : 'Aguardando valor'}</span>
            </Button>
          )}

          {subTask.requiresForm && subTask.status !== 'completed' && (
            <Button
              size="sm"
              variant="default"
              onClick={onFormOpen}
              disabled={disabled}
              className="gap-2 whitespace-nowrap flex-shrink-0"
            >
              <FileText className="h-4 w-4" />
              <span className="inline-block">Preencher</span>
            </Button>
          )}

          {subTask.actionType && subTask.status !== 'completed' && !subTask.paymentType && !subTask.requiresForm && !isDocumentReview && (
            <Button
              size="sm"
              variant="default"
              onClick={onAction}
              disabled={disabled || (isContractSignature && !hasContract)}
              className="gap-2 whitespace-nowrap flex-shrink-0"
            >
              {getActionIcon()}
              <span className="inline-block">
                {isContractSignature && !hasContract ? 'Aguardando Contrato' : subTask.actionLabel}
              </span>
            </Button>
          )}

          {isDocumentReview && hasDocuments && subTask.status !== 'completed' && subTask.status !== 'pending_approval' && (
            <Button
              size="sm"
              variant="default"
              onClick={() => setReviewDialogOpen(true)}
              disabled={disabled}
              className="gap-2 whitespace-nowrap flex-shrink-0"
            >
              <FileCheck className="h-4 w-4" />
              <span className="inline-block">Conferir Documentos</span>
            </Button>
          )}

          {isDocumentSend && hasPrintDocuments && subTask.status !== 'completed' && (
            <Button
              size="sm"
              variant="default"
              onClick={async () => {
                if (!churchId) return;
                
                try {
                  const { data: documents, error } = await supabase
                    .from('church_documents')
                    .select('file_path, file_name')
                    .eq('church_id', churchId)
                    .eq('stage_id', stageId)
                    .eq('sub_task_id', subTask.id)
                    .eq('document_type', 'impressao');

                  if (error) throw error;

                  for (const doc of documents || []) {
                    const { data, error: downloadError } = await supabase.storage
                      .from('church-documents')
                      .download(doc.file_path);

                    if (downloadError) throw downloadError;

                    const url = URL.createObjectURL(data);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = doc.file_name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                } catch (error) {
                  console.error('Error downloading files:', error);
                  toast({
                    title: 'Erro',
                    description: 'Não foi possível baixar os arquivos',
                    variant: 'destructive',
                  });
                }
              }}
              disabled={disabled}
              className="gap-2 whitespace-nowrap flex-shrink-0"
            >
              <Download className="h-4 w-4" />
              <span className="inline-block">Baixar e Imprimir</span>
            </Button>
          )}

          {isBoardSignature && subTask.status !== 'completed' && subTask.status !== 'pending_approval' && (
            <Button
              size="sm"
              variant="default"
              onClick={() => setSignatureUploadDialogOpen(true)}
              disabled={disabled}
              className="gap-2 whitespace-nowrap flex-shrink-0"
            >
              <Upload className="h-4 w-4" />
              <span className="inline-block">Enviar Assinaturas</span>
            </Button>
          )}
        </div>
      </div>

      {subTask.status === 'pending_approval' && (
        <div className="mt-2 text-sm text-warning px-3">
          Aguardando aprovação final do administrador
        </div>
      )}

      {subTask.status === 'needs_adjustment' && (
        <div className="mt-2 text-sm text-destructive px-3">
          Ajuste necessário - verifique as observações
        </div>
      )}

      {isOfficeReturn && subTask.status !== 'completed' && (
        <div className="mt-2 text-sm text-muted-foreground px-3 py-2 bg-muted/50 rounded-md">
          Por favor, envie os documentos assinados para o nosso endereço. Avisaremos assim que recebermos.
        </div>
      )}

      {(showDocumentsList || isDocumentReview || isDocumentSend || isBoardSignature) && churchId && (
        <DocumentsList
          churchId={churchId!}
          stageId={stageId}
          subTaskId={subTask.id}
        />
      )}
    </div>
  );
};
