import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIsSuperadmin() {
  const { user, loading: authLoading } = useAuth();

  const { data: isSuperadmin = false, isLoading: roleLoading } = useQuery({
    queryKey: ["is-superadmin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("has_role", {
        _user_id: user!.id,
        _role: "superadmin",
      });
      if (error) {
        console.error("[useIsSuperadmin] erro:", error);
        return false;
      }
      return data === true;
    },
  });

  return {
    isSuperadmin,
    isLoading: authLoading || roleLoading,
  };
}
