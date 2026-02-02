import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useRoyaltiesAuth() {
  const { user, role } = useAuth();
  const [hasRoyaltiesAccess, setHasRoyaltiesAccess] = useState(false);
  const [isAutor, setIsAutor] = useState(false);
  const [autorId, setAutorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      checkAccess();
    } else {
      setHasRoyaltiesAccess(false);
      setIsAutor(false);
      setAutorId(null);
      setLoading(false);
    }
  }, [user?.id, role]);

  const checkAccess = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Check if user has admin, gerente_royalties or financeiro role
      const adminAccess = role === 'admin' || role === 'gerente_royalties' || role === 'financeiro';
      setHasRoyaltiesAccess(adminAccess);

      // Check if user is an autor
      const { data: autorData, error } = await supabase
        .from('royalties_autores')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error checking autor status:', error);
      } else if (autorData) {
        setIsAutor(true);
        setAutorId(autorData.id);
      } else {
        setIsAutor(false);
        setAutorId(null);
      }
    } catch (error) {
      console.error('Error checking royalties access:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    hasRoyaltiesAccess,
    isAutor,
    autorId,
    loading,
    refresh: checkAccess,
  };
}
