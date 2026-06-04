import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installResponsiveScaling } from '@ui/responsiveScale';
import { installForceFullscreen } from '@ui/fullscreen';

// Start the unified responsive display system before the first render so the
// HUD and action rails are already fitted to the screen on the opening frame.
installResponsiveScaling();

// Force the browser into fullscreen on the player's first interaction so the
// address/tab bar disappears and the game owns the whole screen.
installForceFullscreen();

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MONSTERIUM crash:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0,
          background: '#0a0a1a', color: '#fff',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'monospace', padding: 24,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, color: '#ff4444', marginBottom: 12 }}>MONSTERIUM failed to start</div>
          <div style={{ fontSize: 12, color: '#888', maxWidth: 480, wordBreak: 'break-word' }}>
            {this.state.error}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20, padding: '10px 24px',
              background: '#226622', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
