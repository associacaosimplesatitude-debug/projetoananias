export interface RevistaTokenPayload {
  whatsapp?: string;
  licencas?: string[];
  exp?: number | string;
  expires_at?: number | string;
  [key: string]: unknown;
}

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