import { useAuth } from "@/hooks/useAuth";

const SUPERADMIN_EMAILS = new Set<string>([
  "admin@contabilidade.com",
]);

export function useIsSuperadmin() {
  const { user, loading } = useAuth() as { user: { email?: string | null } | null; loading?: boolean };
  const email = (user?.email || "").trim().toLowerCase();
  const isSuperadmin = !!email && SUPERADMIN_EMAILS.has(email);
  return { isSuperadmin, isLoading: !!loading };
}
