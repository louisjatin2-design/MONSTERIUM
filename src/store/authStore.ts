import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { activateSaveFor } from '@store/gameStore';
import {
  isSupabaseConfigured, signUp as supaSignUp, signIn as supaSignIn,
  signOut as supaSignOut, refreshSession, usernameToEmail, USERNAME_RE,
  type AuthSession,
} from '../net/auth';

// ─────────────────────────────────────────────────────────────────────────
// Account system (client-side only)
//
// MONSTERIUM has no backend — accounts live in the browser's localStorage.
// Passwords are NEVER stored in plain text: each account gets a random salt
// and we keep only a salted SHA-256 hash. This is enough to keep casual
// snoopers out of a sibling's save; it is not a substitute for real
// server-side auth (anyone with devtools could still tamper with localStorage).
//
// Each account also gets its OWN save game: the game store's persisted data is
// namespaced per username (see gameStore's activateSaveFor), so two players on
// the same device keep separate monster collections.
// ─────────────────────────────────────────────────────────────────────────

export interface Account {
  username: string;   // the display name exactly as the player typed it
  salt: string;       // random hex salt, unique per account
  hash: string;       // hex SHA-256 of `${salt}:${password}`
  createdAt: number;
}

interface AuthState {
  // Keyed by the lower-cased username so logins are case-insensitive while we
  // still preserve the original casing for display.
  accounts: Record<string, Account>;
  currentUser: string | null;
  // Gruppe 10 — Supabase-Auth-Session (nur gesetzt, wenn Supabase konfiguriert
  // ist und der Spieler eingeloggt ist).
  session: AuthSession | null;
  // Optionaler Anzeigename, der currentUser überschreibt (z. B. wenn ein
  // Alt-Konto noch eine E-Mail als Namen hatte → Spieler wählt einen Username).
  // Ändert NICHT den Spielstand-Namespace (der bleibt currentUser).
  displayName: string | null;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  info?: string; // z. B. „Bitte bestätige deine E-Mail"
}

