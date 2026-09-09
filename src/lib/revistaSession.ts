export interface RevistaTokenPayload {
  whatsapp?: string;
  licencas?: string[];
  exp?: number | string;
  expires_at?: number | string;
  [key: string]: unknown;
}

export const REVISTA_KEYS = {
  TOKEN: "revista_token",
  LICENCAS: "revista_licencas",
} as const;

/**
 * Reads the (unverified) payload of a signed session token for display purposes.
 * Format: base64url(payload).base64url(signature) — only the server can validate it.
 */
export function parseRevistaToken(token: string): RevistaTokenPayload | null {
  try {
    const body = token.split(".")[0];
    const padded = body.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (body.length % 4)) % 4);
    return JSON.parse(atob(padded)) as RevistaTokenPayload;
  } catch {
    return null;
  }
}

export function getRevistaTokenExpiresAt(
  payload: RevistaTokenPayload | null
) {
  if (!payload) return null;

  const rawValue = payload.expires_at ?? payload.exp;
  const expiresAt =
    typeof rawValue === "string" ? Number(rawValue) : rawValue ?? null;

  return typeof expiresAt === "number" && Number.isFinite(expiresAt)
    ? expiresAt
    : null;
}

/**
 * The token is signed by the server: it must be stored exactly as received.
 * The expiry embedded by the server is authoritative — the client cannot extend it.
 */
export function persistRevistaToken(rawToken: string) {
  const payload = parseRevistaToken(rawToken);
  if (!payload) return null;
  return rawToken;
}

/** Returns a valid session or null */
export function getValidRevistaSession(): { token: string; decoded: RevistaTokenPayload } | null {
  const token = localStorage.getItem(REVISTA_KEYS.TOKEN);
  if (!token) return null;

  const decoded = parseRevistaToken(token);
  const expiresAt = getRevistaTokenExpiresAt(decoded);

  if (!decoded || !expiresAt || expiresAt <= Date.now()) {
    return null;
  }

  return { token, decoded };
}

/** Save token + licences to localStorage */
export function saveRevistaSession(token: string, licencas: unknown) {
  localStorage.setItem(REVISTA_KEYS.TOKEN, token);
  localStorage.setItem(REVISTA_KEYS.LICENCAS, JSON.stringify(licencas));
}

/** Clear all revista session data from localStorage */
export function clearRevistaSession() {
  localStorage.removeItem(REVISTA_KEYS.TOKEN);
  localStorage.removeItem(REVISTA_KEYS.LICENCAS);
}
