import React, { useMemo, useState } from 'react';
import {
  COMPENDIUM_TRAITS, COMPENDIUM_EFFECTS,
  COMPENDIUM_TRAIT_COUNT, COMPENDIUM_EFFECT_COUNT,
  type CompendiumGroup,
} from '@data/compendium';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface CompendiumPanelProps { onClose: () => void; }

type Tab = 'traits' | 'effects';

// Browsable glossary of every trait and battle effect in the game. Read-only
// reference (the combat engine wires up a smaller subset) — lets players look
// up exactly what each trait/effect does without leaving the game.
export function CompendiumPanel({ onClose }: CompendiumPanelProps) {
  const [tab, setTab] = useState<Tab>('traits');
  const [search, setSearch] = useState('');

  const source = tab === 'traits' ? COMPENDIUM_TRAITS : COMPENDIUM_EFFECTS;

  // Filter entries by the search query, dropping any group left empty.
  const groups = useMemo<CompendiumGroup[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source
      .map(g => ({
        ...g,
        entries: g.entries.filter(
          e => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q),
        ),
      }))
      .filter(g => g.entries.length > 0);
  }, [source, search]);

  const total = tab === 'traits' ? COMPENDIUM_TRAIT_COUNT : COMPENDIUM_EFFECT_COUNT;
  const shown = groups.reduce((n, g) => n + g.entries.length, 0);

  return (
    <div className="panel panel-modal panel-w-lg" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <button className="close-btn" onClick={onClose} style={{ zIndex: 5 }}>✕</button>
      <HelpButton
        title="Kompendium"
        tips={[
          'Hier findest du alle Traits (passive Fähigkeiten) und Kampf-Effekte mit ihrer genauen Wirkung.',
          'Wechsle oben zwischen „Traits" und „Effekte" und nutze die Suche, um schnell etwas nachzuschlagen.',
          'Effekte sind nach Art gruppiert: Kontrolle, Schaden über Zeit, Schwächen, Schutz, Heilung und mehr.',
          'Die Zahl rechts an jedem Effekt gibt die Standard-Dauer in Runden an.',
        ]}
      />

      {/* Header + tabs */}
      <div style={{ padding: '14px 18px 0', background: 'linear-gradient(135deg, #1b2a48, #0c1426)', borderBottom: '2px solid #4a7bcc' }}>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#8fc0ff', textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>
          📚 Kompendium
        </div>
        <div style={{ fontSize: 12, color: '#9fb4d8', marginTop: 2 }}>
          {shown}/{total} {tab === 'traits' ? 'Traits' : 'Effekte'}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          <TabBtn label={`🧬 Traits (${COMPENDIUM_TRAIT_COUNT})`} active={tab === 'traits'} onClick={() => setTab('traits')} />
          <TabBtn label={`⚡ Effekte (${COMPENDIUM_EFFECT_COUNT})`} active={tab === 'effects'} onClick={() => setTab('effects')} />
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Suche nach Name oder Wirkung…"
          style={{
            width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.35)', color: '#fff',
            border: '1px solid #3a5a8a', borderRadius: 8, padding: '8px 12px',
            margin: '10px 0', fontSize: 13,
          }}
        />
      </div>

      {/* Scrollable list */}
      <div style={{ overflowY: 'auto', padding: 14, flex: 1, minHeight: 0 }}>
        {groups.map(g => (
          <div key={g.id} style={{ marginBottom: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              color: g.color, fontWeight: 900, fontSize: 14,
              borderBottom: `1px solid ${g.color}55`, paddingBottom: 5,
            }}>
              <span style={{ fontSize: 16 }}>{g.icon}</span>
              {g.title}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#7e8aa0', fontWeight: 700 }}>
                {g.entries.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {g.entries.map((e, i) => (
                <div key={i} className="monster-card" style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#fff' }}>{e.name}</span>
                    {e.turns && (
                      <span style={{
                        marginLeft: 'auto', flexShrink: 0,
                        fontSize: 10, fontWeight: 900, color: g.color,
                        background: `${g.color}22`, border: `1px solid ${g.color}66`,
                        borderRadius: 6, padding: '1px 7px', whiteSpace: 'nowrap',
                      }} title="Standard-Dauer in Runden">
                        {e.turns === '—' ? '—' : `${e.turns} ⟳`}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#aab2c4', marginTop: 3, lineHeight: 1.4 }}>
                    {e.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div style={{ textAlign: 'center', color: '#666', padding: 30 }}>
            Nichts gefunden.
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 0', fontSize: 12.5, fontWeight: 900, cursor: 'pointer',
      border: 'none', borderRadius: '8px 8px 0 0',
      background: active ? 'rgba(74,123,204,0.25)' : 'transparent',
      color: active ? '#8fc0ff' : '#6b7894',
      borderBottom: active ? '2px solid #8fc0ff' : '2px solid transparent',
    }}>
      {label}
    </button>
  );
}
