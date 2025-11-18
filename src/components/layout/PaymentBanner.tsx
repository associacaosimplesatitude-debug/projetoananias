import { useEffect, useState } from 'react';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export const PaymentBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [daysUntilDue, setDaysUntilDue] = useState<number | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!user) return;

      // Verificar se o banner foi dismissado hoje
      const dismissedDate = localStorage.getItem('paymentBannerDismissed');
      const today = new Date().toDateString();
      if (dismissedDate === today) {
        setIsDismissed(true);
        setIsLoading(false);
        return;
      }

      // Buscar o perfil do usuário para obter a igreja
      const { data: profile } = await supabase
        .from('profiles')
        .select('church_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.church_id) {
        setIsLoading(false);
        return;
      }

      // Buscar a última fatura em aberto ou vencida
      const { data: receivables } = await supabase
        .from('accounts_receivable')
        .select('due_date, status')
        .eq('church_id', profile.church_id)
        .in('status', ['open', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(1);

      if (receivables && receivables.length > 0) {
        const dueDate = new Date(receivables[0].due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        setDaysUntilDue(diffDays);

        // Se passou de 5 dias de atraso, redirecionar para página de bloqueio
        if (diffDays < -5) {
          navigate('/payment-blocked');
        }
      }

      setIsLoading(false);
    };

    checkPaymentStatus();
  }, [user, navigate]);

  const handleDismiss = () => {
    const today = new Date().toDateString();
    localStorage.setItem('paymentBannerDismissed', today);
    setIsDismissed(true);
  };

  if (isLoading || isDismissed || daysUntilDue === null) {
    return null;
  }

  // Mostrar banner laranja 5 dias antes
  if (daysUntilDue > 0 && daysUntilDue <= 5) {
    return (
      <Alert className="rounded-none border-x-0 border-t-0 bg-orange-500/10 border-orange-500/50">
        <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-orange-900 dark:text-orange-200 font-medium">
            ⚠️ Faltam {daysUntilDue} {daysUntilDue === 1 ? 'dia' : 'dias'} para o vencimento da sua fatura
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0 hover:bg-orange-500/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Mostrar banner vermelho de 1 a 5 dias após vencimento
  if (daysUntilDue < 0 && daysUntilDue >= -5) {
    const daysOverdue = Math.abs(daysUntilDue);
    return (
      <Alert className="rounded-none border-x-0 border-t-0 bg-destructive/10 border-destructive/50">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-destructive font-medium">
            🚨 Sua fatura venceu há {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0 hover:bg-destructive/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};
