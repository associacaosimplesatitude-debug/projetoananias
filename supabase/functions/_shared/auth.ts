// Shared authentication / authorization helpers for edge functions.
// Never trust body flags (e.g. `internalCall`) or the public anon key as a trust signal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

/**
 * Server-to-server / cron trust signal.
 * Requires a shared secret header that a browser never sends.
 */
export function isInternalCall(req: Request): boolean {
  const secret = Deno.env.get("INTERNAL_WEBHOOK_SECRET");
  if (!secret) return false;
  const provided = req.headers.get("x-internal-secret") ?? req.headers.get("x-cron-secret");
  return !!provided && provided === secret;
}

export type AuthedCaller = {
  userId: string;
  email: string | null;
  roles: string[];
};

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Validates the bearer JWT and loads the caller's roles. Throws AuthError. */
export async function requireUser(
  req: Request,
  // deno-lint-ignore no-explicit-any
  admin: any = getAdminClient(),
): Promise<AuthedCaller> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new AuthError("Unauthorized");

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) throw new AuthError("Unauthorized");

  // The service role key / anon key are NOT valid user credentials.
  if (
    token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    token === Deno.env.get("SUPABASE_ANON_KEY")
  ) {
    throw new AuthError("Unauthorized");
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new AuthError("Unauthorized");

  const { data: roleRows } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    roles: (roleRows ?? []).map((r: { role: string }) => r.role),
  };
}

/** Validates the JWT and requires at least one of the given roles. Throws AuthError. */
export async function requireRole(
  req: Request,
  allowed: string[],
  // deno-lint-ignore no-explicit-any
  admin: any = getAdminClient(),
): Promise<AuthedCaller> {
  const caller = await requireUser(req, admin);
  const ok = caller.roles.some((r) => allowed.includes(r));
  if (!ok) throw new AuthError("Sem permissão para executar esta ação", 403);
  return caller;
}

/** Allows either an internal (shared-secret) call or a caller holding one of the roles. */
export async function requireInternalOrRole(
  req: Request,
  allowed: string[],
  // deno-lint-ignore no-explicit-any
  admin: any = getAdminClient(),
): Promise<AuthedCaller | null> {
  if (isInternalCall(req)) return null;
  return await requireRole(req, allowed, admin);
}

export function authErrorResponse(err: unknown, corsHeaders: Record<string, string>) {
  const status = err instanceof AuthError ? err.status : 401;
  const message = err instanceof Error ? err.message : "Unauthorized";
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
