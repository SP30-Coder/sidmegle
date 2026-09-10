import React, { useEffect, useRef, useState } from 'react';

export default function ChatPanel({ socket, roomId, messages, setMessages, peerTyping }) {
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  const send = () => {
    const text = input.trim();
    if (!text || !socket || !roomId) return;
    const msg = { text: text.slice(0, 500), from: 'me', at: Date.now() };
    setMessages((p) => [...p, msg]);
    socket.emit('chatMessage', { roomId, text });
    setInput('');
    socket.emit('typing', { roomId, isTyping: false });
  };

  const onChange = (e) => {
    setInput(e.target.value);
    if (!socket || !roomId) return;
    socket.emit('typing', { roomId, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit('typing', { roomId, isTyping: false }), 1200);
  };

  return (
    <div className="chat-panel">
      <div className="chat-head">💬 Text Chat</div>
      <div className="chat-messages">
        {messages.length === 0 && <div className="empty">Say hi! Messages are not stored.</div>}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.from}`}>
            <div className="bubble">{m.text}</div>
            <div className="meta">{m.from === 'me' ? 'You' : 'Stranger'} • {new Date(m.at).toLocaleTimeString()}</div>
          </div>
        ))}
        {(typing || peerTyping) && <div className="typing">Stranger is typing…</div>}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input value={input} onChange={onChange} maxLength={500} placeholder="Message..."
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
        <button className="btn-primary" onClick={send}>Send</button>
      </div>
    </div>
  );
}
