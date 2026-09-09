// HMAC-signed session tokens for the public digital magazine (Revista) flow.
// Format: base64url(payloadJson) + "." + base64url(hmacSha256)
const encoder = new TextEncoder();

export interface RevistaTokenPayload {
  whatsapp: string;
  exp: number;
  licencas?: string[];
  [key: string]: unknown;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getSecret(): string {
  const secret = Deno.env.get("REVISTA_TOKEN_SECRET") ??
    Deno.env.get("INTERNAL_WEBHOOK_SECRET");
  if (!secret) throw new Error("Token secret não configurado");
  return secret;
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(sig);
}

export async function signRevistaToken(payload: RevistaTokenPayload): Promise<string> {
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = b64urlEncode(await hmac(body));
  return `${body}.${sig}`;
}

/** Returns the payload only when the signature is valid and the token has not expired. */
export async function verifyRevistaToken(
  token: string | null | undefined,
): Promise<RevistaTokenPayload | null> {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  let expected: string;
  try {
    expected = b64urlEncode(await hmac(body));
  } catch {
    return null;
  }
  if (expected !== sig) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as RevistaTokenPayload;
    if (!payload?.whatsapp) return null;
    if (typeof payload.exp === "number" && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
