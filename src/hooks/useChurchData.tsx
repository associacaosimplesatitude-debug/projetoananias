import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Church {
  id: string;
  church_name: string;
  process_status: string;
  current_stage: number;
}

export const useChurchData = () => {
  const [church, setChurch] = useState<Church | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChurchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log('No user found');
          setLoading(false);
          return;
        }

        const { data: churchData, error } = await supabase
          .from('churches')
          .select('id, church_name, process_status, current_stage')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching church:', error);
        }

        if (churchData) {
          console.log('Church found:', churchData.id);
          setChurch(churchData);
        } else {
          console.log('No church found for user');
        }
      } catch (error) {
        console.error('Error fetching church data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChurchData();
  }, []);

  return { church, churchId: church?.id || null, loading };
};
