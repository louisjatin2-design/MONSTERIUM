import React from 'react';
import { useGameStore } from '@store/gameStore';
import '../styles/global.css';

interface Props { onClose: () => void; }

// Lightweight onboarding flow. Each step shows a coach card; the player advances
// by reading + pressing "Weiter". The flow teaches the core loop:
// breed two monsters → wait → hatch into a habitat → battle.
const STEPS: { title: string; body: string }[] = [
  {
    title: '👋 Willkommen in MONSTERIUM!',
    body: 'Der Riss hat sich geöffnet und Monster strömen in deine Welt. Als Hüter:in baust du ihnen ein Zuhause, züchtest neue Arten und kämpfst gegen die Verderbnis. Lass uns die Grundlagen lernen!',
  },
  {
    title: '💞 Schritt 1: Züchten',
    body: 'Du startest mit einem Flameling und einem Aquapup. Tippe unten auf BREED (💞), wähle beide als Eltern und starte das Brüten. Aus zwei Monstern entsteht ein neues Ei!',
  },
  {
    title: '⏳ Schritt 2: Warten & Sammeln',
    body: 'Brüten braucht Zeit. Du kannst es mit 💎 beschleunigen. Wenn es fertig ist, sammle das Ei ein — es wandert in die Brutstation (Hatchery).',
  },
  {
    title: '🐣 Schritt 3: Schlüpfen',
    body: 'Tippe auf HATCH (🥚) und lass das Ei schlüpfen. Wichtig: Jedes Monster braucht sofort einen passenden Lebensraum (richtiges Element + Platz). Hast du keinen, baue erst einen!',
  },
  {
    title: '⚔️ Schritt 4: Kämpfen & Wachsen',
    body: 'Füttere deine Monster (🌾) um sie zu leveln, und zieh über STORY (🗺️) in den Kampf gegen den Riss. Sieg bringt Gold, XP und 💎. Viel Erfolg, Hüter:in!',
  },
];

export function TutorialOverlay({ onClose }: Props) {
  const step = useGameStore(s => s.tutorialStep);
  const setStep = useGameStore(s => s.setTutorialStep);

  // tutorialStep 0 = welcome; we map directly to STEPS index.
  const idx = Math.min(step, STEPS.length - 1);
  const current = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      setStep(99); // done
      onClose();
    } else {
      setStep(idx + 1);
    }
  };

  const skip = () => { setStep(99); onClose(); };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 400,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      pointerEvents: 'auto', background: 'rgba(0,0,0,0.35)',
    }}>
      <div className="panel" style={{
        position: 'relative',
        // Sit near the bottom (thumb reach) but never taller than the viewport —
        // on short landscape phones it would otherwise clip off the top edge.
        margin: '0 0 24px',
        maxHeight: 'calc(var(--vh, 1vh) * 100 - 32px)', overflowY: 'auto',
        width: 440, maxWidth: '92vw',
        padding: 20, border: '2px solid #ffd700',
      }}>
        <div className="panel-title" style={{ borderBottom: 'none', marginBottom: 8 }}>
          {current.title}
        </div>
        <div style={{ fontSize: 14, color: '#ddd', lineHeight: 1.55, marginBottom: 16 }}>
          {current.body}
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === idx ? '#ffd700' : 'rgba(255,255,255,0.25)',
            }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-info" style={{ flex: 1 }} onClick={skip}>
            Überspringen
          </button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={next}>
            {isLast ? "Los geht's! 🎉" : 'Weiter →'}
          </button>
        </div>
      </div>
    </div>
  );
}
