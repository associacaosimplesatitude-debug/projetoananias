import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminStageCard } from '@/components/admin/AdminStageCard';
import { ViewDataDialog } from '@/components/admin/ViewDataDialog';
import { RejectTaskDialog } from '@/components/admin/RejectTaskDialog';
import { InfoModal } from '@/components/church-opening/InfoModal';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useStageProgress } from '@/hooks/useStageProgress';
import { useStageInfo } from '@/hooks/useStageInfo';
import { Stage } from '@/types/church-opening';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AdminClientView() {
  const { id: churchId } = useParams<{ id: string }>();
  const { stages, loading, updateProgress } = useStageProgress(churchId);
  const { getStageInfo } = useStageInfo();
  const [churchName, setChurchName] = useState('');
  
  const [infoModal, setInfoModal] = useState<{
    open: boolean;
    title: string;
    content: string;
    videoUrl?: string;
  }>({
    open: false,
    title: '',
    content: '',
    videoUrl: '',
  });

  const [viewDataModal, setViewDataModal] = useState<{
    open: boolean;
    stageId: number;
    subTaskId: string;
    subTaskName: string;
  }>({
    open: false,
    stageId: 0,
    subTaskId: '',
    subTaskName: '',
  });

  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    stageId: number;
    subTaskId: string;
    subTaskName: string;
  }>({
    open: false,
    stageId: 0,
    subTaskId: '',
    subTaskName: '',
  });

  useEffect(() => {
    const fetchChurchName = async () => {
      if (!churchId) return;
      
      const { data } = await supabase
        .from('churches')
        .select('church_name')
        .eq('id', churchId)
        .single();
      
      if (data) {
        setChurchName(data.church_name);
      }
    };
    
    fetchChurchName();
  }, [churchId]);

  const handleInfoClick = (stage: Stage) => {
    const stageInfo = getStageInfo(stage.id);
    setInfoModal({
      open: true,
      title: stage.name,
      content: stageInfo?.info_text || stage.info,
      videoUrl: stageInfo?.video_url || undefined,
    });
  };

  const handleViewData = (stageId: number, subTaskId: string) => {
    const stage = stages.find(s => s.id === stageId);
    const subTask = stage?.subTasks.find(t => t.id === subTaskId);
    
    if (subTask) {
      setViewDataModal({
        open: true,
        stageId,
        subTaskId,
        subTaskName: subTask.name,
      });
    }
  };

  const handleApprove = async (stageId: number, subTaskId: string) => {
    if (!churchId) return;

    try {
      await updateProgress(stageId, subTaskId, 'completed');
      toast.success('Tarefa aprovada!');
    } catch (error) {
      console.error('Error approving task:', error);
      toast.error('Erro ao aprovar tarefa');
    }
  };

  const handleReject = (stageId: number, subTaskId: string) => {
    const stage = stages.find(s => s.id === stageId);
    const subTask = stage?.subTasks.find(t => t.id === subTaskId);
    
    if (subTask) {
      setRejectModal({
        open: true,
        stageId,
        subTaskId,
        subTaskName: subTask.name,
      });
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!churchId) return;

    const { stageId, subTaskId } = rejectModal;
    
    try {
      const { error } = await supabase
        .from('church_stage_progress')
        .update({ 
          status: 'needs_adjustment',
          rejection_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('church_id', churchId)
        .eq('stage_id', stageId)
        .eq('sub_task_id', subTaskId);

      if (error) throw error;

      await updateProgress(stageId, subTaskId, 'needs_adjustment');
      
      toast.success('Tarefa reprovada');
      setRejectModal({ open: false, stageId: 0, subTaskId: '', subTaskName: '' });
    } catch (error) {
      console.error('Error rejecting task:', error);
      toast.error('Erro ao reprovar tarefa');
    }
  };

  const handleFinishStage = async (stageId: number) => {
    if (!churchId) return;

    try {
      const { error } = await supabase
        .from('churches')
        .update({ current_stage: stageId })
        .eq('id', churchId);

      if (error) throw error;

      toast.success(`Etapa ${stageId} finalizada!`);
    } catch (error) {
      console.error('Error finishing stage:', error);
      toast.error('Erro ao finalizar etapa');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center gap-4">
          <Link to="/admin/clients">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 text-center space-y-2">
            <h2 className="text-3xl font-bold">
              Processo de Abertura - {churchName || 'Carregando...'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Visão do Administrador
            </p>
          </div>
        </div>

        <div className="mb-8 flex items-center justify-center gap-2 flex-wrap">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center">
              <div
                className={`
                  flex items-center justify-center h-10 w-10 rounded-full font-semibold text-sm
                  transition-all duration-300
                  ${
                    stage.status === 'completed'
                      ? 'bg-success text-success-foreground'
                      : stage.status === 'active'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }
                `}
              >
                {stage.id}
              </div>
              {index < stages.length - 1 && (
                <ArrowRight className="h-5 w-5 mx-2 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {stages.map((stage) => (
            <AdminStageCard
              key={stage.id}
              stage={stage}
              churchId={churchId}
              onInfoClick={() => handleInfoClick(stage)}
              onViewData={(subTaskId) => handleViewData(stage.id, subTaskId)}
              onApprove={handleApprove}
              onReject={handleReject}
              onFinishStage={() => handleFinishStage(stage.id)}
            />
          ))}
        </div>
      </main>

      <InfoModal
        open={infoModal.open}
        onOpenChange={(open) => setInfoModal((prev) => ({ ...prev, open }))}
        title={infoModal.title}
        content={infoModal.content}
        videoUrl={infoModal.videoUrl}
      />

      {churchId && (
        <>
          <ViewDataDialog
            open={viewDataModal.open}
            onOpenChange={(open) => setViewDataModal((prev) => ({ ...prev, open }))}
            churchId={churchId}
            stageId={viewDataModal.stageId}
            subTaskId={viewDataModal.subTaskId}
            subTaskName={viewDataModal.subTaskName}
          />

          <RejectTaskDialog
            open={rejectModal.open}
            onOpenChange={(open) => setRejectModal((prev) => ({ ...prev, open }))}
            taskName={rejectModal.subTaskName}
            churchName={churchName}
            onConfirm={handleRejectConfirm}
          />
        </>
      )}
    </div>
  );
}