import { Stage } from '@/types/church-opening';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info, Lock } from 'lucide-react';
import { AdminSubTaskItem } from './AdminSubTaskItem';

interface AdminStageCardProps {
  stage: Stage;
  churchId?: string;
  onInfoClick: () => void;
  onViewData: (subTaskId: string) => void;
  onApprove: (stageId: number, subTaskId: string) => void;
  onReject: (stageId: number, subTaskId: string) => void;
}

export const AdminStageCard = ({
  stage,
  churchId,
  onInfoClick,
  onViewData,
  onApprove,
  onReject,
}: AdminStageCardProps) => {
  const isLocked = stage.status === 'locked';
  const completedTasks = stage.subTasks.filter((t) => t.status === 'completed').length;
  const totalTasks = stage.subTasks.length;

  return (
    <Card className={`relative ${isLocked ? 'opacity-60' : ''}`}>
      {isLocked && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-lg">
          <div className="text-center space-y-2">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-medium">
              Complete a etapa anterior
            </p>
          </div>
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-bold text-lg">{stage.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className="text-sm text-muted-foreground">
                {completedTasks} de {totalTasks} concluídas
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onInfoClick}
            className="shrink-0"
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {stage.subTasks.map((subTask) => (
          <AdminSubTaskItem
            key={subTask.id}
            subTask={subTask}
            stageId={stage.id}
            churchId={churchId}
            onViewData={onViewData}
            onApprove={(subTaskId) => onApprove(stage.id, subTaskId)}
            onReject={(subTaskId) => onReject(stage.id, subTaskId)}
          />
        ))}
      </CardContent>
    </Card>
  );
};
