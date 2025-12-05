import { useEffect, useState } from 'react';
import { X, BookOpen, ShoppingCart } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

// Helper to get the current trimester start date
const getTrimesterStart = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
  let trimesterMonth: number;
  if (month < 3) trimesterMonth = 0; // January
  else if (month < 6) trimesterMonth = 3; // April
  else if (month < 9) trimesterMonth = 6; // July
  else trimesterMonth = 9; // October
  
  return new Date(year, trimesterMonth, 1).toISOString().split('T')[0];
};

export const EBDTrimesterBanner = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Only show on EBD routes for clients
  const isEBDRoute = location.pathname.startsWith('/ebd');
  
  // Fetch user profile for name and church_id
  const { data: profile } = useQuery({
    queryKey: ['profile-for-banner', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, church_id')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && isEBDRoute && role !== 'admin',
  });

  // Check if banner was dismissed this trimester
  const { data: dismissal, isLoading: dismissalLoading } = useQuery({
    queryKey: ['banner-dismissal', user?.id, profile?.church_id],
    queryFn: async () => {
      if (!user?.id || !profile?.church_id) return null;
      const trimesterStart = getTrimesterStart();
      const { data, error } = await supabase
        .from('ebd_banner_dismissals')
        .select('id')
        .eq('user_id', user.id)
        .eq('church_id', profile.church_id)
        .eq('trimester_start', trimesterStart)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!profile?.church_id && isEBDRoute && role !== 'admin',
  });

  // Fetch planejamentos and escalas to calculate remaining lessons
  const { data: remainingLessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ['remaining-lessons-banner', profile?.church_id],
    queryFn: async () => {
      if (!profile?.church_id) return null;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Get active planejamentos (not finished yet)
      const { data: planejamentos, error } = await supabase
        .from('ebd_planejamento')
        .select(`
          id,
          data_inicio,
          data_termino,
          revista:revista_id (
            id,
            titulo,
            num_licoes
          )
        `)
        .eq('church_id', profile.church_id)
        .gte('data_termino', todayStr);
      
      if (error) throw error;
      if (!planejamentos || planejamentos.length === 0) return null;

      // Get all escalas for this church to count completed lessons
      const { data: escalas, error: escalasError } = await supabase
        .from('ebd_escalas')
        .select('id, data, turma_id, sem_aula')
        .eq('church_id', profile.church_id)
        .lte('data', todayStr);
      
      if (escalasError) throw escalasError;

      // Find active planejamentos and calculate remaining lessons based on escalas
      let minRemaining = Infinity;
      let activePlanWithMinRemaining: any = null;

      for (const plan of planejamentos) {
        if (!plan.revista) continue;
        
        const totalLessons = plan.revista.num_licoes || 13;
        const startDate = plan.data_inicio;
        const endDate = plan.data_termino;
        
        // Count escalas within this plan's date range (excluding sem_aula)
        const planEscalas = (escalas || []).filter((e: any) => 
          e.data >= startDate && 
          e.data <= endDate && 
          !e.sem_aula
        );
        
        const completedLessons = planEscalas.length;
        const remaining = Math.max(0, totalLessons - completedLessons);
        
        if (remaining < minRemaining) {
          minRemaining = remaining;
          activePlanWithMinRemaining = {
            ...plan,
            remaining: remaining,
            total: totalLessons,
          };
        }
      }

      return activePlanWithMinRemaining ? {
        remaining: activePlanWithMinRemaining.remaining,
        total: activePlanWithMinRemaining.total,
      } : null;
    },
    enabled: !!profile?.church_id && isEBDRoute && role !== 'admin',
  });

  useEffect(() => {
    if (!dismissalLoading && !lessonsLoading) {
      setIsLoading(false);
    }
  }, [dismissalLoading, lessonsLoading]);

  const handleDismiss = async () => {
    if (!user?.id || !profile?.church_id) return;
    
    const trimesterStart = getTrimesterStart();
    
    try {
      await supabase
        .from('ebd_banner_dismissals')
        .insert({
          user_id: user.id,
          church_id: profile.church_id,
          trimester_start: trimesterStart,
        });
      
      setIsDismissed(true);
    } catch (error) {
      console.error('Error dismissing banner:', error);
    }
  };

  const handleViewCatalog = () => {
    navigate('/ebd/catalogo');
  };

  // Don't show for admins
  if (role === 'admin') return null;

  // Don't show if not on EBD route
  if (!isEBDRoute) return null;

  // Don't show while loading
  if (isLoading) return null;

  // Don't show if already dismissed this trimester
  if (dismissal || isDismissed) return null;

  // Don't show if no remaining lessons data or more than 4 lessons remaining
  if (!remainingLessons || remainingLessons.remaining > 4) return null;

  // Get the user's full name
  const fullName = profile?.full_name || 'Superintendente';

  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-orange-500 border-orange-600">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-white" />
          <AlertDescription className="text-white font-medium">
            Paz do Senhor, <span className="font-bold">{fullName}</span>! 
            O trimestre está chegando ao fim. Sua turma tem{' '}
            <span className="font-bold">{remainingLessons.remaining} {remainingLessons.remaining === 1 ? 'lição restante' : 'lições restantes'}</span>. 
            Não perca tempo, garanta o material para o próximo ciclo!
          </AlertDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleViewCatalog}
            className="bg-white text-orange-600 hover:bg-orange-50 font-semibold"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Ver Catálogo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 p-0 hover:bg-orange-600 text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
};
