import React, { useCallback, useEffect, useState } from 'react';
import VideoPlayer from './VideoPlayer';
import ChatPanel from './ChatPanel';
import ControlBar from './ControlBar';
import Matchmaking from './Matchmaking';
import ReportModal from './ReportModal';
import { useMediaDevices } from '../hooks/useMediaDevices';
import { useWebRTC } from '../hooks/useWebRTC';

export default function VideoChat({ socket, interests = [], gender, preferredGender = 'any', onLeave }) {
  const { stream, error: mediaError, cameraOn, micOn, loading, requestMedia, toggleCamera, toggleMic, stopAll } = useMediaDevices();
  const [status, setStatus] = useState('idle');
  const [roomId, setRoomId] = useState(null);
  const [initiator, setInitiator] = useState(false);
  const [peerSessionId, setPeerSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const [toast, setToast] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [ready, setReady] = useState(false);
  const { remoteStream, rtcState, start, cleanup } = useWebRTC({ socket, localStream: stream, roomId, initiator });
  const showToast = (t) => { setToast(t); setTimeout(() => setToast(null), 3500); };

  useEffect(() => { requestMedia().then(() => setReady(true)); }, []);
  const joinQueue = useCallback(() => {
    if (!socket) return;
    setMessages([]); setPeerSessionId(null); setRoomId(null); setStatus('searching');
    socket.emit('joinQueue', { interests, gender, preferredGender });
  }, [socket, interests, gender, preferredGender]);
  useEffect(() => { if (ready && stream && status === 'idle') joinQueue(); }, [ready, stream, status, joinQueue]);
  useEffect(() => {
    if (!socket) return;
    const onQ = () => setStatus('searching');
    const onMatch = ({ roomId: rid, initiator: init, peerSessionId: peer }) => {
      cleanup(); setMessages([]); setRoomId(rid);
      setInitiator(!!init); setPeerSessionId(peer || null); setStatus('found');
    };
    const onLeft = () => { cleanup(); setRoomId(null); setPeerSessionId(null); };
    const onGone = () => {
      cleanup(); setRoomId(null); setPeerSessionId(null); setMessages([]); setStatus('disconnected');
      setTimeout(() => { if (socket.connected) { setStatus('searching'); socket.emit('joinQueue', { interests, gender, preferredGender }); } }, 1500);
    };
    const onChat = ({ text, at }) => setMessages((p) => [...p, { text, from: 'stranger', at }]);
    const onTyping = ({ isTyping }) => setPeerTyping(!!isTyping);
    const onErr = (d) => showToast(d.message);
    socket.on('queueJoined', onQ); socket.on('matchFound', onMatch);
    socket.on('leftRoom', onLeft); socket.on('strangerDisconnected', onGone);
    socket.on('chatMessage', onChat); socket.on('typing', onTyping);
    socket.on('queueError', onErr); socket.on('chatError', onErr);
    socket.on('reportResult', onErr); socket.on('blockResult', onErr);
    return () => {
      socket.off('queueJoined', onQ); socket.off('matchFound', onMatch);
      socket.off('leftRoom', onLeft); socket.off('strangerDisconnected', onGone);
      socket.off('chatMessage', onChat); socket.off('typing', onTyping);
      socket.off('queueError', onErr); socket.off('chatError', onErr);
      socket.off('reportResult', onErr); socket.off('blockResult', onErr);
    };
  }, [socket, interests, gender, preferredGender, cleanup]);
  useEffect(() => { if (roomId && stream) { setStatus('connecting'); start(); } }, [roomId, stream, initiator, start]);
  useEffect(() => {
    if (rtcState === 'connected') setStatus('connected');
    if (rtcState === 'failed') showToast('Connection failed. Click Next.');
  }, [rtcState]);
  const handleNext = () => {
    cleanup(); setMessages([]); setRoomId(null); setPeerSessionId(null);
    setStatus('searching'); socket.emit('next');
  };
  const handleEnd = () => { cleanup(); socket.emit('leaveRoom'); stopAll(); onLeave(); };
  const handleReport = (reason, details) => {
    socket.emit('reportUser', { roomId, reason, details, peerSessionId });
    setShowReport(false); showToast('Report submitted.');
    setTimeout(handleNext, 800);
  };
  const handleBlock = () => {
    socket.emit('blockUser', { peerSessionId });
    showToast('Blocked. Finding someone new...'); setTimeout(handleNext, 800);
  };
  const fs = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen();
  };
  return (
    <div className="chat-page">
      <div className="chat-grid">
        <div className="videos">
          <div className="video-wrap" id="stranger-video" onDoubleClick={() => fs('stranger-video')}>
            <VideoPlayer stream={remoteStream} label="Stranger" placeholder="Waiting for stranger..." />
            {(status === 'searching' || status === 'disconnected' || status === 'found' || status === 'connecting') && <Matchmaking status={status} />}
          </div>
          <div className="video-wrap" id="my-video" onDoubleClick={() => fs('my-video')}>
            <VideoPlayer stream={stream} muted mirrored label="You" placeholder="Camera off" />
          </div>
          <div className="status-line">Status: <b>{status}</b>{rtcState !== 'idle' && <span> - WebRTC: {rtcState}</span>}</div>
          {loading && <div className="notice">Requesting camera/microphone...</div>}
          {mediaError && <div className="error-box">Warning {mediaError} <button className="btn-primary" onClick={() => requestMedia()}>Retry</button></div>}
          {!stream && ready && !loading && <div className="error-box">No media. <button className="btn-primary" onClick={() => requestMedia()}>Retry</button></div>}
        </div>
        <ChatPanel socket={socket} roomId={roomId} messages={messages} setMessages={setMessages} peerTyping={peerTyping} />
      </div>
      <ControlBar micOn={micOn} cameraOn={cameraOn} onMic={toggleMic} onCamera={toggleCamera}
        onNext={handleNext} onEnd={handleEnd} onReport={() => setShowReport(true)} onBlock={handleBlock} disabled={status === 'searching'} />
      {showReport && <ReportModal onClose={() => setShowReport(false)} onSubmit={handleReport} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
