import React from 'react';

export default function Matchmaking({ status }) {
  const labels = {
    searching: 'Looking for someone to chat with...',
    found: 'Stranger found! Connecting...',
    connecting: 'Connecting...',
    connected: 'Connected',
    disconnected: 'Stranger disconnected. Searching for another stranger...',
    idle: 'Ready',
  };
  if (status === 'connected' || status === 'idle') return null;
  return (
    <div className="match-overlay">
      <div className="spinner" />
      <div>{labels[status] || status}</div>
    </div>
  );
}
