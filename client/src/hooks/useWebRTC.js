import { useCallback, useEffect, useRef, useState } from 'react';
import { getIceServers } from '../services/socket';

export function useWebRTC({ socket, localStream, roomId, initiator }) {
  const [remoteStream, setRemoteStream] = useState(null);
  const [rtcState, setRtcState] = useState('idle');
  const pcRef = useRef(null);
  const pending = useRef([]);
  const remoteRef = useRef(null);

  const cleanup = useCallback(() => {
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    pending.current = [];
    if (remoteRef.current) {
      remoteRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      remoteRef.current = null;
    }
    setRemoteStream(null);
    setRtcState('closed');
  }, []);

  const createPeer = useCallback(() => {
    if (pcRef.current) { try { pcRef.current.close(); } catch {} }
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    pcRef.current = pc;
    pc.onicecandidate = (e) => {
      if (e.candidate && socket && roomId) {
        socket.emit('iceCandidate', { roomId, candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
      }
    };
    pc.ontrack = (e) => {
      if (!remoteRef.current) remoteRef.current = new MediaStream();
      e.streams[0]?.getTracks().forEach((t) => {
        if (!remoteRef.current.getTrackById(t.id)) remoteRef.current.addTrack(t);
      });
      setRemoteStream(remoteRef.current);
    };
    pc.onconnectionstatechange = () => setRtcState(pc.connectionState);
    if (localStream) {
      localStream.getTracks().forEach((t) => { try { pc.addTrack(t, localStream); } catch {} });
    }
    return pc;
  }, [localStream, roomId, socket]);

  const start = useCallback(async () => {
    if (!socket || !roomId || !localStream) return;
    setRtcState('connecting');
    if (remoteRef.current) {
      remoteRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      remoteRef.current = null;
      setRemoteStream(null);
    }
    const pc = createPeer();
    if (initiator) {
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        socket.emit('webrtcOffer', { roomId, offer: { type: 'offer', sdp: offer.sdp } });
      } catch (e) { console.error('Offer failed', e); setRtcState('failed'); }
    }
  }, [socket, roomId, localStream, initiator, createPeer]);

  useEffect(() => {
    if (pcRef.current && localStream) {
      const pc = pcRef.current;
      const senders = pc.getSenders();
      localStream.getTracks().forEach((track) => {
        if (!senders.some((s) => s.track && s.track.id === track.id)) {
          try { pc.addTrack(track, localStream); } catch {}
        }
      });
    }
  }, [localStream]);

  useEffect(() => {
    if (!socket) return;
    const onOffer = async ({ roomId: rid, offer }) => {
      if (rid !== roomId) return;
      try {
        let pc = pcRef.current;
        if (!pc) pc = createPeer();
        if (pc.signalingState !== 'stable') return;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        for (const c of pending.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
        pending.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtcAnswer', { roomId: rid, answer: { type: 'answer', sdp: answer.sdp } });
        setRtcState('connecting');
      } catch (e) { console.error('Offer handling failed', e); setRtcState('failed'); }
    };
    const onAnswer = async ({ roomId: rid, answer }) => {
      if (rid !== roomId) return;
      try {
        const pc = pcRef.current;
        if (!pc) return;
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          for (const c of pending.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
          pending.current = [];
        }
      } catch (e) { console.error('Answer failed', e); setRtcState('failed'); }
    };
    const onCandidate = async ({ roomId: rid, candidate }) => {
      if (rid !== roomId || !candidate) return;
      try {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        else {
          const k = JSON.stringify(candidate);
          if (!pending.current.some((c) => JSON.stringify(c) === k)) pending.current.push(candidate);
        }
      } catch (e) { /* ignore dup */ }
    };
    socket.on('webrtcOffer', onOffer);
    socket.on('webrtcAnswer', onAnswer);
    socket.on('iceCandidate', onCandidate);
    return () => { socket.off('webrtcOffer', onOffer); socket.off('webrtcAnswer', onAnswer); socket.off('iceCandidate', onCandidate); };
  }, [socket, roomId, createPeer]);

  return { remoteStream, rtcState, start, cleanup };
}
