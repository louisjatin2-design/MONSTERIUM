// ── Gruppe 10 — Supabase-Auth (echte Accounts via REST) ─────────────────────
// E-Mail/Passwort-Anmeldung gegen die Supabase-Auth-API (GoTrue), ohne SDK.
// Aktiv, sobald VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY gesetzt sind; sonst
// fällt der authStore auf das lokale Konten-System zurück (Dev/Offline).

export interface AuthSession {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

interface SupaConfig { url: string; key: string; }

export function supaConfig(): SupaConfig | null {
  const env = (import.meta as any).env ?? {};
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  return url && key ? { url: String(url).replace(/\/+$/, ''), key: String(key) } : null;
}

export function isSupabaseConfigured(): boolean { return supaConfig() !== null; }

// ── Benutzername-Login ──────────────────────────────────────────────────────
// Supabase-Auth braucht intern eine E-Mail. Damit sich Spieler mit einem
// reinen BENUTZERNAMEN anmelden können, mappen wir den Namen deterministisch
// auf eine synthetische E-Mail. Es wird nie eine Mail versendet → im Supabase-
// Projekt muss „Confirm email" deaktiviert sein.
export const USERNAME_EMAIL_DOMAIN = 'monsterium.app';
export const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}

async function authPost(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const c = supaConfig();
  if (!c) throw new Error('Supabase nicht konfiguriert.');
  const res = await fetch(`${c.url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: c.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function toSession(data: any): AuthSession {
  return {
    userId: data.user?.id ?? '',
    email: data.user?.email ?? '',
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

function errMsg(data: any, fallback: string): string {
  return data?.error_description || data?.msg || data?.message || data?.error || fallback;
}

export type SignUpResult =
  | { session: AuthSession }
  | { needsConfirm: true }
  | { error: string };

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const { ok, data } = await authPost('signup', { email, password });
  if (!ok) return { error: errMsg(data, 'Registrierung fehlgeschlagen.') };
  if (data.access_token) return { session: toSession(data) };
  // Kein Token → E-Mail-Bestätigung im Supabase-Projekt aktiviert.
  return { needsConfirm: true };
}

export async function signIn(email: string, password: string): Promise<{ session: AuthSession } | { error: string }> {
  const { ok, data } = await authPost('token?grant_type=password', { email, password });
  if (!ok) return { error: errMsg(data, 'Anmeldung fehlgeschlagen.') };
  return { session: toSession(data) };
}

export async function refreshSession(refreshToken: string): Promise<AuthSession | null> {
  try {
    const { ok, data } = await authPost('token?grant_type=refresh_token', { refresh_token: refreshToken });
    return ok && data.access_token ? toSession(data) : null;
  } catch { return null; }
}

export async function signOut(accessToken: string): Promise<void> {
  const c = supaConfig();
  if (!c) return;
  await fetch(`${c.url}/auth/v1/logout`, {
    method: 'POST',
    headers: { apikey: c.key, Authorization: `Bearer ${accessToken}` },
  }).catch(() => { /* ignore */ });
}
