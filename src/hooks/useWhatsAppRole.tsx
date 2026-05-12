import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type WhatsAppRole = "superadmin" | "gerente" | "vendedor" | "none";

interface WhatsAppRoleData {
  role: WhatsAppRole;
  vendedorId: string | null;
  isSuperAdmin: boolean;
  isGerente: boolean;
  isVendedor: boolean;
  loading: boolean;
}

export function useWhatsAppRole(): WhatsAppRoleData {
  const { user, role, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-role-vendedor", user?.email?.toLowerCase()],
    queryFn: async () => {
      if (!user?.email) return { vendedorId: null as string | null };
      const { data: v } = await supabase
        .from("vendedores")
        .select("id")
        .ilike("email", user.email.toLowerCase().trim())
        .maybeSingle();
      return { vendedorId: v?.id ?? null };
    },
    enabled: !!user?.email && !authLoading,
  });

  const isSuperAdmin = role === "admin";
  const isGerente = role === "gerente_ebd" && !isSuperAdmin;
  const vendedorId = data?.vendedorId ?? null;
  const isVendedor = !isSuperAdmin && !isGerente && !!vendedorId;

  let resolvedRole: WhatsAppRole = "none";
  if (isSuperAdmin) resolvedRole = "superadmin";
  else if (isGerente) resolvedRole = "gerente";
  else if (isVendedor) resolvedRole = "vendedor";

  return {
    role: resolvedRole,
    vendedorId,
    isSuperAdmin,
    isGerente,
    isVendedor,
    loading: authLoading || isLoading,
  };
}
