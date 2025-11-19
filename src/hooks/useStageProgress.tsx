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
        // Fetch church's current stage
        const { data: churchData, error: churchError } = await supabase
          .from('churches')
          .select('current_stage')
          .eq('id', churchId)
          .single();

        if (churchError) {
          console.error('Error fetching church:', churchError);
        }

        const currentStage = churchData?.current_stage || 1;

        // Fetch progress data
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

          // Update stages with progress from database and stage status based on current_stage
          setStages(prevStages =>
            prevStages.map(stage => ({
              ...stage,
              status: stage.id < currentStage 
                ? 'completed' 
                : stage.id === currentStage 
                ? 'active' 
                : 'locked',
              subTasks: stage.subTasks.map(task => ({
                ...task,
                status: (progressMap.get(task.id) as any) || task.status,
              })),
            }))
          );
        } else {
          // No progress data yet, just update stage status
          setStages(prevStages =>
            prevStages.map(stage => ({
              ...stage,
              status: stage.id < currentStage 
                ? 'completed' 
                : stage.id === currentStage 
                ? 'active' 
                : 'locked',
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

    // Listen for changes in churches table (current_stage updates)
    const churchChannel = supabase
      .channel('church-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'churches',
          filter: `id=eq.${churchId}`,
        },
        (payload) => {
          console.log('Church updated:', payload);
          
          if (payload.new && 'current_stage' in payload.new) {
            const currentStage = (payload.new as any).current_stage || 1;
            
            setStages(prevStages =>
              prevStages.map(stage => ({
                ...stage,
                status: stage.id < currentStage 
                  ? 'completed' 
                  : stage.id === currentStage 
                  ? 'active' 
                  : 'locked',
              }))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(churchChannel);
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
