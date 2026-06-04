import React, { useState } from 'react';
import { useAuthStore } from '@store/authStore';
import { USERNAME_RE } from '../../net/auth';
import { getOnlineService } from '../../net/onlineService';
import '../styles/global.css';

// Wird für eingeloggte Konten gezeigt, die noch keinen sauberen Benutzernamen
// haben (z. B. Alt-Konten mit E-Mail als Anzeigename). Erst nach Wahl eines
// Usernamens geht es ins Spiel — so erscheint nie eine E-Mail im Leaderboard.
export function UsernamePrompt() {
  const setDisplayName = useAuthStore(s => s.setDisplayName);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const n = name.trim();
    if (!USERNAME_RE.test(n)) {
      setError('3–30 Zeichen, nur Buchstaben, Zahlen, . _ -');
      return;
    }
    setBusy(true);
    setDisplayName(n);
    // Profil sofort mit dem neuen Namen aktualisieren (überschreibt die Alt-Zeile).
    try { await getOnlineService().getSelfProfile(); } catch { /* offline ok */ }
    setBusy(false);
    // setDisplayName aktualisiert den Store → App rendert das Spiel.
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, zIndex: 9000, overflowY: 'auto',
      background: 'radial-gradient(80% 60% at 50% -10%, rgba(150,110,255,0.25), transparent 60%),'
        + 'linear-gradient(180deg, #1a0c33 0%, #160826 55%, #0b0418 100%)',
      fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif",
    }}>
      <div className="panel" style={{ position: 'relative', boxSizing: 'border-box', width: 'min(400px, calc(100vw - 32px))', padding: 24, overflow: 'visible' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🪪</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#ffd700' }}>Wähle einen Benutzernamen</div>
          <div style={{ fontSize: 13, color: '#baa9e6', marginTop: 6, lineHeight: 1.5 }}>
            Dieser Name erscheint öffentlich (Bestenlisten, Auktionen, Clans).
            Deine E-Mail bleibt privat.
          </div>
        </div>
        <form onSubmit={submit}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z. B. MonsterMeister"
            autoFocus
            spellCheck={false}
            autoComplete="username"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 12,
              background: 'rgba(8,4,20,0.6)', border: '1.5px solid rgba(255,215,120,0.3)',
              borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'inherit',
            }}
          />
          {error && (
            <div style={{
              background: 'rgba(221,68,68,0.18)', border: '1px solid rgba(255,119,102,0.5)',
              borderRadius: 8, color: '#ff9b8b', fontSize: 13, fontWeight: 700, padding: '8px 10px', marginBottom: 12,
            }}>⚠️ {error}</div>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy || !name}
            style={{ width: '100%', padding: 12, fontSize: 16 }}>
            {busy ? 'Bitte warten…' : 'Übernehmen'}
          </button>
        </form>
      </div>
    </div>
  );
}
