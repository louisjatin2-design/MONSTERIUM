import React from 'react';
import { HelpButton } from './HelpButton';
import '../styles/global.css';

interface Props {
  onClose: () => void;
  onStory: () => void;
}

// ── Kampf-Auswahl-Screen (Gruppe 3) ─────────────────────────────────────────
// Eigenständiger Screen, der beim Tippen auf „Kämpfen" erscheint und drei Modi
// anbietet: Story (verfügbar), Multiplayer und Dungeons (beide WIP). Ersetzt den
// alten direkten „Abenteuer"-Button.
export function BattleSelectScreen({ onClose, onStory }: Props) {
  return (
    <div className="panel panel-modal panel-w-md" style={{ display: 'flex', flexDirection: 'column' }}>
      <button className="close-btn" onClick={onClose}>✕</button>
      <HelpButton
        title="Kämpfen"
        tips={[
          'Story: kämpfe dich durch die Abenteuer-Karte mit Cutscenes und Belohnungen.',
          'Multiplayer und Dungeons befinden sich noch in Arbeit (WIP).',
        ]}
      />
      <div className="panel-title">⚔️ Kämpfen</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <ModeCard
          icon="🗺️" title="Story"
          desc="Folge der Abenteuer-Karte mit Cutscenes, Lore und gestaffelten Belohnungen."
          from="#a85ae8" to="#6a28b8"
          onClick={onStory}
        />
        <ModeCard
          icon="🌐" title="Multiplayer" wip
          desc="Echtzeit-PvP gegen andere Spieler. (In Arbeit)"
          from="#3f8fd0" to="#1f4f96"
        />
        <ModeCard
          icon="🏰" title="Dungeons" wip
          desc="Mehrstufige Dungeons mit Boss-Begegnungen und seltener Beute. (In Arbeit)"
          from="#d0883f" to="#964f1f"
        />
      </div>
    </div>
  );
}

function ModeCard({ icon, title, desc, from, to, wip, onClick }: {
  icon: string; title: string; desc: string; from: string; to: string;
  wip?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={wip ? undefined : onClick}
      disabled={wip}
      style={{
        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14,
        padding: 16, borderRadius: 14, cursor: wip ? 'not-allowed' : 'pointer',
        background: `linear-gradient(135deg, ${from}, ${to})`,
        border: '2px solid rgba(255,255,255,0.18)',
        opacity: wip ? 0.55 : 1, position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
      }}>
      <span style={{ fontSize: 38, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>
          {title}
          {wip && (
            <span style={{
              marginLeft: 8, fontSize: 10, fontWeight: 900, padding: '2px 6px',
              borderRadius: 5, background: 'rgba(0,0,0,0.4)', color: '#ffd34d',
              verticalAlign: 'middle',
            }}>WIP</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{desc}</div>
      </div>
    </button>
  );
}
