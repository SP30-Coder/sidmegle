import React from 'react';

export default function Header({ connectionState, online }) {
  const dot = connectionState === 'connected' ? '🟢' : connectionState === 'connecting' ? '🟡' : '🔴';
  const label = connectionState === 'connected' ? 'Connected' : connectionState === 'connecting' ? 'Connecting...' : 'Disconnected';
  return (
    <header className="header">
      <div className="brand">
        <span className="logo">⚡</span>
        <span className="brand-name">StrangerConnect</span>
      </div>
      <div className="header-right">
        {online && <span className="online">Online: {online.count ?? '—'}</span>}
        <span className={`conn conn-${connectionState}`} title={label}>{dot} {label}</span>
      </div>
    </header>
  );
}
