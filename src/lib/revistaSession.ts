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

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function parseRevistaToken(token: string): RevistaTokenPayload | null {
  try {
    return JSON.parse(atob(token)) as RevistaTokenPayload;
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

export function persistRevistaToken(rawToken: string) {
  const payload = parseRevistaToken(rawToken);
  if (!payload) return null;

  const nextPayload: RevistaTokenPayload = {
    ...payload,
    expires_at: Date.now() + THIRTY_DAYS_MS,
  };

  delete nextPayload.exp;

  return btoa(JSON.stringify(nextPayload));
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
