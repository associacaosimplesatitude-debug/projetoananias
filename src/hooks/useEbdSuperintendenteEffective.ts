import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checkSuperintendenteOld } from "@/hooks/useIsSuperintendenteOld";

export function useEbdSuperintendenteEffective(churchId?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["ebd-superintendente-effective", churchId],
    queryFn: async () => {
      const oldResult = await checkSuperintendenteOld();

      const uid = oldResult.uid;
      if (!uid) {
        return {
          uid: null,
          isSuperOld: false,
          isSuperNew: false,
          effective: false,
          old_check_source: oldResult.source,
        };
      }

      const isSuperOld = oldResult.isSuperOld;

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
        old_check_source: oldResult.source,
      };
    },
  });

  return {
    uid: data?.uid ?? null,
    isSuperOld: data?.isSuperOld ?? false,
    isSuperNew: data?.isSuperNew ?? false,
    effective: data?.effective ?? false,
    old_check_source:
      data?.old_check_source ?? "src/components/DashboardRedirect.tsx (ebd_clientes OR ebd_leads_reativacao)",
    isLoading,
  };
}
