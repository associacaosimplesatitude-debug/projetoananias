import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve the active EBD church context.
 * - Admin context: use clientId from route
 * - Promoted superintendent: ebd_user_roles
 * - Legacy superintendent: ebd_clientes.superintendente_user_id
 * - Church owner: churches.user_id
 */
export function useEbdChurchId(clientId?: string) {
  return useQuery<{ id: string } | null>({
    queryKey: ["ebd-church-id", clientId],
    queryFn: async () => {
      if (clientId) return { id: clientId };

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // 1) Promoted superintendent
      const { data: promotedRole, error: promotedError } = await supabase
        .from("ebd_user_roles")
        .select("church_id")
        .eq("user_id", user.id)
        .eq("role", "superintendente")
        .limit(1)
        .maybeSingle();
      if (promotedError) throw promotedError;
      if (promotedRole?.church_id) return { id: promotedRole.church_id };

      // 2) Legacy superintendent (EBD client)
      const { data: ebdCliente, error: ebdClienteError } = await supabase
        .from("ebd_clientes")
        .select("id")
        .eq("superintendente_user_id", user.id)
        .eq("status_ativacao_ebd", true)
        .maybeSingle();
      if (ebdClienteError) throw ebdClienteError;
      if (ebdCliente?.id) return { id: ebdCliente.id };

      // 3) Church owner
      const { data: church, error: churchError } = await supabase
        .from("churches")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (churchError) throw churchError;
      if (church?.id) return { id: church.id };

      return null;
    },
  });
}
