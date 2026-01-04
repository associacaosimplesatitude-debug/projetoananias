import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SuperOldCheckVia = "ebd_clientes" | "ebd_leads_reativacao" | null;

export async function checkSuperintendenteOld() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const uid = user?.id ?? null;
  const email = user?.email ?? null;

  if (!uid) {
    return {
      uid: null,
      email,
      isSuperOld: false,
      via: null as SuperOldCheckVia,
      source: "src/components/DashboardRedirect.tsx (ebd_clientes OR ebd_leads_reativacao)",
    };
  }

  // 1) Mesma checagem do DashboardRedirect (superintendente por ebd_clientes)
  const { data: clienteData, error: clienteError } = await supabase
    .from("ebd_clientes")
    .select("id")
    .eq("superintendente_user_id", uid)
    .eq("status_ativacao_ebd", true)
    .limit(1);

  if (clienteError) {
    console.error("[ROLES] old check (ebd_clientes) error=", clienteError);
  }

  if (clienteData && clienteData.length > 0) {
    return {
      uid,
      email,
      isSuperOld: true,
      via: "ebd_clientes" as const,
      source: "src/components/DashboardRedirect.tsx (ebd_clientes OR ebd_leads_reativacao)",
    };
  }

  // 2) Mesma checagem do DashboardRedirect (superintendente por lead via email)
  if (email) {
    const normalizedEmail = email.toLowerCase().trim();

    const { data: leadData, error: leadError } = await supabase
      .from("ebd_leads_reativacao")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (leadError) {
      console.error("[ROLES] old check (ebd_leads_reativacao) error=", leadError);
    }

    if (leadData) {
      return {
        uid,
        email,
        isSuperOld: true,
        via: "ebd_leads_reativacao" as const,
        source: "src/components/DashboardRedirect.tsx (ebd_clientes OR ebd_leads_reativacao)",
      };
    }
  }

  return {
    uid,
    email,
    isSuperOld: false,
    via: null as SuperOldCheckVia,
    source: "src/components/DashboardRedirect.tsx (ebd_clientes OR ebd_leads_reativacao)",
  };
}

export function useIsSuperintendenteOld() {
  const { data, isLoading } = useQuery({
    queryKey: ["ebd-superintendente-old"],
    queryFn: checkSuperintendenteOld,
  });

  return {
    uid: data?.uid ?? null,
    email: data?.email ?? null,
    isSuperOld: data?.isSuperOld ?? false,
    via: data?.via ?? null,
    source: data?.source ?? "src/components/DashboardRedirect.tsx (ebd_clientes OR ebd_leads_reativacao)",
    isLoading,
  };
}
