import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StageCard } from '@/components/church-opening/StageCard';
import { PaymentModal } from '@/components/church-opening/PaymentModal';
import { InfoModal } from '@/components/church-opening/InfoModal';
import { FileUploadDialog } from '@/components/church-opening/FileUploadDialog';
import { PresidentFormDialog } from '@/components/church-opening/PresidentFormDialog';
import { ScheduleDialog } from '@/components/church-opening/ScheduleDialog';
import { DirectorFormDialog } from '@/components/church-opening/DirectorFormDialog';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useChurchData } from '@/hooks/useChurchData';
import { useStageInfo } from '@/hooks/useStageInfo';
import { useStageProgress } from '@/hooks/useStageProgress';
import { Stage } from '@/types/church-opening';

const Index = () => {
  const navigate = useNavigate();
  const { churchId, loading: churchLoading } = useChurchData();
  const { getStageInfo } = useStageInfo();
  const { stages, loading: progressLoading, updateProgress } = useStageProgress(churchId);
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

  const [presidentFormModal, setPresidentFormModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<{
    open: boolean;
    stageId: number;
    subTaskId: string;
  }>({
    open: false,
    stageId: 0,
    subTaskId: '',
  });

  const [directorModal, setDirectorModal] = useState(false);

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

  const handlePaymentSuccess = async () => {
    const subTaskId = paymentModal.subTaskId;
    const stage = stages.find(s => s.subTasks.some(t => t.id === subTaskId));
    
    if (stage && churchId) {
      try {
        await updateProgress(stage.id, subTaskId, 'completed');
        toast.success('Pagamento confirmado!');
      } catch (error) {
        toast.error('Erro ao atualizar progresso');
      }
    }
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

  const handleAction = async (stageId: number, subTaskId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    const subTask = stage?.subTasks.find((t) => t.id === subTaskId);

    if (!subTask) return;

    // Handle president form (subtask 1-1)
    if (subTaskId === '1-1') {
      if (!churchId) {
        toast.error('Erro ao carregar dados da igreja. Tente novamente.');
        return;
      }
      setPresidentFormModal(true);
      return;
    }

    // Handle contract signature (subtask 1-2)
    if (subTaskId === '1-2') {
      if (!churchId) {
        toast.error('Erro ao carregar dados da igreja. Tente novamente.');
        return;
      }
      try {
        await updateProgress(stageId, subTaskId, 'pending_approval');
        toast.success('Assinatura registrada! Aguardando aprovação.');
      } catch (error) {
        console.error('Error updating contract status:', error);
        toast.error('Erro ao registrar assinatura');
      }
      return;
    }

    // Handle schedule action (subtask 2-3)
    if (subTaskId === '2-3') {
      if (!churchId) {
        toast.error('Erro ao carregar dados da igreja. Tente novamente.');
        return;
      }
      setScheduleModal({
        open: true,
        stageId,
        subTaskId,
      });
      return;
    }

    // Handle director form (subtask 4-1)
    if (subTaskId === '4-1') {
      if (!churchId) {
        toast.error('Erro ao carregar dados da igreja. Tente novamente.');
        return;
      }
      setDirectorModal(true);
      return;
    }

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

  const handleUploadSuccess = async () => {
    const { stageId, subTaskId } = uploadModal;
    
    if (churchId) {
      try {
        await updateProgress(stageId, subTaskId, 'completed');
        toast.success('Documento enviado com sucesso!');
      } catch (error) {
        toast.error('Erro ao atualizar progresso');
      }
    }
  };

  const handlePresidentFormSuccess = async () => {
    if (churchId) {
      try {
        await updateProgress(1, '1-1', 'completed');
        toast.success('Status atualizado!');
      } catch (error) {
        console.error('Error updating progress:', error);
      }
    }
  };

  const isLoading = churchLoading || progressLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background">
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Carregando dados...</p>
          </div>
        </div>
      ) : !churchId ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4 p-8 bg-card rounded-lg border">
            <h3 className="text-xl font-semibold">Nenhuma igreja encontrada</h3>
            <p className="text-muted-foreground">Por favor, entre em contato com o administrador.</p>
          </div>
        </div>
      ) : (
        <>
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

      {churchId && (
        <PresidentFormDialog
          open={presidentFormModal}
          onOpenChange={setPresidentFormModal}
          churchId={churchId}
          onSuccess={handlePresidentFormSuccess}
        />
      )}

      {churchId && (
        <>
          <ScheduleDialog
            open={scheduleModal.open}
            onOpenChange={(open) => setScheduleModal({ ...scheduleModal, open })}
            churchId={churchId}
            stageId={scheduleModal.stageId}
            subTaskId={scheduleModal.subTaskId}
            onSuccess={async () => {
              await updateProgress(scheduleModal.stageId, scheduleModal.subTaskId, 'pending_approval');
            }}
          />

          <DirectorFormDialog
            open={directorModal}
            onOpenChange={setDirectorModal}
            churchId={churchId}
            onSuccess={() => {
              toast.success('Diretor adicionado com sucesso!');
            }}
          />
        </>
      )}
        </>
      )}
    </div>
  );
};

export default Index;
