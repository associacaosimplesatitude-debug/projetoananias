import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StageCard } from '@/components/church-opening/StageCard';
import { PaymentModal } from '@/components/church-opening/PaymentModal';
import { InfoModal } from '@/components/church-opening/InfoModal';
import { initialStages } from '@/data/stages';
import { Stage } from '@/types/church-opening';
import { Church, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const navigate = useNavigate();
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
  }>({
    open: false,
    title: '',
    content: '',
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
    setInfoModal({
      open: true,
      title: stage.name,
      content: stage.info,
    });
  };

  const handleFormOpen = () => {
    navigate('/diretoria-form');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary text-primary-foreground">
                <Church className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Abertura de Igreja</h1>
                <p className="text-sm text-muted-foreground">Acompanhe seu processo</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Precisa de ajuda?
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
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
      />
    </div>
  );
};

export default Index;
