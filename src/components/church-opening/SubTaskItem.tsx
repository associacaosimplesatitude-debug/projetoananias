import { SubTask } from '@/types/church-opening';
import { Check, Circle, Clock, CreditCard, FileText, Send, PenTool, Upload, Calendar, FileCheck, Eye, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SubTaskItemProps {
  subTask: SubTask;
  onPayment?: () => void;
  onFormOpen?: () => void;
  onAction?: () => void;
  disabled?: boolean;
}

export const SubTaskItem = ({ subTask, onPayment, onFormOpen, onAction, disabled }: SubTaskItemProps) => {
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
        return <Check className="h-5 w-5 text-success" />;
      case 'in_progress':
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
        return 'border-warning/20 bg-warning/5';
      default:
        return 'border-border bg-background';
    }
  };

  return (
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
        {subTask.paymentType === 'fixed' && subTask.status !== 'completed' && (
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

        {subTask.paymentType === 'variable' && subTask.status !== 'completed' && (
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

        {subTask.actionType && subTask.status !== 'completed' && !subTask.paymentType && !subTask.requiresForm && (
          <Button
            size="sm"
            variant="default"
            onClick={onAction}
            disabled={disabled}
            className="gap-2 whitespace-nowrap flex-shrink-0"
          >
            {getActionIcon()}
            <span className="inline-block">{subTask.actionLabel}</span>
          </Button>
        )}
      </div>
    </div>
  );
};
