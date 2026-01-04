import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEbdSuperintendenteEffective(churchId?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["ebd-superintendente-effective", churchId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const uid = user?.id ?? null;
      if (!uid) {
        return {
          uid: null,
          isSuperOld: false,
          isSuperNew: false,
          effective: false,
        };
      }

      // (A) Método antigo: ebd_clientes (mesma fonte usada no fluxo atual do dashboard)
      const { data: clienteData, error: clienteError } = await supabase
        .from("ebd_clientes")
        .select("id")
        .eq("superintendente_user_id", uid)
        .eq("status_ativacao_ebd", true)
        .limit(1);

      if (clienteError) {
        console.error("[ROLES] old check error=", clienteError);
      }

      const isSuperOld = !!(clienteData && clienteData.length > 0);

      // (B) Método novo: role em ebd_user_roles (usar RPC security definer para evitar recursão de RLS)
      let isSuperNew = false;
      if (churchId) {
        const { data: roleOk, error: roleError } = await supabase.rpc("has_ebd_role", {
          _user_id: uid,
          _church_id: churchId,
          _role: "superintendente",
        });

        if (roleError) {
          console.error("[ROLES] new check error=", roleError);
        }

        isSuperNew = !!roleOk;
      }

      return {
        uid,
        isSuperOld,
        isSuperNew,
        effective: isSuperOld || isSuperNew,
      };
    },
  });

  return {
    uid: data?.uid ?? null,
    isSuperOld: data?.isSuperOld ?? false,
    isSuperNew: data?.isSuperNew ?? false,
    effective: data?.effective ?? false,
    isLoading,
  };
}
