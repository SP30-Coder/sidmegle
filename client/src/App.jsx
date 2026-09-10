import React, { useState } from 'react';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import VideoChat from './components/VideoChat';
import { useSocket } from './hooks/useSocket';
import './App.css';

export default function App() {
  const { socket, connectionState, online } = useSocket();
  const [inChat, setInChat] = useState(false);
  const [interests, setInterests] = useState([]);
  const start = (sel) => { setInterests(sel || []); setInChat(true); };
  return (
    <div className="app">
      <Header connectionState={connectionState} online={online} />
      {connectionState === 'disconnected' && (
        <div className="banner warn">Server disconnected. Start backend on {(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000')}.</div>
      )}
      {!inChat ? <LandingPage onStart={start} online={online} /> : <VideoChat socket={socket} interests={interests} onLeave={() => setInChat(false)} />}
      <footer className="footer">StrangerConnect - Be respectful - No recording - 18+ recommended</footer>
    </div>
  );
}
