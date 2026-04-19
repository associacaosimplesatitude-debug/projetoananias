// Mercado Pago OAuth callback — exchanges authorization code for access token
// and stores the connected seller account.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-oauth-callback`;

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  // Resolve front-end base URL
  const referer = req.headers.get("referer") || req.headers.get("origin") || "";
  let siteUrl = "https://gestaoebd.com.br";
  try {
    if (referer) siteUrl = new URL(referer).origin;
  } catch (_) { /* keep default */ }
  const adminUrl = `${siteUrl}/admin/mp-oauth`;

  if (errorParam) {
    console.log("[mp-oauth] provider error:", errorParam);
    return redirect(`${adminUrl}?error=${encodeURIComponent(errorParam)}`);
  }
  if (!code) {
    return redirect(`${adminUrl}?error=${encodeURIComponent("missing_code")}`);
  }

  const clientSecret = Deno.env.get("MP_CLIENT_SECRET");
  const clientId = Deno.env.get("MP_CLIENT_ID");
  if (!clientSecret || !clientId) {
    console.error("[mp-oauth] MP_CLIENT_ID or MP_CLIENT_SECRET not configured");
    return redirect(`${adminUrl}?error=${encodeURIComponent("server_misconfigured")}`);
  }

  try {
    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    const data = await tokenRes.json();
    console.log("[mp-oauth] token status:", tokenRes.status, "live_mode:", data?.live_mode);

    if (!tokenRes.ok) {
      console.error("[mp-oauth] MP error:", data?.message || data?.error);
      return redirect(`${adminUrl}?error=${encodeURIComponent(data?.message || data?.error || "token_exchange_failed")}`);
    }

    const collectorId = String(data.user_id);
    const expiresAt = data.expires_in
      ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
      : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: dbError } = await supabase
      .from("mp_connected_accounts")
      .upsert(
        {
          collector_id: collectorId,
          access_token: data.access_token,
          refresh_token: data.refresh_token ?? null,
          public_key: data.public_key ?? null,
          live_mode: !!data.live_mode,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "collector_id" },
      );

    if (dbError) {
      console.error("[mp-oauth] DB upsert error:", dbError.message);
      return redirect(`${adminUrl}?error=${encodeURIComponent("db_error")}`);
    }

    console.log("[mp-oauth] connected collector_id:", collectorId);
    return redirect(`${adminUrl}?success=true&collector_id=${encodeURIComponent(collectorId)}`);
  } catch (e) {
    console.error("[mp-oauth] exception:", e);
    return redirect(`${adminUrl}?error=${encodeURIComponent("exception")}`);
  }
});
