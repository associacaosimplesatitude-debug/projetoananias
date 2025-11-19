import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface StageInfo {
  id: string;
  stage_id: number;
  info_text: string;
  video_url?: string;
}

export const useStageInfo = () => {
  const [stageInfos, setStageInfos] = useState<StageInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStageInfos = async () => {
    try {
      const { data, error } = await supabase
        .from('stage_info_texts')
        .select('*')
        .order('stage_id');

      if (error) throw error;
      setStageInfos(data || []);
    } catch (error) {
      console.error('Error fetching stage infos:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar informações das etapas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStageInfos();
  }, []);

  const getStageInfo = (stageId: number) => {
    return stageInfos.find((info) => info.stage_id === stageId);
  };

  const updateStageInfo = async (stageId: number, infoText: string, videoUrl?: string) => {
    try {
      const existingInfo = stageInfos.find((info) => info.stage_id === stageId);

      if (existingInfo) {
        const { error } = await supabase
          .from('stage_info_texts')
          .update({
            info_text: infoText,
            video_url: videoUrl || null,
          })
          .eq('id', existingInfo.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stage_info_texts')
          .insert({
            stage_id: stageId,
            info_text: infoText,
            video_url: videoUrl || null,
          });

        if (error) throw error;
      }

      await fetchStageInfos();

      toast({
        title: 'Sucesso',
        description: 'Informações atualizadas com sucesso',
      });

      return true;
    } catch (error) {
      console.error('Error updating stage info:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar informações',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    stageInfos,
    loading,
    getStageInfo,
    updateStageInfo,
    refreshStageInfos: fetchStageInfos,
  };
};
