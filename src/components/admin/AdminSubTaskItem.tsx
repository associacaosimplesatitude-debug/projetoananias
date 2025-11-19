import { SubTask } from '@/types/church-opening';
import { Button } from '@/components/ui/button';
import { Check, Clock, Eye, X, CheckCircle2 } from 'lucide-react';
import { DocumentsList } from '@/components/church-opening/DocumentsList';

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

  return (
    <div className={`border rounded-lg p-4 transition-all ${getStatusColor(subTask.status)}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          {getStatusIcon(subTask.status)}
          <span className="text-sm font-medium">{subTask.name}</span>
        </div>
        
        <div className="flex items-center gap-2">
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
  );
};
