// Shared MP OAuth token refresh logic.
// Used by mp-create-order-and-pay (reactive on 401) and refresh-mp-tokens (proactive cron).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RefreshedToken {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

/**
 * Refresh the MP OAuth access_token for a given collector_id.
 * Returns null on failure. Persists new tokens to mp_connected_accounts.
 */
export async function refreshSellerToken(
  supabaseAdmin: ReturnType<typeof createClient>,
  collectorId: string,
): Promise<RefreshedToken | null> {
  const MP_CLIENT_ID = Deno.env.get("MP_CLIENT_ID");
  const MP_CLIENT_SECRET = Deno.env.get("MP_CLIENT_SECRET");
  if (!MP_CLIENT_ID || !MP_CLIENT_SECRET) {
    console.error("[mp-refresh] missing MP_CLIENT_ID or MP_CLIENT_SECRET");
    return null;
  }

  const { data: rows, error } = await supabaseAdmin
    .from("mp_connected_accounts")
    .select("id, refresh_token")
    .eq("collector_id", collectorId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !rows || rows.length === 0) {
    console.error("[mp-refresh] account not found", { collectorId, error });
    return null;
  }

  const row = rows[0] as { id: string; refresh_token: string | null };
  if (!row.refresh_token) {
    console.error("[mp-refresh] no refresh_token stored", { collectorId });
    return null;
  }

  let res: Response;
  try {
    res = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: MP_CLIENT_ID,
        client_secret: MP_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: row.refresh_token,
      }),
    });
  } catch (e) {
    console.error("[mp-refresh] network error", { collectorId, error: String(e) });
    return null;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    console.error("[mp-refresh] failed", {
      collectorId,
      status: res.status,
      mp_error: data?.message || data?.error || data,
    });
    return null;
  }

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 15552000) * 1000).toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("mp_connected_accounts")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? row.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (updateError) {
    console.error("[mp-refresh] db update failed", { collectorId, error: updateError });
    return null;
  }

  console.log("[mp-refresh] refreshed", { collectorId, new_expires_at: expiresAt });

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? row.refresh_token,
    expires_at: expiresAt,
  };
}
