import { Stage } from '@/types/church-opening';
import { Lock, Info, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubTaskItem } from './SubTaskItem';
import { cn } from '@/lib/utils';

interface StageCardProps {
  stage: Stage;
  onInfoClick: () => void;
  onPayment: (subTaskId: string) => void;
  onFormOpen: () => void;
}

export const StageCard = ({ stage, onInfoClick, onPayment, onFormOpen }: StageCardProps) => {
  const isLocked = stage.status === 'locked';
  const isCompleted = stage.status === 'completed';

  return (
    <Card
      className={cn(
        'transition-all duration-300',
        isLocked && 'opacity-60 grayscale',
        isCompleted && 'border-success/50 bg-success/5'
      )}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            {isLocked && <Lock className="h-5 w-5 text-muted-foreground shrink-0" />}
            {isCompleted && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
            <CardTitle className={cn(
              'text-lg',
              isCompleted && 'text-success'
            )}>
              {stage.name}
            </CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onInfoClick}
            disabled={isLocked}
            className="gap-2 shrink-0"
          >
            <Info className="h-4 w-4" />
            Como funciona
          </Button>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold">
            {stage.subTasks.filter(t => t.status === 'completed').length} / {stage.subTasks.length}
          </span>
          <span>tarefas concluídas</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {stage.subTasks.map((subTask) => (
          <SubTaskItem
            key={subTask.id}
            subTask={subTask}
            onPayment={() => onPayment(subTask.id)}
            onFormOpen={onFormOpen}
            disabled={isLocked}
          />
        ))}
      </CardContent>
    </Card>
  );
};
