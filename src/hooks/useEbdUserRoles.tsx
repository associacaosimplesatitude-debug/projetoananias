import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseEbdUserRolesProps {
  userId?: string;
  churchId?: string;
}

export function useEbdUserRoles({ userId, churchId }: UseEbdUserRolesProps = {}) {
  // Get all roles for a user in a specific church
  const { data: roles, isLoading, refetch } = useQuery({
    queryKey: ["ebd-user-roles", userId, churchId],
    queryFn: async () => {
      if (!userId || !churchId) return [];

      const { data, error } = await supabase
        .from("ebd_user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("church_id", churchId);

      if (error) {
        console.error("Error fetching EBD user roles:", error);
        return [];
      }

      return data.map((r) => r.role);
    },
    enabled: !!userId && !!churchId,
  });

  const hasRole = (role: "professor" | "superintendente") => {
    return roles?.includes(role) ?? false;
  };

  const isSuperintendente = hasRole("superintendente");
  const isProfessor = hasRole("professor");

  return {
    roles: roles ?? [],
    hasRole,
    isSuperintendente,
    isProfessor,
    isLoading,
    refetch,
  };
}

// Hook to check if current user can manage roles (is a superintendente)
export function useCanManageEbdRoles(churchId?: string) {
  const { data: canManage, isLoading } = useQuery({
    queryKey: ["can-manage-ebd-roles", churchId],
    queryFn: async () => {
      if (!churchId) return false;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Check if user is superintendente via ebd_clientes
      const { data: clienteData } = await supabase
        .from("ebd_clientes")
        .select("id")
        .eq("superintendente_user_id", user.id)
        .eq("id", churchId)
        .eq("status_ativacao_ebd", true)
        .maybeSingle();

      if (clienteData) return true;

      // Check if user has superintendente role in ebd_user_roles
      const { data: roleData } = await supabase
        .from("ebd_user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("church_id", churchId)
        .eq("role", "superintendente")
        .maybeSingle();

      return !!roleData;
    },
    enabled: !!churchId,
  });

  return { canManage: canManage ?? false, isLoading };
}