interface AuthActions {
  // `identifier` ist die E-Mail (Supabase) bzw. der Benutzername (lokal).
  register: (identifier: string, password: string) => Promise<AuthResult>;
  login: (identifier: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  // Beim App-Start: abgelaufene Supabase-Session erneuern.
  restoreSession: () => Promise<void>;
  // Anzeigenamen (Username) für das aktuelle Konto setzen.
  setDisplayName: (name: string) => void;
}

/** Effektiver Anzeigename (Username) des aktuellen Spielers. */
export function getDisplayName(): string {
  const s = useAuthStore.getState();
  return s.displayName ?? s.currentUser ?? 'Hüter';
}

/** True, wenn ein eingeloggtes Online-Konto noch keinen sauberen Username hat
 *  (z. B. der Anzeigename ist noch eine E-Mail) → Username abfragen. */
export function needsUsername(): boolean {
  if (!isSupabaseConfigured()) return false;
  const s = useAuthStore.getState();
  if (!s.currentUser || !s.session) return false;
  const name = s.displayName ?? s.currentUser;
  return name.includes('@') || name.trim().length === 0;
}

/** Online-Identität (Supabase-User-ID) bzw. null im lokalen Modus. */
export function getAuthUserId(): string | null {
  return useAuthStore.getState().session?.userId ?? null;
}
/** Aktives Supabase-Access-Token (für authentifizierte REST-Aufrufe) bzw. null. */
export function getAccessToken(): string | null {
  return useAuthStore.getState().session?.accessToken ?? null;
}
export { isSupabaseConfigured };

type AuthStore = AuthState & AuthActions;

// Hex-encode an ArrayBuffer / typed array.
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return toHex(arr);
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

const MIN_USERNAME = 3;
const MIN_PASSWORD = 4;

// Eine erfolgreiche Supabase-Anmeldung in den Store schreiben. currentUser wird
// der angezeigte Benutzername (auch Spielstand-Namespace); die User-ID bindet
// die Online-Identität (Profile/Auktionen).
function loginWithSession(set: (p: Partial<AuthStore>) => void, session: AuthSession, name: string): void {
  // currentUser ist der saubere Username → kein separater displayName nötig.
  set({ currentUser: name, session, displayName: null });
  activateSaveFor(name);
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      accounts: {},
      currentUser: null,
      session: null,
      displayName: null,

      register: async (identifier, password) => {
        const id = identifier.trim();
        if (password.length < MIN_PASSWORD) {
          return { ok: false, error: `Das Passwort muss mindestens ${MIN_PASSWORD} Zeichen haben.` };
        }

        // ── Supabase-Auth (echte Accounts, Benutzername-Login) ───────────────
        if (isSupabaseConfigured()) {
          if (!USERNAME_RE.test(id)) {
            return { ok: false, error: 'Benutzername: 3–30 Zeichen, nur Buchstaben, Zahlen, . _ -' };
          }
          const res = await supaSignUp(usernameToEmail(id), password);
          if ('error' in res) {
            const taken = /already|registered|exists/i.test(res.error);
            return { ok: false, error: taken ? 'Diesen Benutzernamen gibt es bereits.' : res.error };
          }
          if ('needsConfirm' in res) {
            // Synthetische E-Mail kann nicht bestätigt werden → Admin-Hinweis.
            return { ok: false, error: 'Registrierung erfordert E-Mail-Bestätigung. Bitte in Supabase „Confirm email" deaktivieren.' };
          }
          loginWithSession(set, res.session, id);
          return { ok: true };
        }

        // ── Lokaler Fallback (kein Backend konfiguriert) ─────────────────────
        const name = id;
        const key = name.toLowerCase();
        if (name.length < MIN_USERNAME) {
          return { ok: false, error: `Der Benutzername muss mindestens ${MIN_USERNAME} Zeichen haben.` };
        }
        if (get().accounts[key]) {
          return { ok: false, error: 'Diesen Benutzernamen gibt es bereits.' };
        }
        const salt = randomSalt();
        const hash = await hashPassword(password, salt);
        set((s) => ({
          accounts: { ...s.accounts, [key]: { username: name, salt, hash, createdAt: Date.now() } },
          currentUser: name, session: null,
        }));
        activateSaveFor(name);
        return { ok: true };
      },

      login: async (identifier, password) => {
        const id = identifier.trim();

        if (isSupabaseConfigured()) {
          const res = await supaSignIn(usernameToEmail(id), password);
          if ('error' in res) {
            const bad = /invalid|credentials|not.*found/i.test(res.error);
            return { ok: false, error: bad ? 'Benutzername oder Passwort falsch.' : res.error };
          }
          loginWithSession(set, res.session, id);
          return { ok: true };
        }

        const name = id;
        const key = name.toLowerCase();
        const account = get().accounts[key];
        if (!account) {
          return { ok: false, error: 'Unbekannter Benutzername.' };
        }
        const hash = await hashPassword(password, account.salt);
        if (hash !== account.hash) {
          return { ok: false, error: 'Falsches Passwort.' };
        }
        set({ currentUser: account.username, session: null });
        activateSaveFor(account.username);
        return { ok: true };
      },

      logout: () => {
        const sess = get().session;
        if (sess) void supaSignOut(sess.accessToken);
        set({ currentUser: null, session: null, displayName: null });
        activateSaveFor(null);
      },

      setDisplayName: (name) => {
        const n = name.trim();
        if (!USERNAME_RE.test(n)) return;
        set({ displayName: n });
      },

      restoreSession: async () => {
        if (!isSupabaseConfigured()) return;
        const sess = get().session;
        // Echte Accounts erzwingen: wer (noch) ohne Supabase-Session „eingeloggt"
        // ist (z. B. alter lokaler Login), muss sich jetzt richtig anmelden.
        if (!sess) {
          if (get().currentUser) { set({ currentUser: null }); activateSaveFor(null); }
          return;
        }
        // Token bald abgelaufen → erneuern; sonst Logout erzwingen.
        if (sess.expiresAt - Date.now() < 60_000) {
          const next = await refreshSession(sess.refreshToken);
          if (next) set({ session: next });
          else { set({ currentUser: null, session: null }); activateSaveFor(null); }
        }
      },
    }),
    {
      name: 'monsterium-auth',
      // Konten-Tabelle (lokal), aktueller Nutzer, Supabase-Session, Anzeigename.
      partialize: (s) => ({ accounts: s.accounts, currentUser: s.currentUser, session: s.session, displayName: s.displayName }),
    },
  ),
);
