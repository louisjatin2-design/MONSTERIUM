import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { activateSaveFor } from '@store/gameStore';

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
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

interface AuthActions {
  register: (username: string, password: string) => Promise<AuthResult>;
  login: (username: string, password: string) => Promise<AuthResult>;
  logout: () => void;
}

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

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      accounts: {},
      currentUser: null,

      register: async (username, password) => {
        const name = username.trim();
        const key = name.toLowerCase();
        if (name.length < MIN_USERNAME) {
          return { ok: false, error: `Der Benutzername muss mindestens ${MIN_USERNAME} Zeichen haben.` };
        }
        if (password.length < MIN_PASSWORD) {
          return { ok: false, error: `Das Passwort muss mindestens ${MIN_PASSWORD} Zeichen haben.` };
        }
        if (get().accounts[key]) {
          return { ok: false, error: 'Diesen Benutzernamen gibt es bereits.' };
        }
        const salt = randomSalt();
        const hash = await hashPassword(password, salt);
        set((s) => ({
          accounts: { ...s.accounts, [key]: { username: name, salt, hash, createdAt: Date.now() } },
          currentUser: name,
        }));
        // New account → fresh save game (no existing data for this username).
        activateSaveFor(name);
        return { ok: true };
      },

      login: async (username, password) => {
        const name = username.trim();
        const key = name.toLowerCase();
        const account = get().accounts[key];
        if (!account) {
          return { ok: false, error: 'Unbekannter Benutzername.' };
        }
        const hash = await hashPassword(password, account.salt);
        if (hash !== account.hash) {
          return { ok: false, error: 'Falsches Passwort.' };
        }
        set({ currentUser: account.username });
        // Switch the game store over to this account's saved progress.
        activateSaveFor(account.username);
        return { ok: true };
      },

      logout: () => {
        set({ currentUser: null });
        // Detach the game store from any account's save until the next login.
        activateSaveFor(null);
      },
    }),
    {
      name: 'monsterium-auth',
      // Never persist nothing else — only the account table + who's logged in.
      partialize: (s) => ({ accounts: s.accounts, currentUser: s.currentUser }),
    },
  ),
);
