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
          console.log('No user found');
          setLoading(false);
          return;
        }

        const { data: church, error } = await supabase
          .from('churches')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching church:', error);
        }

        if (church) {
          console.log('Church found:', church.id);
          setChurchId(church.id);
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

  return { churchId, loading };
};
