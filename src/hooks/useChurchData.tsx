import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useChurchData = () => {
  const [churchId, setChurchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChurchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: church } = await supabase
          .from('churches')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (church) {
          setChurchId(church.id);
        }
      } catch (error) {
        console.error('Error fetching church data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChurchData();
  }, []);

  return { churchId, loading };
};
