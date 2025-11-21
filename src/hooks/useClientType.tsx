import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useClientType = () => {
  const { user } = useAuth();
  const [clientType, setClientType] = useState<'igreja' | 'associacao' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClientType = async () => {
      try {
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: churchData, error } = await supabase
          .from('churches')
          .select('client_type')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching client type:', error);
        }

        if (churchData) {
          setClientType(churchData.client_type as 'igreja' | 'associacao');
        }
      } catch (error) {
        console.error('Error fetching client type:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClientType();
  }, [user]);

  return { clientType, loading };
};
