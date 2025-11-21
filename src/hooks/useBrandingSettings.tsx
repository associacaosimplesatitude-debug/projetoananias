import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BRANDING_ID = '00000000-0000-0000-0000-000000000001';

export interface BrandingSettings {
  id: string;
  nav_logo_url: string | null;
  login_logo_url: string | null;
  nav_background_color: string;
  accent_color: string;
  nav_text_color: string;
}

export const useBrandingSettings = () => {
  return useQuery({
    queryKey: ['branding-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branding_settings')
        .select('*')
        .eq('id', BRANDING_ID)
        .single();

      if (error) throw error;
      return data as BrandingSettings;
    },
  });
};

export const useUpdateBrandingSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<BrandingSettings>) => {
      const { data, error } = await supabase
        .from('branding_settings')
        .update(settings)
        .eq('id', BRANDING_ID)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding-settings'] });
      toast.success('Configurações atualizadas com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar configurações: ' + error.message);
    },
  });
};

export const useUploadBrandingImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, type }: { file: File; type: 'nav' | 'login' }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('branding-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('branding-assets')
        .getPublicUrl(filePath);

      const field = type === 'nav' ? 'nav_logo_url' : 'login_logo_url';
      
      const { error: updateError } = await supabase
        .from('branding_settings')
        .update({ [field]: publicUrl })
        .eq('id', BRANDING_ID);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding-settings'] });
      toast.success('Logo atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao fazer upload: ' + error.message);
    },
  });
};
