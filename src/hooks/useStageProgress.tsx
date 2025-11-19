import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Stage } from '@/types/church-opening';
import { initialStages } from '@/data/stages';

interface StageProgress {
  stage_id: number;
  sub_task_id: string;
  status: string;
}

export const useStageProgress = (churchId: string | null) => {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!churchId) {
      setLoading(false);
      return;
    }

    const fetchProgress = async () => {
      try {
        const { data: progressData, error } = await supabase
          .from('church_stage_progress')
          .select('*')
          .eq('church_id', churchId);

        if (error) {
          console.error('Error fetching progress:', error);
          return;
        }

        // Map progress data to stages
        if (progressData && progressData.length > 0) {
          const progressMap = new Map<string, string>();
          progressData.forEach((progress: StageProgress) => {
            progressMap.set(progress.sub_task_id, progress.status);
          });

          // Update stages with progress from database
          setStages(prevStages =>
            prevStages.map(stage => ({
              ...stage,
              subTasks: stage.subTasks.map(task => ({
                ...task,
                status: (progressMap.get(task.id) as any) || task.status,
              })),
            }))
          );
        }
      } catch (error) {
        console.error('Error in fetchProgress:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();

    // Set up realtime subscription for progress updates
    const channel = supabase
      .channel('stage-progress-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'church_stage_progress',
          filter: `church_id=eq.${churchId}`,
        },
        (payload) => {
          console.log('Progress updated:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newProgress = payload.new as StageProgress;
            
            setStages(prevStages =>
              prevStages.map(stage => ({
                ...stage,
                subTasks: stage.subTasks.map(task =>
                  task.id === newProgress.sub_task_id
                    ? { ...task, status: newProgress.status as any }
                    : task
                ),
              }))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [churchId]);

  const updateProgress = async (stageId: number, subTaskId: string, status: string) => {
    if (!churchId) return;

    try {
      const { error } = await supabase.from('church_stage_progress').upsert(
        {
          church_id: churchId,
          stage_id: stageId,
          sub_task_id: subTaskId,
          status,
        },
        {
          onConflict: 'church_id,stage_id,sub_task_id',
        }
      );

      if (error) {
        console.error('Error updating progress:', error);
        throw error;
      }

      // Update local state immediately for better UX
      setStages(prevStages =>
        prevStages.map(stage => ({
          ...stage,
          subTasks: stage.subTasks.map(task =>
            task.id === subTaskId ? { ...task, status: status as any } : task
          ),
        }))
      );
    } catch (error) {
      console.error('Error in updateProgress:', error);
      throw error;
    }
  };

  return { stages, loading, updateProgress };
};
