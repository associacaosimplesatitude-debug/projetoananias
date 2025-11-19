import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StageCard } from '@/components/church-opening/StageCard';
import { PaymentModal } from '@/components/church-opening/PaymentModal';
import { InfoModal } from '@/components/church-opening/InfoModal';
import { FileUploadDialog } from '@/components/church-opening/FileUploadDialog';
import { initialStages } from '@/data/stages';
import { Stage } from '@/types/church-opening';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useChurchData } from '@/hooks/useChurchData';
import { useStageInfo } from '@/hooks/useStageInfo';

const Index = () => {
  const navigate = useNavigate();
  const { churchId, loading: churchLoading } = useChurchData();
  const { getStageInfo } = useStageInfo();
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    amount: number;
    description: string;
    subTaskId: string;
  }>({
    open: false,
    amount: 0,
    description: '',
    subTaskId: '',
  });
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
  const [uploadModal, setUploadModal] = useState<{
    open: boolean;
    documentType: string;
    stageId: number;
    subTaskId: string;
  }>({
    open: false,
    documentType: '',
    stageId: 0,
    subTaskId: '',
  });

  const handlePayment = (stageId: number, subTaskId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    const subTask = stage?.subTasks.find((t) => t.id === subTaskId);

    if (subTask && subTask.paymentAmount) {
      setPaymentModal({
        open: true,
        amount: subTask.paymentAmount,
        description: subTask.name,
        subTaskId,
      });
    }
  };

  const handlePaymentSuccess = () => {
    const subTaskId = paymentModal.subTaskId;
    
    setStages((prev) =>
      prev.map((stage) => ({
        ...stage,
        subTasks: stage.subTasks.map((task) =>
          task.id === subTaskId ? { ...task, status: 'completed' as const } : task
        ),
      }))
    );
  };

  const handleInfoClick = (stage: Stage) => {
    const stageInfo = getStageInfo(stage.id);
    setInfoModal({
      open: true,
      title: stage.name,
      content: stageInfo?.info_text || stage.info,
      videoUrl: stageInfo?.video_url || undefined,
    });
  };

  const handleFormOpen = () => {
    navigate('/diretoria-form');
  };

  const handleAction = (stageId: number, subTaskId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    const subTask = stage?.subTasks.find((t) => t.id === subTaskId);

    if (!subTask) return;

    // Handle upload actions
    if (subTask.actionType === 'upload' || subTask.actionType === 'send') {
      if (!churchId) {
        toast.error('Erro ao carregar dados da igreja. Tente novamente.');
        return;
      }
      setUploadModal({
        open: true,
        documentType: subTask.name,
        stageId,
        subTaskId,
      });
    } else {
      // Other actions
      toast.info(`Ação: ${subTask.actionLabel || 'Clicado'} - ${subTask.name}`);
    }
  };

  const handleUploadSuccess = () => {
    const { stageId, subTaskId } = uploadModal;
    
    // Mark subtask as completed
    setStages((prev) =>
      prev.map((stage) => ({
        ...stage,
        subTasks: stage.subTasks.map((task) =>
          task.id === subTaskId ? { ...task, status: 'completed' as const } : task
        ),
      }))
    );

    toast.success('Documento enviado com sucesso!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center space-y-2">
          <h2 className="text-3xl font-bold">Processo de Abertura</h2>
          <p className="text-muted-foreground">
            Siga as etapas abaixo para concluir o processo de abertura da sua igreja
          </p>
        </div>

        {/* Progress Overview */}
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

        {/* Stages Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {stages.map((stage) => (
            <StageCard
              key={stage.id}
              stage={stage}
              onInfoClick={() => handleInfoClick(stage)}
              onPayment={(subTaskId) => handlePayment(stage.id, subTaskId)}
              onFormOpen={handleFormOpen}
              onAction={(subTaskId) => handleAction(stage.id, subTaskId)}
            />
          ))}
        </div>
      </main>

      {/* Modals */}
      <PaymentModal
        open={paymentModal.open}
        onOpenChange={(open) => setPaymentModal((prev) => ({ ...prev, open }))}
        amount={paymentModal.amount}
        description={paymentModal.description}
        onSuccess={handlePaymentSuccess}
      />

      <InfoModal
        open={infoModal.open}
        onOpenChange={(open) => setInfoModal((prev) => ({ ...prev, open }))}
        title={infoModal.title}
        content={infoModal.content}
        videoUrl={infoModal.videoUrl}
      />

      {churchId && (
        <FileUploadDialog
          open={uploadModal.open}
          onOpenChange={(open) => setUploadModal((prev) => ({ ...prev, open }))}
          documentType={uploadModal.documentType}
          stageId={uploadModal.stageId}
          subTaskId={uploadModal.subTaskId}
          churchId={churchId}
          onUploadSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
};

export default Index;
