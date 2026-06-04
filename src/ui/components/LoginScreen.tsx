import React, { useState } from 'react';
import { useAuthStore, isSupabaseConfigured } from '@store/authStore';
import '../styles/global.css';

const ONLINE = isSupabaseConfigured();

// Full-screen gate shown before the game starts: the player must either log in
// to an existing account or create a new one. Username + password only — no
// backend, everything lives in the browser (see authStore).
export function LoginScreen() {
  const register = useAuthStore(s => s.register);
  const login    = useAuthStore(s => s.login);

  const [mode, setMode]         = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [info, setInfo]         = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  const isRegister = mode === 'register';

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword('');
    setConfirm('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setInfo(null);

    if (isRegister && password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setBusy(true);
    try {
      const result = isRegister
        ? await register(username, password)
        : await login(username, password);
      if (!result.ok) {
        setError(result.error ?? 'Etwas ist schiefgelaufen.');
      } else if (result.info) {
        // z. B. E-Mail-Bestätigung nötig → Hinweis zeigen, zurück zum Login.
        setInfo(result.info);
        setMode('login');
        setPassword('');
        setConfirm('');
      }
      // Sonst: authStore setzt currentUser → App wechselt ins Spiel.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'calc(20px + env(safe-area-inset-top, 0px)) 20px calc(20px + env(safe-area-inset-bottom, 0px))',
        background:
          'radial-gradient(80% 60% at 50% -10%, rgba(150,110,255,0.25), transparent 60%),' +
          'linear-gradient(180deg, #1a0c33 0%, #160826 55%, #0b0418 100%)',
        zIndex: 9000,
        overflowY: 'auto',
        fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif",
      }}
    >
      <div
        className="panel"
        style={{
          position: 'relative',
          boxSizing: 'border-box',
          width: 'min(400px, calc(100vw - 32px))',
          padding: 24,
          overflow: 'visible',
        }}
      >
        {/* Logo / title */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 6 }}>👾</div>
          <div style={{
            fontSize: 30, fontWeight: 900, color: '#ffd700',
            letterSpacing: '0.06em',
            textShadow: '0 2px 10px rgba(255,180,0,0.6)',
          }}>MONSTERIUM</div>
          <div style={{ fontSize: 13, color: '#baa9e6', marginTop: 4 }}>
            {isRegister ? 'Neues Konto erstellen' : 'Melde dich an, um zu spielen'}
          </div>
        </div>

        {/* Login / Register tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          <button
            type="button"
            className={mode === 'login' ? 'btn btn-purple' : 'btn'}
            style={{ flex: 1, background: mode === 'login' ? undefined : 'rgba(255,255,255,0.08)' }}
            onClick={() => switchMode('login')}
          >
            Anmelden
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'btn btn-purple' : 'btn'}
            style={{ flex: 1, background: mode === 'register' ? undefined : 'rgba(255,255,255,0.08)' }}
            onClick={() => switchMode('register')}
          >
            Registrieren
          </button>
        </div>

        <form onSubmit={submit}>
          <Field
            label="Benutzername"
            value={username}
            onChange={setUsername}
            type="text"
            autoFocus
            autoComplete="username"
            placeholder="z. B. MonsterMeister"
          />
          <Field
            label="Passwort"
            value={password}
            onChange={setPassword}
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder="••••••"
          />
          {isRegister && (
            <Field
              label="Passwort bestätigen"
              value={confirm}
              onChange={setConfirm}
              type="password"
              autoComplete="new-password"
              placeholder="••••••"
            />
          )}

          {error && (
            <div style={{
              background: 'rgba(221,68,68,0.18)',
              border: '1px solid rgba(255,119,102,0.5)',
              borderRadius: 8,
              color: '#ff9b8b',
              fontSize: 13, fontWeight: 700,
              padding: '8px 10px', marginBottom: 12,
            }}>
              ⚠️ {error}
            </div>
          )}
          {info && (
            <div style={{
              background: 'rgba(68,200,120,0.16)',
              border: '1px solid rgba(120,220,160,0.5)',
              borderRadius: 8,
              color: '#9be8bd',
              fontSize: 13, fontWeight: 700,
              padding: '8px 10px', marginBottom: 12,
            }}>
              ✉️ {info}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !username || !password || (isRegister && !confirm)}
            style={{ width: '100%', padding: '12px', fontSize: 16 }}
          >
            {busy ? 'Bitte warten…' : isRegister ? 'Konto erstellen' : 'Einloggen'}
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 11, color: '#8a7db8', textAlign: 'center', lineHeight: 1.5 }}>
          {ONLINE ? (
            <>Anmeldung mit Benutzername + Passwort (echtes Konto).<br />
              Dein Fortschritt ist an dein Konto gebunden.</>
          ) : (
            <>Konten werden nur lokal auf diesem Gerät gespeichert.<br />
              Jedes Konto hat seinen eigenen Spielstand.</>
          )}
        </div>
      </div>
    </div>
  );
}

// A labelled text/password input styled to match the dark game theme.
function Field({
  label, value, onChange, type = 'text', placeholder, autoComplete, autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{
        display: 'block', fontSize: 12, fontWeight: 700,
        color: '#baa9e6', marginBottom: 4, letterSpacing: '0.03em',
      }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        spellCheck={false}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 12px',
          background: 'rgba(8,4,20,0.6)',
          border: '1.5px solid rgba(255,215,120,0.3)',
          borderRadius: 10,
          color: '#fff', fontSize: 15,
          outline: 'none',
          fontFamily: 'inherit',
        }}
        onFocus={e => { e.target.style.borderColor = '#bb88ff'; }}
        onBlur={e => { e.target.style.borderColor = 'rgba(255,215,120,0.3)'; }}
      />
    </label>
  );
}
